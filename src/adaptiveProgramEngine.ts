import type {DayKey, DayProgram, ExerciseBlock, GoalId, PhasePlan, SessionSummary, WorkoutLog} from './types';
import {analyzeReadiness} from './coachingEngine';
import {trainingProfileForBlock} from './trainingModel';
import {recoveryForMuscle, weeklyWorkload} from './workloadEngine';
import {buildPeriodizedDay} from './programBuilder';

/**
 * Phase 4 — adaptive programming layer.
 *
 * The builder owns the planned prescription; this layer only decides bounded
 * session-to-session volume/density adjustments from observed evidence.
 * It never changes exercise identity, target range, band, or historical logs.
 */
export type AdaptiveAdjustmentAction =
  | 'NONE' | 'PROTECT' | 'ADD_VOLUME' | 'ADD_DENSITY'
  | 'REDUCE_VOLUME' | 'REDUCE_DENSITY' | 'HOLD';

export interface AdaptiveBlockDecision {
  exerciseId:string;
  action:AdaptiveAdjustmentAction;
  setsDelta:number;
  minutesDelta:number;
  reason:string;
  confidence:number;
  evidenceExposures:number;
}

export interface AdaptiveDayPlan {
  day:DayKey;
  program:DayProgram;
  decisions:AdaptiveBlockDecision[];
  weeklyFatigue:number;
  overallRecovery:ReturnType<typeof weeklyWorkload>['overallRecovery'];
}

const DAY=86400000;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number,d=2)=>Number(n.toFixed(d));

