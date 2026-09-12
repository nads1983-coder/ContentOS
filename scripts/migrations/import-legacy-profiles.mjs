// Offline Appwrite console snapshot import. No source credentials, public export endpoint or password hashes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
const [ownerFile,profileFile,authFile,mode='check']=process.argv.slice(2);
if(!ownerFile||!profileFile||!authFile)throw Error('Usage: import-legacy-profiles OWNER_URL_FILE PROFILES_JSON AUTH_JSON [apply|verify|check]');
const source=JSON.parse(fs.readFileSync(profileFile,'utf8'));
const users=JSON.parse(fs.readFileSync(authFile,'utf8'));
const fieldNames=['email','full_name','plan','stripe_customer_id','stripe_subscription_id','stripe_checkout_session_id','subscription_status','subscription_current_period_end','subscription_cancel_at_period_end','subscription_canceled_at','created_at','updated_at','brand_profiles_json','onboarding_json','generation_history_json','usage_events_json','entitlement_source','amount_paid'];
function normalize(row){
 assert.match(row.$id,/^[a-f0-9]{20}$/);
 const data={id:row.$id};
 for(const field of fieldNames){
  assert.ok(Object.hasOwn(row,field),`Missing field ${field}`);
  let value=row[field];
  if(value==='NULL')value=null;
  if(value!==null&&field==='amount_paid'){value=Number(value);assert.ok(Number.isFinite(value));}
  if(value!==null&&field==='subscription_cancel_at_period_end'){assert.ok(value==='true'||value==='false');value=value==='true';}
  if(value!==null&&field.endsWith('_json'))JSON.parse(value); // Preserve original serialized content exactly.
  data[field]=value;
 }
 assert.ok(typeof data.email==='string'&&data.email.includes('@'));
 assert.ok(Number.isFinite(Date.parse(data.created_at))&&Number.isFinite(Date.parse(data.updated_at)));
 return data;
}
const profiles=source.map(normalize),byId=new Map(profiles.map(p=>[p.id,p]));
assert.equal(byId.size,source.length,'Duplicate IDs');assert.equal(new Set(profiles.map(p=>p.email.toLowerCase())).size,profiles.length,'Duplicate emails');
for(const u of users){assert.ok(byId.has(u.id),'Auth user missing profile');assert.equal(u.email.toLowerCase(),byId.get(u.id).email.toLowerCase());assert.equal(typeof u.disabled,'boolean');assert.equal(typeof u.emailVerified,'boolean');}
const stats={profiles:profiles.length,authUsers:users.length,disabled:users.filter(u=>u.disabled).length,orphanProfiles:profiles.length-users.length,founderProfiles:profiles.filter(p=>p.plan==='founder').length,lifetimeStudio:profiles.filter(p=>p.plan==='pro_studio'&&String(p.entitlement_source).startsWith('manual_lifetime')).length};
console.log('Validated snapshot',stats,'sha256',createHash('sha256').update(JSON.stringify(profiles)).digest('hex'));
if(mode==='check')process.exit(0);
const client=new pg.Client({connectionString:fs.readFileSync(ownerFile,'utf8').trim()});await client.connect();
try{
 if(mode==='apply'){
  await client.query('BEGIN');
  for(const p of profiles){
   // Refuse to replace an account that has already claimed its credentials.
   const active=await client.query('SELECT 1 FROM contentos_auth.account WHERE user_id=$1',[p.id]);
   assert.equal(active.rowCount,0,'Account already active: import would overwrite live changes');
   await client.query('INSERT INTO contentos_app.profiles(id,email,data,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=excluded.email,data=excluded.data,updated_at=excluded.updated_at',[p.id,p.email.toLowerCase(),p,p.updated_at]);
  }
  for(const u of users){const p=byId.get(u.id);
   await client.query('INSERT INTO contentos_auth."user"(id,name,email,email_verified,disabled,legacy_account,created_at,updated_at) VALUES($1,$2,$3,$4,$5,true,$6,$7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,email_verified=excluded.email_verified,disabled=excluded.disabled,legacy_account=true,updated_at=excluded.updated_at',[u.id,u.name||p.full_name||'ContentOS member',u.email.toLowerCase(),u.emailVerified,u.disabled,p.created_at,p.updated_at]);
  }
  await client.query('COMMIT');
 }
 for(const p of profiles){const r=await client.query('SELECT data FROM contentos_app.profiles WHERE id=$1',[p.id]);assert.deepEqual(r.rows[0]?.data,p,'Imported profile mismatch');}
 for(const u of users){const r=await client.query('SELECT email,disabled,email_verified,legacy_account FROM contentos_auth."user" WHERE id=$1',[u.id]);assert.deepEqual(r.rows[0],{email:u.email.toLowerCase(),disabled:u.disabled,email_verified:u.emailVerified,legacy_account:true});}
 console.log('PASS exact profile and account-state comparison',new Date().toISOString());
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Import stopped safely:',error.code||error.message?.split('\n')[0]);process.exitCode=1;}
finally{await client.end();}
