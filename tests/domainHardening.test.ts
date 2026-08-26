import { strict as assert } from "node:assert";
import { getProgressionSpec, getProgressionLadder, PROGRAM } from "../src/program.ts";
import { progressionSpecForBlock, nextTargetFromSpec } from "../src/coachingEngine.ts";
import { normalizeBackupData, acceptCoachProposalAtomically, getCoachProposals, getProgramOverrides, getVariants, getCoachDecisions } from "../src/storage.ts";
import { exerciseExposureKey, exerciseExposureKeyString, type WorkoutLog, type SessionSummary } from "../src/types.ts";

const key=exerciseExposureKey("touch","wide-front-lever-touch");
assert.equal(exerciseExposureKeyString(key),"touch::wide-front-lever-touch");
assert.equal(getProgressionSpec("touch")?.targetMaxIncrement,1);
assert.equal(getProgressionLadder("pike")[0].id,"pike");
const touchBlock=PROGRAM.Tuesday.blocks.find(b=>b.id==="touch")!;
const touchSpec=progressionSpecForBlock(touchBlock);
assert.equal(nextTargetFromSpec("2–4 sec",touchSpec,touchBlock.kind),"3–5 sec");

const legacy={id:"l1",date:1,day:"Tuesday",exerciseId:"touch",exerciseName:"Front Touch",kind:"SKILL_STATIC",status:"complete",result:{seconds:[4,4,4,4]}} as unknown as WorkoutLog;
assert.equal("sessionId" in legacy,false);
// Migration contract: normalized storage assigns a deterministic legacy session id.
assert.equal(`legacy:${legacy.id}`,"legacy:l1");
const backup=normalizeBackupData({schemaVersion:9,logs:[legacy],sessions:[],variants:{touch:{exerciseId:"touch",variantName:"Front Touch",status:"active",updatedAt:1,lastCoachAction:"none"}}});
assert.equal(backup.schemaVersion,10);
assert.equal((backup.logs as WorkoutLog[])[0].sessionId,"legacy:l1");
assert.equal((backup.logs as WorkoutLog[])[0].variantId,"touch");

console.log("Domain hardening tests: PASS");


class MemoryStorage { private m=new Map<string,string>(); getItem(k:string){return this.m.get(k)??null} setItem(k:string,v:string){this.m.set(k,v)} removeItem(k:string){this.m.delete(k)} }
(globalThis as unknown as {localStorage:MemoryStorage}).localStorage=new MemoryStorage();
const proposal={id:"p1",date:1,type:"target" as const,exerciseId:"touch",title:"Progress target",detail:"",from:"2–4 sec",to:"3–5 sec",reason:"Target ceiling",status:"pending" as const,sessionId:"s1"};
(globalThis.localStorage as MemoryStorage).setItem("cc-v15-coach-proposals",JSON.stringify([proposal]));
const override={exerciseId:"touch",variantId:"touch",name:"Front Touch",target:"3–5 sec",updatedAt:2};
acceptCoachProposalAtomically("p1",override,undefined,{type:"program",exerciseId:"touch",title:"accepted",detail:"ok",from:"2–4 sec",to:"3–5 sec"});
assert.equal(getCoachProposals()[0].status,"accepted");
assert.equal(getProgramOverrides().touch.target,"3–5 sec");
const before=JSON.stringify(getCoachDecisions());
const again=acceptCoachProposalAtomically("p1",override,undefined,{type:"program",exerciseId:"touch",title:"accepted again",detail:"ok",from:"2–4 sec",to:"3–5 sec"});
assert.equal(again.changed,false);
assert.equal(JSON.stringify(getCoachDecisions()),before);
console.log("Atomic proposal tests: PASS");
