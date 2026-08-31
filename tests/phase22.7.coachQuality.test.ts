import assert from 'node:assert/strict';
import { plannedWeeklyHypertrophy } from '../src/hypertrophyResponseEngine.ts';
import { PROGRAM } from '../src/program.ts';

const planned = Object.fromEntries(plannedWeeklyHypertrophy().map(x=>[x.muscle,x]));
assert(planned.side_delts.plannedSets >= 8, 'Side delts planned volume should reflect all three push days.');
assert(planned.chest.plannedSets > 0, 'Chest planned volume should be non-zero.');
assert(PROGRAM.Monday.blocks.some(b=>b.name === 'Band Lateral Raise'), 'Push A should contain lateral raises.');
console.log('Phase 22.7 Coach Quality: PASS');
