import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './image-test-helpers.mjs';
const evidence=JSON.parse(readFileSync(new URL('../docs/pr22-grounding-candidate-2026-11-09.json',import.meta.url)));
const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
for(const row of evidence.results.filter(r=>r.validation==='failed')) {
  test(`recorded ${row.model} ${row.case} ${row.repeat} retains safe validation`,()=>{
    const req=normalizeGenerationRequest(evidence.cases.find(c=>c.id===row.case));
    if(row.model==='gpt-6-luna' && row.case==='all-formats' && row.repeat===1) {
      const result=parseGenerationOutput(row.output,req);
      assert.deepEqual(result.sections.map(s=>s.type),req.selectedTypes);
    } else assert.throws(()=>parseGenerationOutput(row.output,req));
  });
}
