import { strict as assert } from 'node:assert';
import { buildCoachAdvisorView, coachAnswer, coachBrief } from '../src/coachAdvisorPhase6.ts';

const original = globalThis.localStorage;
const store = new Map<string,string>();
(globalThis as any).localStorage = {
  getItem:(k:string)=>store.get(k) ?? null,
  setItem:(k:string,v:string)=>store.set(k,v),
  removeItem:(k:string)=>store.delete(k),
};

const view = buildCoachAdvisorView([]);
assert.ok(view.primary);
assert.ok(view.headline.length > 0);
assert.ok(Array.isArray(view.secondary));
assert.ok(view.context.goals.length === 5);
assert.match(coachAnswer('ciao', []), /Sono qui/i);
assert.ok(coachBrief([]).length > 0);

(globalThis as any).localStorage = original;
console.log('Phase 6 Coach Advisor contract tests: PASS');
