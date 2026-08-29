import type {DayKey, MuscleGroup, Readiness, SessionSummary, WorkoutLog} from "./types";
import type {ExerciseBlock} from "./types";
import {PROGRAM} from "./program";
import {trainingProfileForBlock, type TrainingProfile} from "./trainingModel";

/**
 * Workload/recovery numbers are planning heuristics, not physiological measurements.
 * They deliberately favor conservative decisions when recent fatigue or overlap is high.
 */
export interface MuscleWorkload {
  muscle: MuscleGroup;
  sets:number;
  adjustedSets:number;
  fatigueLoad:number;
  exposures:number;
}

export interface GripWorkload {
  low:number;
  moderate:number;
  high:number;
  score:number;
}

export interface SessionWorkload {
  sessionId:string;
  date:number;
  day:DayKey;
  totalAdjustedSets:number;
  fatigueLoad:number;
  grip:GripWorkload;
  muscles:Partial<Record<MuscleGroup,MuscleWorkload>>;
}

export type RecoveryStatus = "FRESH"|"RECOVERING"|"FATIGUED"|"HIGH_FATIGUE";
export interface MuscleRecovery {
  muscle:MuscleGroup;
  recentLoad:number;
  recoveryPct:number;
  status:RecoveryStatus;
  lastExposureHours?:number;
  reason:string;
}

export interface WeeklyWorkloadReport {
  start:number;
  end:number;
  sessions:number;
  totalAdjustedSets:number;
  totalFatigueLoad:number;
  muscles:Record<MuscleGroup,MuscleWorkload>;
  grip:GripWorkload;
  recovery:Record<MuscleGroup,MuscleRecovery>;
  overallRecovery:RecoveryStatus;
  warnings:string[];
}

const MUSCLES:MuscleGroup[]=["chest","triceps","front_delts","side_delts","lats","upper_back","biceps","forearms","core","quads","glutes","hamstrings","calves"];
const GRIP_WEIGHT={none:0,low:0.35,moderate:0.7,high:1};
const round=(n:number,d=2)=>Number(n.toFixed(d));
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

function inferBlockForLog(log:WorkoutLog):ExerciseBlock|undefined{
  const blocks=PROGRAM[log.day]?.blocks||[];
  return blocks.find(b=>b.id===log.exerciseId)
    || blocks.find(b=>b.name===log.exerciseName)
    || undefined;
}

function performedUnits(log:WorkoutLog):number{
  if(log.kind==="EMOM") return (log.result.emom||[]).length;
  if(log.kind==="SKILL_STATIC" || (log.result.seconds?.length||0)>0) return (log.result.seconds||[]).length;
  return (log.result.reps||[]).length;
}

function fatigueMultiplier(log:WorkoutLog):number{
  const rir=log.result.rir;
  const fatigue=log.result.fatigue;
  let m=1;
  if(typeof rir==="number") m*=rir<=0?1.15:rir===1?1.05:0.98;
  if(typeof fatigue==="number") m*=1 + clamp(fatigue-3,0,2)*0.08;
  if(log.status==="modified") m*=0.85;
  return m;
}

export function workloadForLog(log:WorkoutLog):SessionWorkload|undefined{
  if(log.status!=="complete" || performedUnits(log)<=0) return undefined;
  const block=inferBlockForLog(log);
  const profile:TrainingProfile=log.prescription?.muscleGroups
    ? {
      role: log.prescription.progressionMode==="density_emom"?"hypertrophy":(log.prescription.progressionMode?.includes("skill")?"skill":log.prescription.progressionMode?.includes("power")?"power":log.prescription.progressionMode?.includes("strength")?"strength":"hypertrophy"),
      priority:"secondary",
      progressionMode:log.prescription.progressionMode||"none",
      fatigueCost:log.prescription.fatigueCost||2,
      muscleGroups:log.prescription.muscleGroups||[],
      effectiveSetWeight:log.prescription.effectiveSetWeight??1,
      gripDemand:log.prescription.gripDemand||"none",
    } as TrainingProfile
    : block?trainingProfileForBlock(block):null as any;
  if(!profile) return undefined;
  const units=performedUnits(log);
  const adjustedSets=units*(profile.effectiveSetWeight||0);
  const fatigueLoad=adjustedSets*profile.fatigueCost*fatigueMultiplier(log);
  const muscles:Partial<Record<MuscleGroup,MuscleWorkload>>={};
  for(const muscle of profile.muscleGroups){
    muscles[muscle]={muscle,sets:round(units),adjustedSets:round(adjustedSets),fatigueLoad:round(fatigueLoad),exposures:1};
  }
  const grip={low:profile.gripDemand==="low"?units:0,moderate:profile.gripDemand==="moderate"?units:0,high:profile.gripDemand==="high"?units:0,score:round(units*GRIP_WEIGHT[profile.gripDemand])};
  return {sessionId:log.sessionId,date:log.date,day:log.day,totalAdjustedSets:round(adjustedSets),fatigueLoad:round(fatigueLoad),grip, muscles};
}

