import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";
const {scopeFindings}=loadTs("lib/claim-scope.ts");
const source="The new range has twelve catalogue patterns: four patterns belong to the Arc zip-cover range and eight belong to the Bond fixed-cover range.";
const allow=(text,sources=[source])=>assert.deepEqual(scopeFindings(text,sources),[],text);
const reject=(text,sources=[source])=>assert.ok(scopeFindings(text,sources).length,text);

test("main quantity retains its object across parenthetical commas and coordination",()=>{
 for(const text of [
  "The range includes 12 catalogue patterns (4 Arc, 8 Bond).",
  "The range includes twelve catalogue patterns (four Arc and eight Bond).",
  "The range includes 12 catalogue patterns (8 Bond, 4 Arc).",
  "The range includes 12 catalogue patterns (Arc 4, Bond 8).",
  "The range includes 12 catalogue patterns (4 Arc zip-cover range, 8 Bond fixed-cover range).",
  "The range includes 12 catalogue patterns.",
 ])allow(text);
 allow("Each kit contains 6 tools (2 drills, 4 drivers) and 3 screws.",
  ["Each kit contains 6 tools (2 drills, 4 drivers) and 3 screws."]);
 allow("Each kit contains three tools (label \u{1D400}) and four hooks.",
  ["Each kit contains three tools and four hooks."]);
});

test("total, component quantities, complete partition and product relationships stay bound",()=>{
 for(const text of [
  "The range includes 13 catalogue patterns (4 Arc, 8 Bond).",
  "The range includes 12 catalogue patterns (8 Arc, 4 Bond).",
  "The range includes 12 catalogue patterns (Arc 8, Bond 4).",
  "The range includes 12 catalogue patterns (4 Arc).",
  "The range includes 12 catalogue patterns (12 Arc).",
  "The range includes 12 catalogue patterns (4 Arc, 7 Bond).",
  "The range includes 12 catalogue patterns (4 Arc, 4 Bond, 4 Other).",
  "The range includes 12 catalogue patterns (4 Arc, 8 Arc).",
  "The range includes 12 catalogue patterns (4 Arc fixed-cover range, 8 Bond zip-cover range).",
  "The Arc range includes 12 catalogue patterns (4 Arc, 8 Bond).",
  "The range includes 12 stock slots (4 Arc, 8 Bond).",
  "The range includes 12 catalogue patterns (4 Arc, 8 Bond, guaranteed sales).",
  "The range includes 12 catalogue patterns (4 Arc, 8 Bond",
  "The range includes 12 catalogue patterns (4 Arc, 8 Bond) (6 Other).",
 ])reject(text);
});

test("a matching total or numbers from another subject cannot certify a breakdown",()=>{
 const claim="The range includes 12 catalogue patterns (4 Arc, 8 Bond).";
 reject(claim,["The range has twelve catalogue patterns."]);
 reject(claim,["The range has twelve catalogue patterns.","Another range has twelve catalogue patterns (4 Arc, 8 Bond)."]);
 reject(claim,["The range has twelve catalogue patterns: four covers belong to the Arc zip-cover range and eight belong to the Bond fixed-cover range."]);
 reject(claim,["The range has twelve catalogue patterns: four patterns belong to the Arc zip-cover range and eight belong to the Arc fixed-cover range."]);
 reject(claim,["The range may have twelve catalogue patterns (4 Arc, 8 Bond)."]);
});

test("parentheses do not suppress an unsupported main count or substantive outcome",()=>{
 reject("The range includes 18 catalogue patterns (a quiet, tactile choice).");
 reject("Each kit contains 6 tools (2 drills and 4 drivers) and 12 screws.",
  ["Each kit contains 6 tools (2 drills and 4 drivers) and 3 screws."]);
 reject("The service guarantees 12 sales (4 Arc, 8 Bond).",[source]);
 allow("A quiet, tactile choice for a familiar chair.");
});
