import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { loadTs } from './image-test-helpers.mjs';
import { validateEnvironment } from '../scripts/qa/campaign.mjs';
const { console, Request }=globalThis;
const fixtures=['a','b'].map(s=>JSON.parse(readFileSync(`/tmp/contentos-pr7-qa-private/actor-${s}.json`,'utf8')));
const contexts=[],cookies=[];
let checks=0;
try{
  for(const fixture of fixtures){
    validateEnvironment(fixture.env);
    const cache=new Map(), env={...fixture.env,BETTER_AUTH_SECRET:fixtures[0].env.BETTER_AUTH_SECRET};
    const runtime={process:{env},console:{...console,error:()=>{}}};
    const mocks={'server-only':{},'@/lib/auth-mail':{queueAuthMail:async()=>{throw new Error('QA mail prohibited');}}};
    const {auth}=loadTs('lib/auth-config.ts',mocks,cache,runtime);
    const {getPool}=loadTs('lib/db/client.ts',mocks,cache,runtime);
    const ip=`198.18.${randomInt(1,254)}.${randomInt(1,254)}`;
    contexts.push({auth,pool:getPool(),env,ip});
  }
  const request=(c,path,body,cookie)=>c.auth.handler(new Request(`${c.env.BETTER_AUTH_URL}/api/account/${path}`,{
    method:body===undefined?'GET':'POST',headers:{origin:c.env.BETTER_AUTH_URL,'content-type':'application/json','x-vercel-forwarded-for':c.ip,...(cookie?{cookie}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  }));
  for(const [i,c] of contexts.entries()){
    const result=await request(c,'sign-in/email',{email:fixtures[i].user.email,password:fixtures[i].user.password});
    assert.equal(result.status,200,'own synthetic Better Auth login');
    const cookie=result.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');cookies.push(cookie);
    const session=await (await request(c,'get-session',undefined,cookie)).json();assert.equal(session.user.id,fixtures[i].user.id);
    const other=fixtures[(i+1)%2].user;
    assert.equal((await request(c,'sign-in/email',{email:other.email,password:other.password})).status,401,'database cannot authenticate another account even with its correct password');
  }
  checks++;console.log('PASS: actual Better Auth logins work only for the credential-bound synthetic identity');
  assert.equal(await (await request(contexts[1],'get-session',undefined,cookies[0])).json(),null);
  assert.equal(await (await request(contexts[0],'get-session',undefined,cookies[1])).json(),null);
  checks++;console.log('PASS: cross-account session cookies cannot read sessions even with the same QA signing secret');
  assert.equal((await request(contexts[0],'sign-out',{},cookies[0])).status,200);
  assert.equal(await (await request(contexts[0],'get-session',undefined,cookies[0])).json(),null);
  assert.equal((await (await request(contexts[1],'get-session',undefined,cookies[1])).json()).user.id,fixtures[1].user.id);
  assert.equal((await request(contexts[1],'sign-out',{},cookies[1])).status,200);
  checks++;console.log('PASS: logout revokes only the bound account session');
  console.log(JSON.stringify({passed:checks,paidCalls:0,mailSent:0,productionWrites:0}));
}catch(e){console.error(JSON.stringify({failed:true,completed:checks,error:e instanceof assert.AssertionError?e.message.split('\n')[0]:'Isolated authentication operation failed',code:e.code}));globalThis.process.exitCode=1;}
finally{await Promise.all(contexts.map(c=>c.pool.end()));}
