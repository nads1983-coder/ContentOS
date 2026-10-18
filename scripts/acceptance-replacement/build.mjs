import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {validateManifest} from "./runtime.mjs";
// Build never reads credentials, connects to a database, or calls a provider.
validateManifest(JSON.parse(readFileSync("signed-plan.json","utf8")),readFileSync("operator-public.pem","utf8"));
mkdirSync("public",{recursive:true});
writeFileSync("public/index.html","<!doctype html><meta name=robots content=noindex><title>Protected validation</title><p>Operator access required.</p>");
console.log("Signed candidate build passed. No provider or database call made.");
