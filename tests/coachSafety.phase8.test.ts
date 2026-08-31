import assert from "node:assert/strict";
import { validateCoachProposal, filterSafeCoachProposals } from "../src/coachSafety.ts";

const baseLog = {
  exerciseId: "pull-up",
  exerciseName: "Pull-Up",
  variantId: "standard",
  variantName: "Standard",
  status: "complete",
  date: 2000,
  sessionId: "s2",
  kind: "standard",
  prescription: { targetRange: "5-8", sets: 3, minutes: 0, restSec: 180, kind: "standard" },
  result: { reps: [8,8,8], rir: 2, fatigue: 3 },
};

const previous = { ...baseLog, date: 1000, sessionId: "s1" };
const session = { id: "s2", date: 2000, logs: [baseLog] };
const history = [{ id: "s1", date: 1000, logs: [previous] }];

const proposal = {
  type: "target",
  exerciseId: "pull-up",
  variantId: "standard",
  title: "Progress Pull-Up",
  detail: "Raise target",
  from: "5-8",
  to: "6-9",
  reason: "Repeated qualifying performance",
  sessionId: "s2",
  confidenceLevel: "HIGH",
  evidence: [],
  warnings: [],
  oldValue: "5-8",
  newValue: "6-9",
};

const analysis = {
  exerciseId: "pull-up",
  variantId: "standard",
  variantName: "Standard",
  action: "PROGRESS",
  confidence: 90,
  qualifies: true,
  streak: 2,
  requiredStreak: 2,
  comparableExposures: 1,
  performanceBand: "TOP",
  reasons: ["Repeated qualifying performance"],
  currentTarget: "5-8",
  proposedTarget: "6-9",
  proposal,
};

assert.equal(validateCoachProposal(analysis, proposal, history, baseLog).decision, "ALLOW");
assert.equal(validateCoachProposal({ ...analysis, confidence: 60 }, proposal, history, baseLog).decision, "BLOCK");
assert.equal(validateCoachProposal(analysis, proposal, [], baseLog).decision, "HOLD");
assert.equal(validateCoachProposal(analysis, proposal, history, { ...baseLog, status: "incomplete" }).decision, "BLOCK");
assert.equal(filterSafeCoachProposals({ sessionId: "s2", analyses: [analysis], proposals: [proposal] }, session, history).length, 1);
assert.equal(filterSafeCoachProposals({ sessionId: "s2", analyses: [{ ...analysis, confidence: 60 }], proposals: [proposal] }, session, history).length, 0);

console.log("coachSafety.phase8: ok");
