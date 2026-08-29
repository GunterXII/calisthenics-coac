import assert from "node:assert/strict";
import {PROGRAM} from "../src/program.ts";
import {validateProgramWeek, prettyMuscle} from "../src/programValidation.ts";

const report=validateProgramWeek(PROGRAM);
assert.equal(report.days.length,7);
assert.ok(report.score>=0&&report.score<=100);
assert.ok(report.muscleTotals.lats>0);
assert.ok(report.muscleTotals.chest>0);
assert.ok(report.days.some(d=>d.gripScore>0));
assert.ok(report.strengths.length>=1);
assert.equal(prettyMuscle("front_delts"),"Front Delts");
assert.ok(report.signals.every(s=>s.severity==="OK"||s.severity==="WATCH"||s.severity==="HIGH"));
console.log("Phase 9 Program Validation tests: PASS");
