import assert from 'node:assert/strict';
import { analyzeFrontLeverTouch } from '../src/frontLeverTouchEngine.ts';
import { estimateGoalResponse } from '../src/athleteResponseEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const base=(id:string,date:number,value:number,q:any='Clean'):SessionSummary=>({id,date,day:'Tuesday',durationSec:1800,readiness:{sleepHours:8,energy:4,wristPain:0,elbowPain:0},logs:[{id:`l-${id}`,sessionId:id,date,day:'Tuesday',exerciseId:'front_lever_touch',exerciseName:'Front Lever Touch',kind:'SKILL_STATIC',status:'complete',result:{seconds:[value],quality:[q]}}],totalReps:0,emomReps:0,bestSkillSeconds:value,sessionFatigue:2});
const sessions=[base('1',1_000,5),base('2',2_000,5.5),base('3',3_000,6),base('4',4_000,6.5)];
const touch=analyzeFrontLeverTouch(sessions);
assert.equal(touch.exposures,4);
assert.ok(touch.qualityPct>=80);
const fake:SessionSummary[]=[...sessions.map((s,i)=>({...s,id:`o${i}`,logs:[{...s.logs[0],exerciseId:'oap',exerciseName:'OAP',result:{reps:[i<2?1:2],sides:['R','L']}}]}))];
const response=estimateGoalResponse('oap',fake);
assert.notEqual(response.direction,'UNKNOWN');
console.log('Phase 20 Production Coach tests: PASS');
