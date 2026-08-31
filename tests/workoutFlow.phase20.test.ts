import assert from 'node:assert/strict';
import { recommendedEndAction, workoutFlowCopy } from '../src/workoutFlow';

const phase:any={id:'p',type:'OAP_EMPHASIS',week:2,totalWeeks:3,adaptationWeights:{skill:0.3,strength:0.3,hypertrophy:0.3,endurance:0.1},volumeMultiplier:1,intensityMultiplier:1,hypertrophyFloor:3,fatigueBudget:100};
const block:any={id:'oap',name:'OAP',detail:'Singole di qualità',kind:'SKILL_REPS'};
const copy=workoutFlowCopy('Tuesday',phase,block);
assert.equal(copy.phase,'ENFASI OAP');
assert.equal(copy.day,'Martedì');
assert.equal(copy.headline,'Focus: OAP');
assert.equal(recommendedEndAction(true,false),'COACH_REVIEW');
assert.equal(recommendedEndAction(true,true),'MOBILITY');
assert.equal(recommendedEndAction(false,true),'DONE');
console.log('PASS Phase 20 workout flow');
