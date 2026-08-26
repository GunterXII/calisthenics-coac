import { strict as assert } from "node:assert";
import { evaluateProgression, criteriaForBlock, progressionStreak, analyzeReadiness } from "../src/coachingEngine.ts";
import { PROGRAM } from "../src/program.ts";
import type { CoachingLogRecord } from "../src/coachingEngine.ts";

const touch = PROGRAM.Tuesday.blocks.find(b => b.id === "touch")!;
const emom = PROGRAM.Wednesday.blocks.find(b => b.id === "pushup-emom-b")!;
const oap = PROGRAM.Thursday.blocks.find(b => b.id === "oap")!;
const clean = ["Clean","Clean","Clean","Clean"] as const;

function record(blockId:string, result:CoachingLogRecord["result"], readiness={energy:5,sleepHours:8,wristPain:0,elbowPain:0}):CoachingLogRecord {
  return { exerciseId:blockId, status:"complete", result, session:{ readiness, date:Date.now() } };
}

const touchCriteria=criteriaForBlock(touch);
assert.equal(evaluateProgression(touch, record("touch", {seconds:[4,4,4,4],quality:[...clean],rir:2}), touchCriteria).qualifies, true);
assert.equal(evaluateProgression(touch, record("touch", {seconds:[4,4,4,4],rir:2}), touchCriteria).qualifies, false, "Unknown quality must not pass clean criterion");

const emomCriteria=criteriaForBlock(emom);
assert.equal(evaluateProgression(emom, record("pushup-emom-b", {emom:[14,14,10,10,10,10,10,10,6,9],rir:2}), emomCriteria).qualifies, false, "Unstable EMOM must not qualify");
assert.equal(evaluateProgression(emom, record("pushup-emom-b", {emom:[12,12,12,12,12,12,12,12,12,12],rir:2}), emomCriteria).qualifies, true, "Stable EMOM should qualify");

const oapCriteria=criteriaForBlock(oap);
assert.equal(evaluateProgression(oap, record("oap", {reps:[2,2,2,2,2,2],sides:["R","L","R","L","R","L"],quality:["Clean","Clean","Clean","Clean","Clean","Clean"],rir:2}), oapCriteria).qualifies, true);
assert.equal(evaluateProgression(oap, record("oap", {reps:[2,2,2,1,1,1],sides:["R","R","R","L","L","L"],quality:["Clean","Clean","Clean","Clean","Clean","Clean"],rir:2}), oapCriteria).qualifies, false, "Both sides must qualify");

const poorReadiness=analyzeReadiness({energy:2,sleepHours:5,wristPain:0,elbowPain:0});
assert.equal(poorReadiness.allowProgression, false);
const missingReadiness=analyzeReadiness({});
assert.equal(missingReadiness.allowProgression, false, "Missing readiness must not authorize progression");

const q1=record("touch", {seconds:[4,4,4,4],quality:[...clean],rir:2});
const q2=record("touch", {seconds:[4,4,4,4],quality:[...clean],rir:2});
assert.equal(progressionStreak(touch,[q1,q2],touchCriteria),2);

console.log("Coaching Engine tests: PASS");
