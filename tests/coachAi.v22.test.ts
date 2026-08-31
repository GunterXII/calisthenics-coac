import assert from 'node:assert/strict';
import { buildCoachToolSnapshot } from '../src/coachTools.ts';
import { buildCoachContext } from '../src/coachAdvisorEngine.ts';

(globalThis as any).localStorage = {
  _m:new Map<string,string>(),
  getItem(k:string){return this._m.get(k)??null},
  setItem(k:string,v:string){this._m.set(k,v)},
  removeItem(k:string){this._m.delete(k)},
};

const context = buildCoachContext([]);
const snapshot:any = buildCoachToolSnapshot(context);
assert(snapshot.currentProgram && snapshot.currentProgram.Monday, 'current program must be exposed');
assert(Array.isArray(snapshot.recentSessions), 'recent sessions must be exposed');
assert(snapshot.goals.some((g:any)=>g.id==='oap'), 'OAP goal must be available');
assert(snapshot.simulations && typeof snapshot.simulations === 'object', 'deterministic simulation map must exist');
console.log('V22 conversational AI tool snapshot: PASS');
