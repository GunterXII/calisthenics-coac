import assert from 'node:assert/strict';
import { defaultPeriodizationCycle, phaseForCycleWeek } from '../src/periodizationEngine';
import { analyzeAllGoals } from '../src/goalAnalyticsEngine';
import { allSkillReadiness } from '../src/skillPerformanceEngine';
import type { SessionSummary } from '../src/types';

const session=(id:string,date:number,logs:any[],fatigue=2):SessionSummary=>({
  id,date,day:'Thursday',durationSec:1800,readiness:{qualifies:true,qualityKnown:true,stabilityScore:1,performanceBand:'GOOD',reasons:[],},
  logs:logs.map((l:any)=>({...l,date,sessionId:id,status:l.status||'complete'})),totalReps:0,emomReps:0,bestSkillSeconds:0
});
const cycle=defaultPeriodizationCycle();
assert.equal(cycle.totalWeeks,16);
assert.equal(phaseForCycleWeek(cycle,4).type,'DELOAD');
assert.equal(phaseForCycleWeek(cycle,8).type,'DELOAD');
assert.equal(phaseForCycleWeek(cycle,12).type,'DELOAD');
assert.equal(phaseForCycleWeek(cycle,16).type,'REALIZATION');
const sessions:SessionSummary[]=[];
for(let i=0;i<4;i++) sessions.push(session('s'+i,i+1,[
  {exerciseId:'oap',exerciseName:'OAP',kind:'SKILL_REPS',result:{reps:[1],quality:['Clean'],rir:2,fatigue:2}},
  {exerciseId:'touch',exerciseName:'Front Lever Touch',kind:'SKILL_STATIC',result:{seconds:[5+i],quality:['Clean'],rir:2,fatigue:2}},
  {exerciseId:'pushup-long',exerciseName:'Push-up',kind:'PERFORMANCE',result:{reps:[50+i*5],quality:['Clean'],rir:2,fatigue:2}},
  {exerciseId:'dips-long',exerciseName:'Dips',kind:'PERFORMANCE',result:{reps:[30+i*3],quality:['Clean'],rir:2,fatigue:2}},
]));
const goals=analyzeAllGoals(sessions);
assert.equal(goals.length,5);
assert.ok(goals.find(g=>g.goal.id==='front_lever_touch')!.best===8);
const readiness=allSkillReadiness(sessions);
assert.equal(readiness.length,3);
assert.ok(readiness.some(x=>x.goalId==='front_lever_touch'));
console.log('Phase 19 athlete journey simulation PASS');
