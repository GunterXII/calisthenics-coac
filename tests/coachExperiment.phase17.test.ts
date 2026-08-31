import assert from 'node:assert/strict';
import { createExperimentFromProposal, reviewActiveExperiments } from '../src/coachExperimentEngine.ts';
import { clearCoachExperiments, getCoachExperiments, saveCoachProposal, updateCoachExperiment } from '../src/storage.ts';
import type { SessionSummary } from '../src/types.ts';

class MemoryStorage { private m=new Map<string,string>(); getItem(k:string){return this.m.get(k)??null} setItem(k:string,v:string){this.m.set(k,v)} removeItem(k:string){this.m.delete(k)} }
(globalThis as any).localStorage = new MemoryStorage();

clearCoachExperiments(); localStorage.removeItem('cc-v15-coach-proposals');
const proposal=saveCoachProposal({type:'target',exerciseId:'push-up',title:'Aumenta push-up',detail:'',from:'3 × 15',to:'4 × 15',reason:'Top del range stabile',status:'pending',sessionId:'s1'});
const experiment=createExperimentFromProposal(proposal,'3 × 15');
updateCoachExperiment(experiment.id,{startedAt:50});
assert.equal(experiment.status,'active');
assert.equal(experiment.expectedObservations,2);

const sessions:SessionSummary[]=[
 {id:'s1',date:100,day:'Monday',durationSec:1200,totalReps:45,emomReps:0,bestSkillSeconds:0,readiness:{},logs:[{id:'l1',sessionId:'s1',date:100,day:'Monday',exerciseId:'push-up',exerciseName:'Push-up',kind:'PERFORMANCE',status:'complete',prescription:{kind:'PERFORMANCE',sets:3,targetRange:'3 × 15',restSec:90,fatigueCost:2,muscleGroups:['chest'],progressionMode:'hypertrophy_reps'},result:{reps:[15,15,15]}} as any]},
 {id:'s2',date:200,day:'Monday',durationSec:1200,totalReps:60,emomReps:0,bestSkillSeconds:0,readiness:{},logs:[{id:'l2',sessionId:'s2',date:200,day:'Monday',exerciseId:'push-up',exerciseName:'Push-up',kind:'PERFORMANCE',status:'complete',prescription:{kind:'PERFORMANCE',sets:4,targetRange:'4 × 15',restSec:90,fatigueCost:2,muscleGroups:['chest'],progressionMode:'hypertrophy_reps'},result:{reps:[15,15,15,15]}} as any]}
];
const results=reviewActiveExperiments(sessions);
assert.equal(results.length,1);
assert.equal(results[0].status,'verified');
assert.equal(getCoachExperiments()[0].observations,2);
console.log('Phase 17 Coach Experiment Loop: PASS');
