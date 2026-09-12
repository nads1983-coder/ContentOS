import fs from 'node:fs';
const [tokenFile,action='status']=process.argv.slice(2);
if (!['status','send','verify'].includes(action)) throw new Error('Expected status, send, or verify');
const token=fs.readFileSync(tokenFile,'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid operator token format');
async function invoke(action,authenticated=true) {
  const response=await fetch(`https://getcontentos.co/api/internal/migration-email?action=${action}`,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(65000),headers:authenticated?{Authorization:`Bearer ${token}`}:{}});
  if (!authenticated) {if(response.status!==401) throw new Error('Unauthenticated access must be rejected');return;}
  const result=await response.json();
  if (!response.ok) throw new Error(`Campaign request failed (${response.status}); inspect ledger before retrying`);
  return result;
}
await invoke('status',false);
if(action!=='send') console.log(JSON.stringify(await invoke(action)));
else {
  const before=await invoke('status');console.log(JSON.stringify({before}));
  if ((before.pending||0)>8 || (before.sending||0)>0 || (before.failed||0)>0) throw new Error('Unexpected inventory or unresolved delivery; inspect ledger');
  for(let n=0;n<10;n++) {
    const result=await invoke('send');console.log(JSON.stringify(result));
    if(['closed','no_pending'].includes(result.outcome)) break;
    if(result.outcome!=='sent' && result.outcome!=='skipped') throw new Error('Stopped after delivery failure; inspect ledger');
    await new Promise(r=>setTimeout(r,650));
  }
}
