import assert from "node:assert/strict";
import {nextTargetFromSpec,progressionSpecForBlock} from "../src/coachingEngine.ts";
import type {ExerciseBlock} from "../src/types.ts";

const block:ExerciseBlock={
 id:"touch",kind:"SKILL_STATIC",trainingRole:"skill",priority:"primary",trainingMethod:"STATIC_HOLD",
 name:"Front Touch",detail:"",sets:4,target:"2–4 sec",rest:240,previousMode:"seconds"
};
const spec=progressionSpecForBlock(block);
assert.equal(nextTargetFromSpec("2–4 sec",spec,block.kind),"3–5 sec");
assert.equal(nextTargetFromSpec("4–5 sec",spec,block.kind),"5–6 sec");

const assisted:ExerciseBlock={
 ...block,id:"touch-band",name:"Assisted Front Touch",sets:3,target:"6–10 sec"
};
const assistedSpec=progressionSpecForBlock(assisted);
assert.equal(nextTargetFromSpec("6–10 sec",assistedSpec,assisted.kind),"7–11 sec");

console.log("static skill phase 10: ok");