export function sessionWorkload(session:SessionSummary):SessionWorkload{
  const totals:Partial<Record<MuscleGroup,MuscleWorkload>>={};
  let totalAdjustedSets=0,fatigueLoad=0;
  const grip:GripWorkload={low:0,moderate:0,high:0,score:0};
  for(const log of session.logs){
    const w=workloadForLog(log); if(!w) continue;
    totalAdjustedSets+=w.totalAdjustedSets; fatigueLoad+=w.fatigueLoad;
    grip.low+=w.grip.low; grip.moderate+=w.grip.moderate; grip.high+=w.grip.high; grip.score+=w.grip.score;
    for(const muscle of MUSCLES){
      const x=w.muscles[muscle]; if(!x) continue;
      const prev=totals[muscle];
      totals[muscle]=prev?{...prev,sets:prev.sets+x.sets,adjustedSets:prev.adjustedSets+x.adjustedSets,fatigueLoad:prev.fatigueLoad+x.fatigueLoad,exposures:prev.exposures+x.exposures}: {...x};
    }
  }
  return {sessionId:session.id,date:session.date,day:session.day,totalAdjustedSets:round(totalAdjustedSets),fatigueLoad:round(fatigueLoad),grip:{low:round(grip.low),moderate:round(grip.moderate),high:round(grip.high),score:round(grip.score)},muscles:totals};
}

function emptyMuscle(muscle:MuscleGroup):MuscleWorkload{return {muscle,sets:0,adjustedSets:0,fatigueLoad:0,exposures:0};}
function zeroGrip():GripWorkload{return {low:0,moderate:0,high:0,score:0};}

export function weeklyWorkload(sessions:SessionSummary[], now=Date.now()):WeeklyWorkloadReport{
  const end=now,start=end-7*86400000;
  const inWeek=sessions.filter(s=>s.date>=start&&s.date<=end).sort((a,b)=>a.date-b.date);
  const muscles={} as Record<MuscleGroup,MuscleWorkload>; MUSCLES.forEach(m=>muscles[m]=emptyMuscle(m));
  const grip=zeroGrip(); let totalAdjustedSets=0,totalFatigueLoad=0;
  for(const s of inWeek){
    const w=sessionWorkload(s); totalAdjustedSets+=w.totalAdjustedSets; totalFatigueLoad+=w.fatigueLoad;
    grip.low+=w.grip.low;grip.moderate+=w.grip.moderate;grip.high+=w.grip.high;grip.score+=w.grip.score;
    for(const m of MUSCLES){const x=w.muscles[m];if(!x)continue;const t=muscles[m];t.sets+=x.sets;t.adjustedSets+=x.adjustedSets;t.fatigueLoad+=x.fatigueLoad;t.exposures+=x.exposures;}
  }
  for(const m of MUSCLES){muscles[m].sets=round(muscles[m].sets);muscles[m].adjustedSets=round(muscles[m].adjustedSets);muscles[m].fatigueLoad=round(muscles[m].fatigueLoad);}
  grip.low=round(grip.low);grip.moderate=round(grip.moderate);grip.high=round(grip.high);grip.score=round(grip.score);
  const recovery={} as Record<MuscleGroup,MuscleRecovery>;
  for(const m of MUSCLES) recovery[m]=recoveryForMuscle(m,sessions,now);
  const warnings:string[]=[];
  for(const m of MUSCLES){
    const x=muscles[m]; const r=recovery[m];
    if(x.adjustedSets>=14) warnings.push(`${pretty(m)} has high weekly workload (${x.adjustedSets.toFixed(1)} adjusted sets).`);
    if(r.status==="FATIGUED"||r.status==="HIGH_FATIGUE") warnings.push(`${pretty(m)} is still recovering from recent loading (${Math.round(r.recoveryPct)}% recovered).`);
  }
  if(grip.score>=12) warnings.push(`Grip demand is high this week (${grip.score.toFixed(1)} weighted units).`);
  const overallRecovery=overallStatus(Object.values(recovery));
  return {start,end,sessions:inWeek.length,totalAdjustedSets:round(totalAdjustedSets),totalFatigueLoad:round(totalFatigueLoad),muscles,grip,recovery,overallRecovery,warnings:[...new Set(warnings)]};
}

