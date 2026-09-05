import type { DayKey, DayProgram, ExerciseBlock, GoalId, PhasePlan, TrainingPriority, TrainingRole } from './types';
import { PROGRAM } from './program';
import { daysForPhaseFocus, phasePlanFor } from './periodizationEngine';
import { progressionEntryForBlock } from './progressionRegistry';

export interface ProgramBuildInput {
  phase: PhasePlan;
  day: DayKey;
  goals?: GoalId[];
}

export interface ProgramWeekInput {
  phase: PhasePlan;
  goals?: GoalId[];
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.max(1,Math.round(n));

/** Small intra-phase wave: enough variation to make weeks meaningfully different,
 * but not so much that session-to-session progression becomes noisy. */
function weekWave(phase:PhasePlan){
  if(phase.type==='DELOAD') return 0.55;
  if(phase.type==='REALIZATION') return 0.72;
  const patterns:Record<string,number[]>={
    ACCUMULATION:[0.92,1.05,1.12,0.82],
    OAP_EMPHASIS:[0.94,1.05,1.12,0.84],
    FL_EMPHASIS:[0.94,1.05,1.12,0.84],
    ENDURANCE_EMPHASIS:[0.95,1.00,1.10],
  };
  return patterns[phase.type]?.[Math.max(0,phase.week-1)] ?? 1;
}

function targetNumbers(target:string){
  const m=target.match(/(\d+)\s*[–-]\s*(\d+)/);
  if(m)return {min:Number(m[1]),max:Number(m[2]),suffix:target.replace(m[0],'').trim()};
  const s=target.match(/(\d+)\/min/);
  if(s)return {min:Number(s[1]),max:Number(s[1]),suffix:'/min'};
  return null;
}

function setRangeTarget(block:ExerciseBlock, factor:number){
  const parsed=targetNumbers(block.target);
  if(!parsed || parsed.suffix==='/min') return block.target;
  const min=Math.max(1,Math.round(parsed.min*factor));
  const max=Math.max(min,Math.round(parsed.max*factor));
  const suffix=parsed.suffix;
  return `${min}–${max}${suffix ? ` ${suffix}` : ''}`.trim();
}

function emomTarget(block:ExerciseBlock, intensityFactor:number){
  const m=block.target.match(/(\d+)\s*[–-]\s*(\d+)\/min/);
  if(!m)return block.target;
  const min=Math.max(1,Math.round(Number(m[1])*intensityFactor));
  const max=Math.max(min,Math.round(Number(m[2])*intensityFactor));
  return `${min}–${max}/min`;
}

function isPrimaryGoalBlock(block:ExerciseBlock, goals:Set<GoalId>){
  const id=block.id;
  if(goals.has('oap') && (id==='oap'||id==='oap-band'||id==='archer-pull')) return true;
  if((goals.has('flpu')||goals.has('front_lever_touch')) && (id==='flpu'||id==='flpu-band'||id==='touch'||id==='touch-band')) return true;
  if(goals.has('pushups') && id.startsWith('pushup')) return true;
  if(goals.has('dips') && id.startsWith('dips')) return true;
  return false;
}

function isEnduranceBlock(block:ExerciseBlock){
  return block.trainingRole==='endurance' || block.kind==='EMOM' || block.id.endsWith('-long') || block.id.includes('density');
}

function transformBlock(block:ExerciseBlock, input:ProgramBuildInput):ExerciseBlock{
  const {phase,day}=input;
  const focus=daysForPhaseFocus(phase)[day] ?? 1;
  const goals=new Set(input.goals || []);
  const wave=weekWave(phase);
  const focusBoost=focus;
  const goalBlock=isPrimaryGoalBlock(block,goals);
  const endurancePhase=phase.type==='ENDURANCE_EMPHASIS';
  const realization=phase.type==='REALIZATION';
  const deload=phase.type==='DELOAD';

  let out:{[K in keyof ExerciseBlock]?:ExerciseBlock[K]}={...block};
  let nextPriority:TrainingPriority|undefined=block.priority;
  let nextRole:TrainingRole|undefined=block.trainingRole;

  // Specific skill/strength work: concentrate volume on the phase target while
  // preserving enough exposure to all other goals.
  if(goalBlock && (block.trainingRole==='skill'||block.trainingRole==='strength')){
    const multiplier=deload?0.60:phase.volumeMultiplier*wave*(phase.type==='OAP_EMPHASIS'&&day==='Thursday'?focusBoost:phase.type==='FL_EMPHASIS'&&(day==='Tuesday'||day==='Saturday')?focusBoost:1);
    if(block.sets) out.sets=round(block.sets*clamp(multiplier,0.60,1.35));
    nextPriority=phase.type==='OAP_EMPHASIS'&&block.id==='oap'?'primary':phase.type==='FL_EMPHASIS'&&(block.id==='flpu'||block.id==='touch')?'primary':block.priority;
    if(phase.type==='REALIZATION') nextRole='skill';
  } else if((block.trainingRole==='skill'||block.trainingRole==='strength') && deload){
    if(block.sets) out.sets=round(block.sets*0.55);
  }

  // Hypertrophy is a protected, low-noise baseline. We vary it only modestly so
  // it remains present across every phase.
  if(block.trainingRole==='hypertrophy'){
    let multiplier=phase.volumeMultiplier*wave;
    if(deload) multiplier=0.55;
    if(realization) multiplier=0.65;
    if(block.sets){
      const scaled=block.sets*clamp(multiplier,0.55,1.15);
      out.sets=scaled>=block.sets*1.04 ? Math.ceil(scaled) : scaled<=block.sets*0.88 ? Math.floor(scaled) : Math.round(scaled);
      out.sets=Math.max(1,out.sets);
    }
    if(phase.type==='OAP_EMPHASIS'||phase.type==='FL_EMPHASIS') nextPriority=block.priority==='primary'?'secondary':block.priority;
    if(realization && block.priority==='primary') nextPriority='support';
    // Keep normal hypertrophy ranges stable; use the wave primarily through set count.
  }

  // Endurance emphasis gets its progression through duration/density rather than
  // pushing every set toward failure.
  if(isEnduranceBlock(block)){
    if(block.kind==='EMOM' && block.minutes){
      const minuteFactor=endurancePhase ? [0.90,1.00,1.15][Math.max(0,phase.week-1)] ?? 1 : wave;
      out.minutes=clamp(Math.round(block.minutes*minuteFactor),5,18);
      const repFactor=endurancePhase ? [0.95,1.00,1.08][Math.max(0,phase.week-1)] ?? 1 : (realization?1.0:0.98);
      out.target=emomTarget(block,repFactor);
      nextRole=endurancePhase?'endurance':block.trainingRole;
    }
    if(block.id.endsWith('-long')){
      const rangeFactor=endurancePhase ? [0.95,1.00,1.10][Math.max(0,phase.week-1)] ?? 1 : (realization?1.0:1);
      out.target=setRangeTarget(block,rangeFactor);
    }
    if(deload && block.kind==='EMOM' && block.minutes) out.minutes=Math.max(5,Math.round(block.minutes*0.55));
  }

  // Realization is lower-volume and more specific: keep primary skill exposures,
  // strip some accessory volume and make endurance tests easier to express cleanly.
  if(realization && block.trainingRole==='skill' && block.priority==='primary'){
    if(block.sets) out.sets=Math.max(1,Math.round(block.sets*0.85));
  }
  if(realization && (block.trainingRole==='hypertrophy'||block.priority==='support')){
    if(block.sets) out.sets=Math.max(1,Math.round(block.sets*0.60));
  }

  out.priority=nextPriority;
  out.trainingRole=nextRole;
  const detailParts=[block.detail];
  const phaseLabel=phase.type.replace('_',' ');
  detailParts.push(`V16 ${phaseLabel} · Week ${phase.week}/${phase.totalWeeks}`);
  if(deload) detailParts.push('Deload: reduce effort, keep technique crisp');
  else if(endurancePhase && isEnduranceBlock(block)) detailParts.push('Endurance emphasis: even output across the full block');
  else if(goalBlock) detailParts.push('Phase-priority exposure');
  out.detail=detailParts.join(' · ');

  const progressionEntry=progressionEntryForBlock(out as ExerciseBlock);
  if(progressionEntry) out.progressionSpecId=block.progressionSpecId || block.id;
  return out as ExerciseBlock;
}

export function buildPeriodizedDay(input:ProgramBuildInput):DayProgram{
  const base=PROGRAM[input.day];
  return {
    ...base,
    subtitle:`${base.subtitle} · ${input.phase.type.replaceAll('_',' ')} W${input.phase.week}`,
    blocks:base.blocks.map(b=>transformBlock(b,input)),
  };
}

export function buildPeriodizedWeek(input:ProgramWeekInput):Record<DayKey,DayProgram>{
  const days=Object.keys(PROGRAM) as DayKey[];
  return days.reduce((acc,day)=>{
    acc[day]=buildPeriodizedDay({phase:input.phase,day,goals:input.goals});
    return acc;
  },{} as Record<DayKey,DayProgram>);
}

