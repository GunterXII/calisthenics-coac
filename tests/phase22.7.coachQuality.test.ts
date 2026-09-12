import assert from 'node:assert/strict';
import { analyzeHypertrophyResponse } from '../src/hypertrophyResponseEngine.ts';
import { PROGRAM } from '../src/program.ts';
import type { SessionSummary, WorkoutLog } from '../src/types.ts';

const now=10_000;
const log=(id:string,exerciseId:string,reps:number[]):WorkoutLog=>({
  id,sessionId:id,date:9_500,day:'Monday',exerciseId,exerciseName:exerciseId,kind:'PERFORMANCE',status:'complete',
  prescription:{version:1,exerciseId,variantId:exerciseId,variantName:exerciseId,name:exerciseId,kind:'PERFORMANCE',targetRange:'15–25',sets:reps.length,restSec:75,capturedAt:9_500},
  result:{reps,rir:2,fatigue:2}
});

const sessions:SessionSummary[]=[{
  id:'s1',date:9_500,day:'Monday',durationSec:1800,readiness:{},totalReps:30,emomReps:0,bestSkillSeconds:0,
  logs:[log('l1','lat-a',[15,15,15]),log('l2','lat-a',[15,15,15]),log('l3','lat-a',[15,15,15]),log('l4','lat-a',[15,15,15]),log('l5','pushup-volume',[20,20,20])]
}];

const rows=analyzeHypertrophyResponse(sessions,now);
const sideDelts=rows.find(x=>x.muscle==='side_delts')!;
const chest=rows.find(x=>x.muscle==='chest')!;
assert(sideDelts.currentSets>0,'Side-delt response should detect completed lateral-raise work.');
assert(chest.currentSets>0,'Chest response should detect completed push-up work.');
assert.equal(sideDelts.confidence,'HIGH','Four or more side-delt exposures should yield high response confidence.');
assert(PROGRAM.Monday.blocks.some(b=>b.name==='Band Lateral Raise'),'Push A should contain lateral raises.');
console.log('Phase 22.7 Coach Quality: PASS');
