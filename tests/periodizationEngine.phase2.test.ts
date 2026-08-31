import { strict as assert } from "node:assert";
import { PROGRAM } from "../src/program.ts";
import {
  buildPeriodizationContext,
  defaultPeriodizationCycle,
  daysForPhaseFocus,
  goalStateFromBaseline,
  nextPhaseType,
  phasePlanFor,
  phaseForCycleWeek,
  phaseTemplates,
  reviewCurrentPhase,
  sessionHypertrophyByMuscle,
  weeklyStimulusBudget,
} from "../src/periodizationEngine.ts";

const cycle = defaultPeriodizationCycle();
assert.equal(cycle.totalWeeks, 16);
assert.deepEqual(cycle.phaseOrder, ["ACCUMULATION","OAP_EMPHASIS","FL_EMPHASIS","ENDURANCE_EMPHASIS","REALIZATION"]);
assert.equal(phaseTemplates().length, 6);

const oap = phasePlanFor("OAP_EMPHASIS", 2);
assert.equal(oap.week, 2);
assert.equal(oap.totalWeeks, 4);
assert.ok(oap.adaptationWeights.skill > oap.adaptationWeights.endurance);
assert.equal(nextPhaseType("OAP_EMPHASIS"), "FL_EMPHASIS");
assert.equal(nextPhaseType("REALIZATION"), undefined);

const week5 = phaseForCycleWeek(cycle, 5);
assert.equal(week5.type, "OAP_EMPHASIS");
assert.equal(week5.week, 1);
const week13 = phaseForCycleWeek(cycle, 13);
assert.equal(week13.type, "ENDURANCE_EMPHASIS");
const week16 = phaseForCycleWeek(cycle, 16);
assert.equal(week16.type, "REALIZATION");

const goals = [
  goalStateFromBaseline("oap", 1, 5),
  goalStateFromBaseline("flpu", 1, 5),
  goalStateFromBaseline("front_lever_touch", 5, 10),
  goalStateFromBaseline("pushups", 60, 100),
  goalStateFromBaseline("dips", 35, 50),
];
const ctx = buildPeriodizationContext(oap, goals);
assert.deepEqual(ctx.primaryGoals, ["oap"]);
assert.ok(ctx.weekTarget.targets.hypertrophy >= ctx.weekTarget.minimum.hypertrophy);

const endurance = phasePlanFor("ENDURANCE_EMPHASIS", 1);
const eBudget = weeklyStimulusBudget(endurance);
assert.ok(eBudget.targets.endurance > eBudget.targets.skill);
assert.ok(eBudget.targets.hypertrophy >= eBudget.minimum.hypertrophy);

const pushBlocks = PROGRAM.Monday.blocks.filter(b => ["pushup-volume","dips-volume-a","diamond"].includes(b.id));
const h = sessionHypertrophyByMuscle(pushBlocks, {"pushup-volume":3,"dips-volume-a":3,"diamond":3});
assert.ok((h.chest || 0) > 0);
assert.ok((h.triceps || 0) > 0);

assert.equal(daysForPhaseFocus(oap).Thursday, 1.25);
assert.equal(daysForPhaseFocus(endurance).Friday, 1.25);
assert.equal(daysForPhaseFocus(phasePlanFor("DELOAD",1)).Monday, 0.55);

const stay = reviewCurrentPhase({phase:oap, goalStates:goals, sessions:[]});
assert.ok(["STAY","EXTEND","REPEAT","ADVANCE","DELOAD"].includes(stay.action));

const deload = reviewCurrentPhase({
  phase: phasePlanFor("OAP_EMPHASIS", 4),
  goalStates: goals,
  sessions: [],
  now: Date.now(),
});
assert.equal(deload.action, "ADVANCE");
assert.ok(deload.nextPhaseId?.includes("fl-1"));

console.log("Phase 2 Periodization Engine tests: PASS");
