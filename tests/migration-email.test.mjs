import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sendWithRetry, validToken, HTML, TEXT, SUBJECT } from '../lib/migration-email.ts';
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
test('exact notice contains the live sign-in link and reset instruction', () => {
  assert.equal(SUBJECT,'A quick ContentOS sign-in update');
  assert.match(HTML, /href="https:\/\/getcontentos.co\/login">ContentOS sign-in page<\/a>/);
  assert.match(HTML, /<strong>Forgot password<\/strong>/);
  assert.match(TEXT,/Your account, profile and membership are all still in place\./);
});
test('operator token is a separate exact 256-bit secret', () => {
  const token='a'.repeat(64);const hash=createHash('sha256').update(token).digest('hex');
  assert.equal(validToken(token,hash),true);assert.equal(validToken('b'.repeat(64),hash),false);assert.equal(validToken('',hash),false);
});
test('transient retry uses precisely the same recipient, content and idempotency key', async () => {
  const calls=[]; let logged=0;
  const result=await sendWithRetry('mock@example.com','campaign/account','mock-key',async()=>{logged++;},async(url,init)=>{
    calls.push({url,...init,signal:undefined});
    return calls.length===1 ? new Response('{}',{status:429}) : Response.json({id});
  },async()=>{});
  assert.equal(result.id,id);assert.equal(logged,2);assert.deepEqual(calls[0],calls[1]);
});
test('network failures retry at most three times; permanent rejection only once', async () => {
  let calls=0;
  const r=await sendWithRetry('mock@example.com','campaign/account','mock-key',async()=>{},async()=>{calls++;throw new Error('timeout');},async()=>{});
  assert.equal(calls,3);assert.equal(r.reason,'network_or_timeout');calls=0;
  await sendWithRetry('mock@example.com','campaign/account','mock-key',async()=>{},async()=>{calls++;return new Response('{}',{status:422});},async()=>{});
  assert.equal(calls,1);
});
test('storage failure prevents any provider request', async () => {
  let calls=0;
  await assert.rejects(sendWithRetry('mock@example.com','campaign/account','mock-key',async()=>{throw new Error('db');},async()=>{calls++;return Response.json({id});},async()=>{}));
  assert.equal(calls,0);
});
