import { strict as assert } from 'node:assert';
import { PROGRAM } from '../src/program.ts';
import { buildPeriodizedDay, buildPeriodizedWeek } from '../src/programBuilder.ts';
import { phasePlanFor } from '../src/periodizationEngine.ts';

const baseMonday = PROGRAM.Monday;
const w1 = buildPeriodizedDay({ phase: phasePlanFor('ACCUMULATION',1), day:'Monday', goals:['oap','flpu','front_lever_touch','pushups','dips'] });
const w2 = buildPeriodizedDay({ phase: phasePlanFor('ACCUMULATION',2), day:'Monday', goals:['oap','flpu','front_lever_touch','pushups','dips'] });
const w4 = buildPeriodizedDay({ phase: phasePlanFor('ACCUMULATION',4), day:'Monday', goals:['oap','flpu','front_lever_touch','pushups','dips'] });
assert.equal(baseMonday.blocks.length, w1.blocks.length);
assert.notEqual(w1.blocks[1].sets, w2.blocks[1].sets, 'weekly wave must change hypertrophy prescription');
assert.ok((w4.blocks[1].sets||0) < (w2.blocks[1].sets||0), 'week 4 should unload volume');

const oap = buildPeriodizedDay({ phase: phasePlanFor('OAP_EMPHASIS',1), day:'Thursday', goals:['oap'] });
const oapBlock = oap.blocks.find(b=>b.id==='oap')!;
assert.equal(oapBlock.priority,'primary');
assert.ok((oapBlock.sets||0) >= 5);

const fl = buildPeriodizedDay({ phase: phasePlanFor('FL_EMPHASIS',1), day:'Saturday', goals:['flpu','front_lever_touch'] });
assert.equal(fl.blocks.find(b=>b.id==='flpu')?.priority,'primary');

const endurance = buildPeriodizedDay({ phase: phasePlanFor('ENDURANCE_EMPHASIS',3), day:'Friday', goals:['pushups','dips'] });
const emom=endurance.blocks.find(b=>b.id==='pushup-emom-c')!;
assert.ok((emom.minutes||0) >= 11);
assert.match(emom.target,/\/min$/);

const deload = buildPeriodizedDay({ phase: phasePlanFor('DELOAD',1), day:'Friday', goals:['pushups','dips'] });
assert.ok((deload.blocks.find(b=>b.id==='pushup-emom-c')?.minutes||0) <= 6);

const week = buildPeriodizedWeek({phase:phasePlanFor('OAP_EMPHASIS',2),goals:['oap']});
assert.equal(Object.keys(week).length,7);
assert.equal(week.Thursday.title, 'PULL B');

console.log('Phase 3 Program Builder tests: PASS');
