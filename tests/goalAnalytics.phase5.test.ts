import { strict as assert } from 'node:assert';
import { analyzeAllGoals, analyzeGoal, goalStateFromAnalytics } from '../src/goalAnalyticsEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const session=(id:string,date:number,logs:any[]):SessionSummary=>({id,date,day:'Friday',durationSec:1800,readiness:{},logs,totalReps:0,emomReps:0,bestSkillSeconds:0});

const sessions:SessionSummary[] = [
  session('s1',1,[
    {id:'l1',sessionId:'s1',date:1,day:'Friday',exerciseId:'pushup-long',exerciseName:'Push-up Long Set',kind:'PERFORMANCE',status:'complete',result:{reps:[40],quality:['Clean']}},
    {id:'l2',sessionId:'s1',date:1,day:'Friday',exerciseId:'oap',exerciseName:'One Arm Pull-up',kind:'SKILL_REPS',status:'complete',result:{reps:[1],quality:['Clean']}},
  ]),
  session('s2',2,[
    {id:'l3',sessionId:'s2',date:2,day:'Friday',exerciseId:'pushup-long',exerciseName:'Push-up Long Set',kind:'PERFORMANCE',status:'complete',result:{reps:[55],quality:['Clean']}},
    {id:'l4',sessionId:'s2',date:2,day:'Friday',exerciseId:'oap',exerciseName:'One Arm Pull-up',kind:'SKILL_REPS',status:'complete',result:{reps:[2],quality:['Clean']}},
    {id:'l5',sessionId:'s2',date:2,day:'Friday',exerciseId:'dips-long',exerciseName:'Dips Long Set',kind:'PERFORMANCE',status:'complete',result:{reps:[30],quality:['Clean']}},
  ]),
  session('s3',3,[
    {id:'l6',sessionId:'s3',date:3,day:'Friday',exerciseId:'pushup-long',exerciseName:'Push-up Long Set',kind:'PERFORMANCE',status:'complete',result:{reps:[68],quality:['Clean']}},
    {id:'l7',sessionId:'s3',date:3,day:'Friday',exerciseId:'oap',exerciseName:'One Arm Pull-up',kind:'SKILL_REPS',status:'complete',result:{reps:[0,3],quality:['Lost position','Clean']}},
    {id:'l8',sessionId:'s3',date:3,day:'Friday',exerciseId:'touch',exerciseName:'Front Touch',kind:'SKILL_STATIC',status:'complete',result:{seconds:[7],quality:['Clean']}},
    {id:'l9',sessionId:'s3',date:3,day:'Friday',exerciseId:'dips-long',exerciseName:'Dips Long Set',kind:'PERFORMANCE',status:'complete',result:{reps:[38],quality:['Clean']}},
  ]),
];

const pushups=analyzeGoal('pushups',sessions);
assert.equal(pushups.best,68);
assert.equal(pushups.target,100);
assert.ok(pushups.trendPct>0);
assert.equal(pushups.qualityCoveragePct,100);

const oap=analyzeGoal('oap',sessions);
assert.equal(oap.best,3);
assert.equal(oap.exposures,3);
assert.ok(oap.current===3);

const fl=analyzeGoal('front_lever_touch',sessions);
assert.equal(fl.best,7);
assert.equal(fl.target,8);
assert.ok(fl.repeatableBest>0);
assert.ok(fl.qualityAdjustedBest>0);

const all=analyzeAllGoals(sessions);
assert.equal(all.length,5);
const state=goalStateFromAnalytics(pushups);
assert.equal(state.id,'pushups');
assert.ok(state.current===68);

console.log('Phase 5 Goal Analytics tests: PASS');
