// A database outage must not prevent independently verified Preview deletion.
// Every database mutation still requires this campaign's exact binding.
export function bindDatabaseActions(client,schema,planHash,actions) {
 if(!/^[a-z0-9_]+$/.test(schema)||!/^[a-f0-9]{64}$/.test(planHash))throw Error("invalid_cleanup_identity");
 return Object.fromEntries(Object.entries(actions).map(([name,action])=>[name,async()=>{
  const {rows}=await client.query(`SELECT plan_hash FROM ${schema}.campaign WHERE id`);
  if(rows.length!==1||rows[0].plan_hash!==planHash)throw Error("cleanup_plan_mismatch");
  return action();
 }]));
}
