import assert from 'node:assert/strict';
import {PROGRAM} from '../src/program.ts';
import {buildAdaptivePeriodizedDay} from '../src/adaptiveProgramEngine.ts';
import {phasePlanFor} from '../src/periodizationEngine.ts';
import {buildPeriodizedDay} from '../src/programBuilder.ts';
import {displayBlockDetail,coachNoteForBlock} from '../src/prescriptionText.ts';
import type {SessionSummary} from '../src/types.ts';

const now=Date.now();
const readiness={sleepHours:8,energy:2,wristPain:0,elbowPain:0,weightKg:80};
function session(id:string,exerciseId:string,day:any,detail:any):SessionSummary{
  const block=Object.values(PROGRAM).flatMap(p=>p.blocks).find(b=>b.id===exerciseId)!;
  return {id,date:now-86400000,day,durationSec:3600,readiness,logs:[{id,sessionId:id,date:now-86400000,day,exerciseId,exerciseName:block.name,kind:block.kind,status:'complete',prescription:{version:1,exerciseId,variantId:exerciseId,variantName:block.name,name:block.name,kind:block.kind,targetRange:block.target,sets:block.sets,minutes:block.minutes,restSec:block.rest,capturedAt:now-86400000},result:detail}],totalReps:100,emomReps:0,bestSkillSeconds:10};
}

const monday=buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[],now);
const density=monday.program.blocks.find(b=>b.id==='pushup-volume')!;
assert.equal(density.sets,5);
assert.equal(density.target,'28–28');
assert.equal(displayBlockDetail(density,x=>x||''),'dose fissa · riduci il recupero solo quando la performance è stabile');
assert.equal(coachNoteForBlock(density,x=>x||''),'Mantieni la prescrizione');

const tired=buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[
  session('s1','pushup-volume','Monday',{reps:[8,8,8],rir:0,quality:['Shaky','Shaky','Shaky']})
],now);
const tiredDensity=tired.program.blocks.find(b=>b.id==='pushup-volume')!;
assert.equal(tired.decisions.find(d=>d.exerciseId==='pushup-volume')?.action,'HOLD_DENSITY');
assert.equal(tiredDensity.sets,5);
assert.equal(tiredDensity.coachNote,'Mantieni la densità · recupero invariato');
assert.equal(displayBlockDetail(tiredDensity,x=>x||'').includes('5 ×'),false);

const periodizedBase=buildPeriodizedDay({phase:phasePlanFor('ACCUMULATION',2),day:'Tuesday',goals:['pushups']}).blocks.find(b=>b.id==='pullup')!;
const tiredEmom=buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Tuesday',['pushups'],[
  session('s2','pullup','Tuesday',{emom:[2,2,2,2,2],rir:0,quality:['Shaky','Shaky','Shaky','Shaky','Shaky']})
],now);
const emom=tiredEmom.program.blocks.find(b=>b.id==='pullup')!;
assert.ok((emom.minutes||0)<(periodizedBase.minutes||0));
assert.equal(displayBlockDetail(emom,x=>x||'').includes('min EMOM'),false);
assert.equal(emom.coachNote,`Densità ridotta oggi · ${emom.minutes} min`);

const normal=tiredEmom.program.blocks.find(b=>b.id==='curl-a')!;
assert.equal(displayBlockDetail({...normal,detail:'3 × 10–15 • RIR 1–2 • strict ROM'},x=>x||''),'RIR 1–2 • strict ROM');

console.log('Phase 22.9 prescription/UI consistency tests: PASS');
