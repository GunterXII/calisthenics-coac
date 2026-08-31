import assert from 'node:assert/strict';
import { buildCoachContext } from '../src/coachAdvisorEngine';
import { runCoachAgent } from '../src/coachAgentEngine';

const ctx = buildCoachContext([]);
const run = runCoachAgent('Devo aumentare i dips?', ctx);
assert.ok(run.facts.length >= 4);
assert.equal(typeof run.recommendation, 'string');
console.log('Phase 19 coach agent PASS');
