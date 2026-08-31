import { strict as assert } from "node:assert";
import { PROGRAM } from "../src/program.ts";
import {
  trainingProfileForBlock,
  stimulusProfileForBlock,
  sessionStimulusByAdaptation,
  sessionStimulusByMuscleAndAdaptation,
} from "../src/trainingModel.ts";

const oap = PROGRAM.Thursday.blocks.find(b => b.id === "oap")!;
const assistedOap = PROGRAM.Thursday.blocks.find(b => b.id === "oap-band")!;
const flpu = PROGRAM.Saturday.blocks.find(b => b.id === "flpu")!;
const pushup = PROGRAM.Monday.blocks.find(b => b.id === "pushup-volume")!;
const pushupEmom = PROGRAM.Wednesday.blocks.find(b => b.id === "pushup-emom-b")!;

const oapStimulus = stimulusProfileForBlock(oap);
const assistedStimulus = stimulusProfileForBlock(assistedOap);
const flpuStimulus = stimulusProfileForBlock(flpu);
const pushStimulus = stimulusProfileForBlock(pushup);
const emomStimulus = stimulusProfileForBlock(pushupEmom);

assert.equal(oapStimulus.skill, 1);
assert.ok(oapStimulus.strength > oapStimulus.hypertrophy);
assert.ok(assistedStimulus.hypertrophy > oapStimulus.hypertrophy);
assert.equal(flpuStimulus.skill, 1);
assert.ok(pushStimulus.hypertrophy > pushStimulus.endurance);
assert.ok(emomStimulus.endurance > emomStimulus.hypertrophy);

const adaptation = sessionStimulusByAdaptation(
  [oap, assistedOap, pushup, pushupEmom],
  { oap: 6, "oap-band": 3, "pushup-volume": 3, "pushup-emom-b": 10 },
);
assert.ok(adaptation.skill > 0);
assert.ok(adaptation.hypertrophy > 0);
assert.ok(adaptation.endurance > 0);
assert.ok(adaptation.fatigue > 0);

const muscle = sessionStimulusByMuscleAndAdaptation(
  [oap, pushup],
  { oap: 6, "pushup-volume": 3 },
);
assert.ok((muscle.lats?.skill || 0) > 0);
assert.ok((muscle.lats?.hypertrophy || 0) > 0);
assert.ok((muscle.chest?.hypertrophy || 0) > 0);

const profile = trainingProfileForBlock(oap);
assert.equal(profile.fatigueCost, 5);
assert.equal(profile.stimulus.fatigue, 1);

console.log("Phase 1 Training Model tests: PASS");
