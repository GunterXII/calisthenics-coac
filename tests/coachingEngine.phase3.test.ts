import { strict as assert } from "node:assert";
import { decideExposure, isSamePrescription, criteriaForBlock } from "../src/coachingEngine.ts";
import { PROGRAM } from "../src/program.ts";

const push = PROGRAM.Wednesday.blocks.find(b => b.id === "pushup-emom-b")!;
const close = PROGRAM.Thursday.blocks.find(b => b.id === "close-chin")!;
const ready = {energy:5,sleepHours:8,wristPain:0,elbowPain:0};

const rec=(result:any,block:any=push,readiness:any=ready)=>({exerciseId:block.id,status:"complete",result,session:{readiness,date:Date.now()},prescription:{variantId:block.id,targetRange:block.target,sets:block.sets,minutes:block.minutes,restSec:block.rest,kind:block.kind}});

assert.equal(decideExposure(push,rec({emom:[10,10,10,10,10,10,10,10,10,10],rir:2}),criteriaForBlock(push)).performanceBand,"IN_RANGE");
assert.equal(decideExposure(push,rec({emom:[14,14,14,14,14,14,14,14,14,14],rir:2}),criteriaForBlock(push)).decision,"PROGRESS");
assert.equal(decideExposure(push,rec({emom:[14,14,10,10,10,10,10,10,6,9],rir:2}),criteriaForBlock(push)).decision,"HOLD");
assert.equal(decideExposure(close,rec({emom:[6,6,5,5,5,5,4,4,5,5],rir:1},close),criteriaForBlock(close)).decision,"HOLD");
assert.equal(decideExposure(close,rec({emom:[4,4,4,4,4,4,4,4,4,4],rir:1},close),criteriaForBlock(close)).performanceBand,"BELOW_RANGE");
const recoveryDecision=decideExposure(push,rec({emom:[10,10,10,10,10,10,10,10,10,10],rir:2},push,{energy:2,sleepHours:5,wristPain:0,elbowPain:0}),criteriaForBlock(push));
assert.equal(recoveryDecision.decision,"REDUCE_VOLUME");

const a:any={exerciseId:"x",status:"complete",result:{},prescription:{variantId:"v1",targetRange:"8–12",sets:3,minutes:null,restSec:120,kind:"PERFORMANCE"}};
const b:any={exerciseId:"x",status:"complete",result:{},prescription:{variantId:"v1",targetRange:"8–12",sets:3,minutes:null,restSec:120,kind:"PERFORMANCE"}};
const c:any={...b,prescription:{...b.prescription,targetRange:"10–14"}};
assert.equal(isSamePrescription(a,b),true);
assert.equal(isSamePrescription(a,c),false);

console.log("Phase 3 Coach Engine tests: PASS");
