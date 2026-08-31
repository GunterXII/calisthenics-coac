import assert from 'node:assert/strict';
import { weeklyStimulusActual, compareStimulusToBudget, adaptiveDecision } from '../src/adaptiveStimulusEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const now = Date.now();
const session: SessionSummary = {
  id:'s1', date:now, day:'Tuesday', durationSec:3600,
  readiness:{energy:4,sleepHours:8}, totalReps:24, emomReps:0, bestSkillSeconds:0,
  logs:[
    {id:'oap',sessionId:'s1',date:now,day:'Tuesday',exerciseId:'oap',exerciseName:'OAP',kind:'SKILL_REPS',status:'complete',prescription:{version:1,exerciseId:'oap',variantId:'oap',variantName:'OAP',name:'OAP',kind:'SKILL_REPS',targetRange:'1–2',sets:4,restSec:180,capturedAt:now,progressionMode:'skill_quality',fatigueCost:5,muscleGroups:['lats','upper_back','biceps','forearms','core'],effectiveSetWeight:.35,gripDemand:'high'},result:{reps:[1,1,1,1],sides:['R','L','R','L'],rir:2,fatigue:3}},
    {id:'curl',sessionId:'s1',date:now,day:'Tuesday',exerciseId:'curl-a',exerciseName:'Curl',kind:'ACCESSORY',status:'complete',prescription:{version:1,exerciseId:'curl-a',variantId:'curl-a',variantName:'Curl',name:'Curl',kind:'ACCESSORY',targetRange:'10–15',sets:3,restSec:90,capturedAt:now,progressionMode:'hypertrophy_reps',fatigueCost:2,muscleGroups:['biceps','forearms'],effectiveSetWeight:1,gripDemand:'low'},result:{reps:[12,12,11],rir:2,fatigue:3,quality:['Clean','Clean','Clean']}},
  ]
};

const actual = weeklyStimulusActual([session], now + 1000);
assert.ok(actual.adaptations.skill.actual > 0);
assert.ok(actual.hypertrophyByMuscle.biceps.productiveSets > 0);
const compared = compareStimulusToBudget(actual, {skill:1,strength:1,hypertrophy:5,endurance:1,power:1});
assert.equal(compared.adaptations.hypertrophy.target,5);
const d = adaptiveDecision(compared,'skill',100,false);
assert.ok(['PROGRESS_PRIMARY','ADD_HYPERTROPHY','HOLD','REDUCE_SECONDARY'].includes(d.action));
console.log('Phase 10 adaptive stimulus tests: PASS');
