import assert from 'node:assert/strict';
import { buildCoachToolSnapshot, executeCoachTool } from '../src/coachTools.ts';
import type { CoachContext } from '../src/coachAdvisorEngine.ts';

const context = {
  phase: {id:'test',type:'OAP_EMPHASIS',week:2,totalWeeks:4,adaptationWeights:{skill:.3,strength:.3,hypertrophy:.3,endurance:.1,power:0},volumeMultiplier:1,intensityMultiplier:1,hypertrophyFloor:8,fatigueBudget:100},
  goals: [],
  sessions: [],
  insights: [],
  weeklyFatigue: 0,
  recoveryStatus: 'FRESH',
} as unknown as CoachContext;

const snap = buildCoachToolSnapshot(context);
assert.equal(snap.currentPhase.type, 'OAP_EMPHASIS');
assert.ok(Array.isArray(snap.hypertrophy));
const recent = executeCoachTool({name:'get_recent_sessions',arguments:{limit:3}}, context);
assert.equal(recent.ok, true);
const unknown = executeCoachTool({name:'get_weekly_workload'}, context);
assert.equal(unknown.ok, true);
console.log('Phase 18 Coach Tools: PASS');
