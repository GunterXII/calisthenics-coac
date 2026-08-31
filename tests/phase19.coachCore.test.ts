import assert from 'node:assert/strict';
import { phaseStimulusTarget } from '../src/adaptiveStimulusEngine';
import { analyzeHypertrophyResponse } from '../src/hypertrophyResponseEngine';
import { buildCoachContext } from '../src/coachAdvisorEngine';
import { runCoachAgent } from '../src/coachAgentEngine';

const mem=new Map<string,string>();
(globalThis as any).localStorage={getItem:(k:string)=>mem.get(k)||null,setItem:(k:string,v:string)=>mem.set(k,v),removeItem:(k:string)=>mem.delete(k)};

const target=phaseStimulusTarget({adaptationWeights:{skill:0.8,strength:0.6,hypertrophy:0.7,endurance:0.4,power:0.2}});
assert.equal(target.skill,16);
assert.equal(target.hypertrophy,35);
const sessions:any[]=[];
const h=analyzeHypertrophyResponse(sessions);
assert.ok(h.length>0);
const ctx=buildCoachContext(sessions);
const agent=runCoachAgent('Come sto messo con i dips?',ctx);
assert.ok(agent.facts.some(x=>x.name==='get_goal_status'));
console.log('Phase 19 coach core hardening PASS');
