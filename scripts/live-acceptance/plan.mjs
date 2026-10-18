import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { CANDIDATE, PROJECT, ROLE, sha, demand, loadModules, validatePayload, DRAFT_BYTES, REVIEW_BYTES, GBP_PER_USD_BOUND, reserveMicroGbp } from "./runtime.mjs";
export function buildPlan(expires) {
  const paths = ["prompts","content-config","text-normalize","generation-contract","cta-policy","claim-scope","factual-grounding","grounding-batches",
    "generation-pipeline","generation-stages","generation-reservation","workspace-contract","entitlements","usage"];
  const modules = {}, sourceHashes = {};
  for (const file of [...paths,"stripe-rest"]) {
    const path = `lib/${file}.ts`, source = execFileSync("git",["show",`${CANDIDATE}:${path}`],{encoding:"utf8"});
    sourceHashes[path] = sha(source); let pure = source;
    if (file === "stripe-rest") {
      const tree = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
      const nodes = tree.statements.filter(n=>ts.isFunctionDeclaration(n) && ["normalizePlanId","normalizeSubscriptionStatus","planHasActiveEntitlement","hasActiveEntitlement"].includes(n.name?.text));
      demand(nodes.length === 4,"missing_entitlement_helpers"); pure = nodes.map(n=>n.getText(tree)).join("\n");
    }
    modules[path] = ts.transpileModule(pure,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  }
  const load = loadModules(modules), raw = JSON.parse(readFileSync(new URL("./brief.json",import.meta.url),"utf8"));
  const selectedTypes = Array.from(load("lib/content-config.ts").contentTypes,t=>t.id);
  const request = load("lib/generation-contract.ts").normalizeGenerationRequest({...raw,selectedTypes,requestId:randomUUID()});
  const pipeline = load("lib/generation-pipeline.ts");
  const draft = validatePayload(JSON.stringify(pipeline.pipelinePayload(pipeline.newGenerationPipeline(),request)));
  const worstCaseMicroGbp = reserveMicroGbp(DRAFT_BYTES,24000)+12*reserveMicroGbp(REVIEW_BYTES,4800);
  demand(worstCaseMicroGbp <= 2700000, "preflight_budget");
  const material = {project:PROJECT,environment:"preview",role:ROLE,candidate:CANDIDATE,cap:2700000,maxCalls:13,expires,
    limits:{draftBytes:DRAFT_BYTES,reviewBytes:REVIEW_BYTES},
    preflight:{draftBytes:draft.bytes,draftReserveMicroGbp:draft.reserve,worstCaseMicroGbp},
    account:`staged-validation-${randomUUID()}`,request,requestHash:sha(JSON.stringify(request)),briefHash:sha(JSON.stringify(raw)),modules,sourceHashes,
    moduleHashes:Object.fromEntries(Object.entries(modules).map(([p,s])=>[p,sha(s)])),
    pricing:{inputUsdPerMillion:1.75,cachedUsdPerMillion:.175,outputUsdPerMillion:14,gbpPerUsdReservation:GBP_PER_USD_BOUND,
      checkedAt:"2026-10-18",source:"https://developers.openai.com/api/docs/models/gpt-5.2",gbpPerUsdReference:.84385/1.1253}};
  return {...material,planHash:sha(JSON.stringify(material))};
}
