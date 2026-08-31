import assert from 'node:assert/strict';
import { buildCoachUiState, coachInsightTone } from '../src/coachUiIntegration';

const sessions = [
  { id:'s1', date:Date.now(), day:'PUSH A', totalReps:40, bestSkillSeconds:0, readiness:4, logs:[] },
] as any;

const state = buildCoachUiState(sessions, false);
assert.equal(state.hasSessions, true);
assert.equal(state.hasConversation, false);
assert.ok(state.phaseProgress > 0 && state.phaseProgress <= 1);
assert.ok(state.headline.length > 0);
assert.ok(state.primary);
assert.ok(Array.isArray(state.secondary));
assert.equal(coachInsightTone('GOOD'), 'border-lime-400/20 bg-lime-400/5');
assert.equal(coachInsightTone('ACTION'), 'border-amber-500/20 bg-amber-500/5');
assert.equal(coachInsightTone('WARN'), 'border-rose-500/20 bg-rose-500/5');
assert.equal(coachInsightTone('UNKNOWN'), 'border-line bg-panel');

console.log('phase7 coach UI integration: PASS');