function isEndurance(b:ExerciseBlock){
  return b.trainingRole==='endurance'||b.kind==='EMOM'||b.id.endsWith('-long')||b.id.includes('density');
}
function isPrimarySkill(b:ExerciseBlock){
  return b.priority==='primary'&&(b.trainingRole==='skill'||b.progressionMode==='skill_quality'||b.progressionMode==='static_hold');
}
function isPrimary(b:ExerciseBlock){return b.priority==='primary';}
function capSets(b:ExerciseBlock){
  if(b.trainingRole==='skill') return 6;
  if(b.trainingRole==='strength') return 5;
  if(b.trainingRole==='hypertrophy') return 5;
  return 4;
}
function parseTarget(target:string):{min:number;max:number;kind:'reps'|'seconds'|'emom'}|undefined{
  const em=target.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\/min/i);
  if(em)return {min:Number(em[1]),max:Number(em[2]),kind:'emom'};
  const sec=target.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*sec/i);
  if(sec)return {min:Number(sec[1]),max:Number(sec[2]),kind:'seconds'};
  const rep=target.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(rep)return {min:Number(rep[1]),max:Number(rep[2]),kind:'reps'};
  return undefined;
}
function comparable(a:WorkoutLog,b:WorkoutLog){
  return a.exerciseId===b.exerciseId
    &&String(a.variantId||a.exerciseId)===String(b.variantId||b.exerciseId)
    &&a.status==='complete'&&b.status==='complete'
    &&(!a.prescription||!b.prescription||(
      a.prescription.targetRange===b.prescription.targetRange
      &&(a.prescription.sets??null)===(b.prescription.sets??null)
      &&(a.prescription.minutes??null)===(b.prescription.minutes??null)
      &&(a.prescription.restSec??null)===(b.prescription.restSec??null)
      &&a.prescription.kind===b.prescription.kind
    ));
}
function recentComparable(block:ExerciseBlock,sessions:SessionSummary[],now:number){
  const logs=sessions.flatMap(s=>s.logs||[])
    .filter(l=>l.date<now&&l.exerciseId===block.id&&l.status==='complete'&&!l.skipped)
    .sort((a,b)=>b.date-a.date);
  const out:WorkoutLog[]=[];
  for(const log of logs){
    if(out.length===0||comparable(out[0],log)) out.push(log);
    if(out.length>=4)break;
  }
  return out.reverse();
}
function numericAverage(log:WorkoutLog,target:{kind:'reps'|'seconds'|'emom'}){
  const values=target.kind==='emom'?log.result.emom||[]:target.kind==='seconds'?log.result.seconds||[]:log.result.reps||[];
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined;
}
function quality(log:WorkoutLog){
  const q=log.result.quality||[];
  if(!q.length)return 1;
  return q.reduce((s,x)=>s+(x==='Clean'?1:x==='Shaky'?0.5:0),0)/q.length;
}
function performanceEvidence(block:ExerciseBlock,logs:WorkoutLog[],now:number){
  const target=parseTarget(block.target);
  if(!target||logs.length<2)return {known:false,top:false,low:false,stable:false};
  const avgs=logs.map(l=>numericAverage(l,target)).filter((x):x is number=>x!==undefined);
  if(avgs.length<2)return {known:false,top:false,low:false,stable:false};
  const last=avgs[avgs.length-1];
  const top=avgs.every(v=>v>=target.max*0.97)&&logs.every(l=>quality(l)>=0.75)&&(logs.every(l=>l.result.rir===undefined||l.result.rir>=1));
  const low=last<target.min*0.90;
  const stable=avgs.every(v=>Math.abs(v-last)<=Math.max(target.max*0.15,1));
  return {known:true,top,low,stable,ageDays:(now-logs[logs.length-1].date)/DAY};
}
function readinessTrend(sessions:SessionSummary[],now:number){
  const recent=sessions.filter(s=>s.date<now&&s.date>=now-14*DAY).sort((a,b)=>a.date-b.date).slice(-5);
  if(!recent.length)return {score:75,known:false};
  const scores=recent.map(s=>analyzeReadiness(s.readiness).score);
  return {score:scores.reduce((a,b)=>a+b,0)/scores.length,known:true};
}
function muscleRecovery(block:ExerciseBlock,sessions:SessionSummary[],now:number){
  const profile=trainingProfileForBlock(block);
  const values=profile.muscleGroups.map(m=>recoveryForMuscle(m,sessions,now));
  return values.length?values.reduce((a,b)=>a.recoveryPct<b.recoveryPct?a:b):undefined;
}
function decision(block:ExerciseBlock,phase:PhasePlan,sessions:SessionSummary[],now:number):AdaptiveBlockDecision{
  const report=weeklyWorkload(sessions,now);
  const profile=trainingProfileForBlock(block);
  const logs=recentComparable(block,sessions,now);
  const evidence=performanceEvidence(block,logs,now);
  const readiness=readinessTrend(sessions,now);
  const recovery=muscleRecovery(block,sessions,now);
  const lowRecovery=Boolean(recovery&&recovery.recoveryPct<60);
  const highFatigue=report.overallRecovery==='HIGH_FATIGUE'||report.totalFatigueLoad>phase.fatigueBudget*1.10;
  const fresh=report.overallRecovery==='FRESH'&&readiness.score>=75&&!lowRecovery;
  const base={exerciseId:block.id,setsDelta:0,minutesDelta:0,evidenceExposures:logs.length};

  // Guardrail order is intentional: pain/recovery > fatigue budget > performance > growth.
  const latest=sessions.filter(s=>s.date<=now).sort((a,b)=>b.date-a.date)[0];
  const pain=Math.max(latest?.readiness.wristPain??0,latest?.readiness.elbowPain??0);
  if(pain>=3)return {...base,action:'PROTECT',reason:`Joint-pain signal ${pain}/5; no additional volume or density.`,confidence:0.96};
  if(lowRecovery&&isPrimarySkill(block))return {...base,action:'PROTECT',reason:`${recovery!.muscle} recovery is ${Math.round(recovery!.recoveryPct)}%; protect primary skill quality.`,confidence:0.92};
  if(highFatigue&&!isPrimary(block)){
    if(isEndurance(block))return {...base,action:'REDUCE_DENSITY',minutesDelta:block.minutes?-1:0,reason:'Weekly fatigue is above the phase budget; trim lower-priority density first.',confidence:0.92};
    if((block.sets||0)>1)return {...base,action:'REDUCE_VOLUME',setsDelta:-1,reason:'Weekly fatigue is above the phase budget; remove one lower-priority set.',confidence:0.92};
  }
  if(!evidence.known)return {...base,action:'HOLD',reason:'Fewer than two comparable exposures; establish a repeatable baseline before adapting volume.',confidence:0.90};
  if(evidence.low)return {...base,action:isEndurance(block)?'REDUCE_DENSITY':'HOLD',minutesDelta:isEndurance(block)&&block.minutes?-1:0,reason:'Recent comparable output is below the target; rebuild performance instead of accumulating fatigue.',confidence:0.88};
  if(lowRecovery)return {...base,action:'HOLD',reason:`Recovery is ${Math.round(recovery!.recoveryPct)}%; repeat the current dose until recovery improves.`,confidence:0.90};
  if(evidence.top&&evidence.stable&&fresh){
    if(phase.type==='ENDURANCE_EMPHASIS'&&isEndurance(block)&&block.minutes){
      const maxMinutes=clamp(block.minutes+1,5,15);
      return {...base,action:'ADD_DENSITY',minutesDelta:maxMinutes-block.minutes,reason:'Two or more stable top-end exposures with fresh recovery; add one sustainable minute.',confidence:0.91};
    }
    if((block.trainingRole==='hypertrophy'||block.trainingRole==='strength')&&isPrimary(block)&&typeof block.sets==='number'&&block.sets<capSets(block)){
      return {...base,action:'ADD_VOLUME',setsDelta:1,reason:`Top-end performance is repeatable across ${logs.length} comparable exposures with adequate recovery; add one set.`,confidence:0.89};
    }
    if(block.trainingRole==='hypertrophy'&&typeof block.sets==='number'&&block.sets<capSets(block)){
      return {...base,action:'ADD_VOLUME',setsDelta:1,reason:'A productive hypertrophy block is repeatably at the top of its range and recovery is fresh.',confidence:0.87};
    }
  }
  // Conservative floor: if a muscle is underloaded, only add a set to hypertrophy work;
  // never compensate by adding more high-fatigue skill exposure.
  if(block.trainingRole==='hypertrophy'&&typeof block.sets==='number'&&block.sets<capSets(block)&&fresh){
    const thin=profile.muscleGroups.find(m=>(report.muscles[m]?.adjustedSets??0)<6);
    if(thin)return {...base,action:'ADD_VOLUME',setsDelta:1,reason:`${thin.replace(/_/g,' ')} is below the conservative weekly hypertrophy floor; add one productive set.`,confidence:0.84};
  }
  return {...base,action:'NONE',reason:'Current phase, performance and recovery do not justify changing the prescription.',confidence:0.82};
}

export function buildAdaptivePeriodizedDay(phase:PhasePlan,day:DayKey,goals:GoalId[]|undefined,sessions:SessionSummary[],now=Date.now()):AdaptiveDayPlan{
  const base=buildPeriodizedDay({phase,day,goals});
  const decisions=base.blocks.map(b=>decision(b,phase,sessions,now));
  const blocks=base.blocks.map(block=>{
    const d=decisions.find(x=>x.exerciseId===block.id)!;
    const next={...block};
    if(typeof next.sets==='number')next.sets=Math.max(1,next.sets+d.setsDelta);
    if(typeof next.minutes==='number')next.minutes=Math.max(5,next.minutes+d.minutesDelta);
    return next;
  });
  const report=weeklyWorkload(sessions,now);
  return {day,program:{...base,blocks},decisions,weeklyFatigue:round(report.totalFatigueLoad),overallRecovery:report.overallRecovery};
}
