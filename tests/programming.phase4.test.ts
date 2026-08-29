import { strict as assert } from "node:assert";
import { PROGRAM } from "../src/program.ts";

const find=(day:any,id:string)=>PROGRAM[day].blocks.find((b:any)=>b.id===id)!;

assert.equal(find("Thursday","oap-band").defaultBand,"Red 50–125 lb");
assert.ok(find("Thursday","oap-band").bandOptions?.includes("Red 50–125 lb"));
assert.equal(find("Saturday","flpu-band").defaultBand,"Red 50–125 lb");
assert.ok(find("Saturday","flpu-band").bandOptions?.includes("Red 50–125 lb"));
assert.equal(find("Thursday","leg-raise").name,"Dragon Flag");
assert.equal(find("Thursday","leg-raise").rest,150);
assert.equal(find("Tuesday","curl-a").rest,120);
assert.equal(find("Friday","lat-c").rest,120);
assert.equal(find("Wednesday","pushup-emom-b").target,"10–12/min");
assert.equal(find("Thursday","close-chin").target,"5–7/min");
assert.equal(find("Saturday","close-pull").target,"5–7/min");
assert.equal(find("Friday","pushup-long").target,"25–40");
assert.equal(find("Friday","dips-long").target,"25–40");

console.log("Phase 4 Programming tests: PASS");
