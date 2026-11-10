import "server-only";
/** Restrict both declared and streamed size; abort slow or unbounded bodies. */
export async function readAdminJson(request:Request):Promise<unknown> {
  const length=request.headers.get("content-length");
  if(length && (!/^\d+$/.test(length) || Number(length)>2048))throw new Error("Invalid body size.");
  if(!request.body)throw new Error("Missing body.");
  const reader=request.body.getReader(), decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,text="",timer:ReturnType<typeof setTimeout> | undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new Error("Body timeout."));},5000);});
  try {
    while(true){const item=await Promise.race([reader.read(),timeout]);if(item.done)break;size+=item.value.byteLength;
      if(size>2048)throw new Error("Body too large.");text+=decoder.decode(item.value,{stream:true});}
    return JSON.parse(text+decoder.decode());
  } catch(error){void reader.cancel().catch(()=>{});throw error;}
  finally {clearTimeout(timer);reader.releaseLock();}
}
