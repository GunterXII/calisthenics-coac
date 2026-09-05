import assert from "node:assert/strict";
import {proposeDensityRestProgression} from "../src/methodAwareCoaching.ts";
import type {ExerciseBlock, WorkoutLog} from "../src/types.ts";

const block:ExerciseBlock={
  id:"pushup-volume",
  kind:"PERFORMANCE",
  trainingRole:"hypertrophy",
  priority:"primary",
  trainingMethod:"DENSITY_5X70",
  name:"Push-up",
  detail:"",
  sets:5,
  target:"28",
  rest:120,
  densityProtocol:{referenceMaxFraction:0.70,referenceMaxReps:40,fixedSets:5,initialRestSec:120,minRestSec:30,restStepSec:15,maxDropoffPct:15,minRir:1}
};

const makeLog=(id:string,date:number,rest:number,reps:number[],rir=2,fatigue=2):WorkoutLog=>({
  id,sessionId:id,date,day:"Monday",exerciseId:block.id,exerciseName:block.name,variantId:block.id,kind:block.kind,status:"complete",
  prescription:{version:1,exerciseId:block.id,variantId:block.id,variantName:block.name,name:block.name,kind:block.kind,targetRange:"28",sets:5,restSec:rest,trainingMethod:block.trainingMethod,densityProtocol:block.densityProtocol,capturedAt:date},
  result:{reps,rir,fatigue}
});

const first=makeLog("l1",1000,120,[28,28,28,27,27]);
const second=makeLog("l2",2000,120,[28,28,28,28,28]);
assert.equal(proposeDensityRestProgression(block,second,[first]),null,"one prior exposure should not accidentally qualify");

const qualifyingFirst=makeLog("l1q",1000,120,[28,28,28,28,28]);
const proposal=proposeDensityRestProgression(block,second,[qualifyingFirst]);
assert.ok(proposal);
assert.equal(proposal?.type,"rest");
assert.equal(proposal?.from,"120s");
assert.equal(proposal?.to,"105s");

const tired=makeLog("l3",3000,105,[28,24,22,20,18],0,5);
assert.equal(proposeDensityRestProgression({...block,rest:105},tired,[second]),null,"fatigue/drop-off blocks density progression");

console.log("method-aware coaching phase 9: ok");
