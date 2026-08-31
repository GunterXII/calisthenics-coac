import assert from 'node:assert/strict';
import { buildCoachContext, answerCoachQuestion } from '../src/coachAdvisorEngine.ts';

(globalThis as any).localStorage = {
  _m:new Map<string,string>(),
  getItem(k:string){return this._m.get(k)??null},
  setItem(k:string,v:string){this._m.set(k,v)},
  removeItem(k:string){this._m.delete(k)},
};

const context=buildCoachContext([]);
const phase=answerCoachQuestion('Qual è la mia fase attuale e perché?',context);
const volume=answerCoachQuestion('Quanto volume settimanale sto facendo per chest, triceps, front delts e side delts?',context);
const goals=answerCoachQuestion('Quali dei miei obiettivi stanno ricevendo più priorità in questa fase?',context);
const modify=answerCoachQuestion("Se volessi aumentare l'ipertrofia senza compromettere OAP, FL Pull-Up e Front Lever Touch, come modificheresti il programma?",context);
assert(/accumulation/i.test(phase));
assert(/chest/i.test(volume) && /triceps/i.test(volume));
assert(/OAP/i.test(goals) && /Front Lever Touch/i.test(goals));
assert(/ipertrofia/i.test(modify) && /skill/i.test(modify));
assert.notEqual(phase, volume);
assert.notEqual(volume, goals);
assert.notEqual(goals, modify);
console.log('V22.1 conversational fallback regression: PASS');
