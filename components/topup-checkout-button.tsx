"use client";
import { useRef, useState } from "react";

export function TopupCheckoutButton({accountId,packageId,enabled}:{accountId:string;packageId:string;enabled:boolean}) {
  const attempt=useRef<string | null>(null);
  const [pending,setPending]=useState(false),[error,setError]=useState("");
  async function start() {
    if(pending || !enabled)return;
    attempt.current ??= crypto.randomUUID();
    setPending(true);setError("");
    try {
      const response=await fetch("/api/topups/checkout",{method:"POST",headers:{"Content-Type":"application/json","X-ContentOS-Account":accountId},
        body:JSON.stringify({package:packageId,requestId:attempt.current})});
      const body=await response.json() as {url?:string;error?:string};
      if(!response.ok || !body.url)throw new Error(body.error ?? "Checkout is unavailable.");
      const url=new URL(body.url);
      if(url.protocol!=="https:" || url.hostname!=="checkout.stripe.com")throw new Error("Checkout could not be verified.");
      window.location.assign(url.href);
    } catch(e) {setError(e instanceof Error?e.message:"Checkout is unavailable.");setPending(false);}
  }
  return <div><button type="button" disabled={!enabled || pending} onClick={start} className="mt-2 rounded border border-white/20 px-3 py-2 text-sm disabled:opacity-50">{enabled?(pending?"Opening checkout…":"Buy one-time top-up"):"Not available yet"}</button>{error?<p role="alert" className="mt-2 text-sm text-muted">{error}</p>:null}</div>;
}
