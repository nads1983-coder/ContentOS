// Explicit, local verification of approved temporary accounts. Never logs credentials.
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const [deployment,fixturePath,action='login'] = process.argv.slice(2);
if(!deployment || !fixturePath) throw Error('Usage: node scripts/verify-auth.mjs DEPLOYMENT PRIVATE_FIXTURE ACTION');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
if(!/^nads1983\+contentos-/.test(fixture.email)) throw Error('Temporary test inbox required');
const dir=path.dirname(fixturePath), jar=path.join(dir,'test-session.cookies');
const cli=process.env.VERCEL_CLI;
const preview=deployment.endsWith('.vercel.app');
if(preview&&!cli) throw Error('Set VERCEL_CLI to the installed Vercel CLI entry point');
function request(route,body,options={}){
 const bodyFile=path.join(dir,'test-request.json'),resultFile=path.join(dir,'test-response.txt'),headerFile=path.join(dir,'test-headers.txt');
 const args=[...(preview?[cli,'curl',route,'--deployment',deployment,'--']:[deployment+route]),'--silent','--output',resultFile,'--dump-header',headerFile,'--write-out','%{http_code}'];
 if(body!==undefined){fs.writeFileSync(bodyFile,JSON.stringify(body),{mode:0o600});args.push('--request','POST','--header','Content-Type: application/json','--header',`Origin: ${options.origin||deployment}`,'--data-binary',`@${bodyFile}`);}
 if(options.cookies!==false) args.push('--cookie',jar,'--cookie-jar',jar);
 const r=spawnSync(preview?'node':'curl',args,{encoding:'utf8'});
 if(r.status!==0)throw Error('Vercel request failed');
 const status=Number(r.stdout.trim()),text=fs.readFileSync(resultFile,'utf8'),headers=fs.readFileSync(headerFile,'utf8');
 for(const p of [resultFile,headerFile,jar])if(fs.existsSync(p))fs.chmodSync(p,0o600);
 let data;try{data=JSON.parse(text)}catch{}
 return {status,text,headers,data};
}
function check(label,condition,extra=''){console.log(`${condition?'PASS':'FAIL'} ${label}${extra?' '+extra:''}`);if(!condition)process.exitCode=1;}
if(action==='login'){
 let r=request('/api/auth/login',{email:fixture.email,password:'Incorrect-Password-Only'});check('wrong password rejected',r.status===401);
 r=request('/api/auth/login',fixture);check('login succeeds',r.status===200,String(r.status));
 check('session cookie secure/HttpOnly',/set-cookie:.*contentos.*HttpOnly.*Secure/i.test(r.headers)||/set-cookie:.*contentos.*Secure.*HttpOnly/i.test(r.headers));
 check('login response does not expose session token',!r.text.includes('token'));
 r=request('/api/account/get-session');check('session matches signed-in user',r.data?.user?.email===fixture.email);
 r=request('/dashboard');check('authenticated dashboard renders',r.status===200&&!r.text.includes('<h1 class="mt-8 font-display text-3xl uppercase tracking-normal">Login required'));
 r=request('/api/account/get-session');check('session persists after refresh',r.data?.user?.email===fixture.email);
 r=request('/api/auth/logout',{}, {origin:'https://attacker.invalid'});check('cross-origin logout rejected',r.status===403);
}else if(action==='reset'){
 const r=request('/api/auth/reset',{email:fixture.email});check('password reset requested',r.status===200);
}else if(action==='confirm'){
 const token=fs.readFileSync(path.join(dir,'contentos-test-reset-token.txt'),'utf8').trim(),password=randomBytes(24).toString('base64url');
 let r=request('/api/auth/reset/confirm',{token,password});check('password reset completes',r.status===200,String(r.status));
 if(r.status===200){fixture.password=password;fs.writeFileSync(fixturePath,JSON.stringify(fixture),{mode:0o600});}
 r=request('/api/auth/reset/confirm',{token,password});check('reset token cannot be reused',r.status===400);
 r=request('/api/account/get-session');check('previous session revoked by reset',r.data===null);
 r=request('/api/auth/login',fixture);check('new password signs in',r.status===200,String(r.status));
}else if(action==='logout'){
 const r=request('/api/auth/logout',{});check('logout succeeds',r.status===200);
 check('logged-out session rejected',request('/api/account/get-session').data===null);
 const dashboard=request('/dashboard');check('protected route redirects',dashboard.status===307||dashboard.status===303);
}else if(action==='write'){
 const body={businessName:'Temporary migration verification',audience:'Test',niche:'Test',goals:'Verify account isolation',preferredPlatforms:['linkedin'],writingTone:'Professional',userId:'6a2cf525000340bd9191',plan:'founder'};
 let r=request('/api/onboarding',body,{origin:'https://attacker.invalid'});check('cross-origin data write rejected',r.status===403);
 r=request('/api/onboarding',body);check('authenticated data write succeeds',r.status===200);
}else throw Error('Unknown action');
