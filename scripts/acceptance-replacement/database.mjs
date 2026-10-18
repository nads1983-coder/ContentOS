import {SCHEMA,demand} from "./runtime.mjs";
export function database(client, plan, schema=SCHEMA) {
  demand(/^[a-z0-9_]+$/.test(schema),"invalid_schema");
  const query = async (fn,args=[]) => (await client.query(`SELECT ${schema}.${fn}(${[plan.planHash,...args].map((_,i)=>`$${i+1}`).join(",")}) AS value`,[plan.planHash,...args])).rows[0].value;
  return {
    inspect:()=>query("inspect"), snapshot:async()=> (await query("snapshot")).data,
    reserve:(k,b)=>query("reserve",[k,b]), finish:(k,s,e)=>query("finish",[k,s,JSON.stringify(e)]),
    outcome:e=>query("outcome",[JSON.stringify(e)]),disable:()=>query("disable"),
    mutate:async fn=>{
      await client.query("BEGIN");
      try {
        const snapshot = await query("snapshot"), {data,result}=fn(snapshot.data);
        await query("save",[snapshot.revision,JSON.stringify(data)]);
        await client.query("COMMIT"); return result;
      } catch(e) { await client.query("ROLLBACK").catch(()=>{}); throw e; }
    }
  };
}
