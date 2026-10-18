import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
const files=["package.json","package-lock.json"];
const raw=files.map(path=>readFileSync(path)),[pkg,lock]=raw.map(x=>JSON.parse(x));
if(pkg.dependencies?.pg!=="8.23.0"||lock.lockfileVersion!==3||
 lock.packages?.[""]?.dependencies?.pg!==pkg.dependencies.pg||lock.packages?.["node_modules/pg"]?.version!=="8.23.0"){
 console.error("Runner package/lock agreement failed before install.");process.exit(1);
}
console.log(JSON.stringify({runnerInstallInputs:files.map((path,i)=>({path,sha256:createHash("sha256").update(raw[i]).digest("hex")})),node:process.version}));
const child=spawnSync("npm",["ci","--ignore-scripts","--omit=dev","--no-audit","--no-fund"],{stdio:"inherit",timeout:90000});
process.exit(child.status??1);