export function recoveryForMuscle(muscle:MuscleGroup,sessions:SessionSummary[],now=Date.now()):MuscleRecovery{
  const halfLifeHours=48;
  let recentLoad=0,lastExposure:number|undefined;
  for(const s of sessions){
    if(s.date>now) continue;
    const w=sessionWorkload(s); const x=w.muscles[muscle]; if(!x||x.fatigueLoad<=0)continue;
    const hours=Math.max(0,(now-s.date)/3600000);
    recentLoad += x.fatigueLoad*Math.pow(0.5,hours/halfLifeHours);
    if(lastExposure===undefined) lastExposure=hours;
  }
  // RecoveryPct is a conservative heuristic derived from decayed recent fatigue load.
  const pct=clamp(100 - recentLoad*7.5,0,100);
  const status:RecoveryStatus=pct>=80?"FRESH":pct>=60?"RECOVERING":pct>=35?"FATIGUED":"HIGH_FATIGUE";
  const reason=pct>=80?"Low recent fatigue load.":pct>=60?"Recent work is still present but trending down.":pct>=35?"Recent workload is likely to affect output; avoid stacking more volume without evidence.":"High recent accumulated fatigue; prioritize recovery before adding work.";
  return {muscle,recentLoad:round(recentLoad),recoveryPct:round(pct),status,lastExposureHours:lastExposure===undefined?undefined:round(lastExposure),reason};
}

function overallStatus(values:MuscleRecovery[]):RecoveryStatus{
  if(!values.length)return "FRESH";
  const avg=values.reduce((a,b)=>a+b.recoveryPct,0)/values.length;
  const worst=Math.min(...values.map(x=>x.recoveryPct));
  if(worst<35||avg<50)return "HIGH_FATIGUE";
  if(worst<60||avg<70)return "FATIGUED";
  if(avg<82)return "RECOVERING";
  return "FRESH";
}

export function analyzeRecoveryForBlocks(blocks:ExerciseBlock[],sessions:SessionSummary[],readiness?:Readiness,now=Date.now()){
  const report=weeklyWorkload(sessions,now);
  const flags:string[]=[];
  for(const block of blocks){
    const profile=trainingProfileForBlock(block);
    for(const muscle of profile.muscleGroups){
      const r=report.recovery[muscle];
      if(r && (r.status==="FATIGUED"||r.status==="HIGH_FATIGUE")) flags.push(`${block.name}: ${pretty(muscle)} recovery ${Math.round(r.recoveryPct)}%.`);
    }
    if(profile.gripDemand==="high"&&report.recovery.forearms.status!=="FRESH") flags.push(`${block.name}: grip/forearm recovery is not fully restored.`);
  }
  const pain=Math.max(readiness?.wristPain||0,readiness?.elbowPain||0);
  if(pain>=3) flags.push("Joint-pain signal is elevated; recovery status should not be interpreted as permission to progress.");
  return {report,flags:[...new Set(flags)]};
}

export function pretty(m:MuscleGroup){return m.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());}
export const WORKLOAD_MUSCLES=MUSCLES;
