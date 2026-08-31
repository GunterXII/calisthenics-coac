import { strict as assert } from 'node:assert';
import { buildCoachContext, answerCoachQuestion } from '../src/coachAdvisorEngine.ts';

const original = globalThis.localStorage;
const store = new Map<string,string>();
// Minimal Node test shim for the advisory engine.
(globalThis as any).localStorage = {
  getItem:(k:string)=>store.get(k) ?? null,
  setItem:(k:string,v:string)=>store.set(k,v),
  removeItem:(k:string)=>store.delete(k),
};

const ctx = buildCoachContext([]);
assert.ok(ctx.phase);
assert.equal(ctx.goals.length, 5);
assert.ok(ctx.insights.length >= 1);
assert.match(answerCoachQuestion('Come compilo RIR e fatica?', ctx), /RIR/);
assert.match(answerCoachQuestion('Sto facendo abbastanza ipertrofia?', ctx), /ipertrof/i);

(globalThis as any).localStorage = original;
console.log('Phase 6 Coach Advisor tests: PASS');
