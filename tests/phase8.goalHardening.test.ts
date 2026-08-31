import { strict as assert } from 'node:assert';
import { analyzeGoal, DEFAULT_GOAL_DEFINITIONS } from '../src/goalAnalyticsEngine.ts';
import { phasePlanFor, goalStateFromBaseline } from '../src/periodizationEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const s=(id:string,date:number,logs:any[]):SessionSummary=>({id,date,day:'Tuesday',durationSec:1200,readiness:{},logs,totalReps:0,emomReps:0,bestSkillSeconds:0});
const sessions=[
 s('a',1,[{id:'1',sessionId:'a',date:1,day:'Tuesday',exerciseId:'touch',exerciseName:'Front Lever Touch',kind:'SKILL_STATIC',status:'complete',result:{seconds:[7],quality:['Clean']}}]),
 s('b',2,[{id:'2',sessionId:'b',date:2,day:'Tuesday',exerciseId:'touch',exerciseName:'Front Lever Touch',kind:'SKILL_STATIC',status:'complete',result:{seconds:[8],quality:['Clean']}}]),
 s('c',3,[{id:'3',sessionId:'c',date:3,day:'Tuesday',exerciseId:'touch',exerciseName:'Front Lever Touch',kind:'SKILL_STATIC',status:'complete',result:{seconds:[6],quality:['Shaky']}}]),
];
const def=DEFAULT_GOAL_DEFINITIONS.find(x=>x.id==='front_lever_touch');
assert.ok(def);
assert.equal(def.label,'Front Lever Touch');
assert.equal(def.target,8);
const snap=analyzeGoal('front_lever_touch',sessions);
assert.equal(snap.best,8);
assert.ok(snap.repeatableBest>=7);
assert.ok(snap.qualityAdjustedBest>=7);
assert.equal(snap.target,8);
assert.equal(snap.goal.id,'front_lever_touch');
const touchPhase=phasePlanFor('FL_EMPHASIS',2);
assert.ok(touchPhase);
const state=goalStateFromBaseline('front_lever_touch',6,8);
assert.equal(state.id,'front_lever_touch');
console.log('Phase 8 Goal Hardening tests: PASS');
