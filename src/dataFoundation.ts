import type {Band, BlockKind, BlockStatus, DayKey, Readiness, SessionSummary, WorkoutLog} from "./types";

/** Canonical per-set record used by the coaching layer. */
export interface SetRecord {
  index:number; reps?:number; seconds?:number; side?:"R"|"L"; band?:Band; rir?:number; fatigue?:number;
  durationSec?:number; restSec?:number; failed?:boolean; quality?:"Clean"|"Shaky"|"Lost position";
}
export interface CanonicalWorkoutLog {
  id:string; sessionId:string; date:number; day:DayKey; exerciseId:string; exerciseName:string;
  variantId:string; variantName?:string; kind:BlockKind; status:BlockStatus; skipped:boolean; modified:boolean;
  modification?:string; sets:SetRecord[]; band?:Band; note?:string;
}
export interface CanonicalSession {
  id:string; date:number; day:DayKey; durationSec:number; readiness:Readiness; logs:CanonicalWorkoutLog[];
  totalReps:number; emomReps:number; bestSkillSeconds:number; sessionNote?:string; sessionFatigue?:1|2|3|4|5;
}
export interface SessionValidation {valid:boolean; errors:string[]; warnings:string[];}

const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
const nonNegative=(value:unknown):value is number=>finite(value)&&value>=0;
const clampRir=(value:unknown)=>finite(value)?Math.max(0,Math.min(3,value)):undefined;
const clampFatigue=(value:unknown)=>finite(value)?Math.max(1,Math.min(5,value)):undefined;
const cleanArray=(value:unknown)=>Array.isArray(value)?value.filter(nonNegative):[];

/** Convert legacy parallel result arrays into explicit set records without inventing semantics. */
export function toSetRecords(log:WorkoutLog):SetRecord[]{
  const reps=cleanArray(log.result.reps),seconds=cleanArray(log.result.seconds),emom=cleanArray(log.result.emom);
  const sides=Array.isArray(log.result.sides)?log.result.sides:[];
  const quality=Array.isArray(log.result.quality)?log.result.quality:[];
  const count=Math.max(reps.length,seconds.length,emom.length,sides.length,quality.length);
  if(log.kind==="EMOM") return emom.map((value,index)=>({index,reps:value,rir:clampRir(log.result.rir),fatigue:clampFatigue(log.result.fatigue),band:log.result.band}));
  return Array.from({length:count},(_,index)=>{
    const record:SetRecord={index};
    if(reps[index]!==undefined)record.reps=reps[index];
    if(seconds[index]!==undefined)record.seconds=seconds[index];
    if(sides[index]!==undefined)record.side=sides[index];
    if(quality[index]!==undefined)record.quality=quality[index];
    if(log.result.rir!==undefined)record.rir=clampRir(log.result.rir);
    if(log.result.fatigue!==undefined)record.fatigue=clampFatigue(log.result.fatigue);
    if(log.result.band!==undefined)record.band=log.result.band;
    // Zero reps/seconds is a valid observation. Failure cannot be inferred from it.
    return record;
  });
}

export function canonicalizeWorkoutLog(log:WorkoutLog):CanonicalWorkoutLog{
  const skipped=log.status==="skipped"||log.skipped===true;
  return {id:String(log.id),sessionId:String(log.sessionId),date:finite(log.date)?log.date:0,day:log.day,
    exerciseId:String(log.exerciseId),exerciseName:String(log.exerciseName),variantId:String(log.variantId||log.exerciseId),
    variantName:log.variantName,kind:log.kind,status:skipped?"skipped":log.status,skipped,
    modified:log.status==="modified"||Boolean(log.modification),modification:log.modification,sets:toSetRecords(log),
    band:log.result.band,note:log.result.note};
}

export function canonicalizeSession(session:SessionSummary):CanonicalSession{
  const logs=(session.logs||[]).map(canonicalizeWorkoutLog);
  return {id:String(session.id),date:finite(session.date)?session.date:0,day:session.day,
    durationSec:nonNegative(session.durationSec)?session.durationSec:0,readiness:normalizeReadiness(session.readiness),logs,
    totalReps:nonNegative(session.totalReps)?session.totalReps:sumReps(logs),
    emomReps:nonNegative(session.emomReps)?session.emomReps:sumEmom(logs),
    bestSkillSeconds:nonNegative(session.bestSkillSeconds)?session.bestSkillSeconds:bestSeconds(logs),
    sessionNote:session.sessionNote,sessionFatigue:session.sessionFatigue};
}

export function normalizeReadiness(readiness:Readiness|undefined):Readiness{
  if(!readiness)return {};
  return {sleepHours:finite(readiness.sleepHours)&&readiness.sleepHours>=0&&readiness.sleepHours<=24?readiness.sleepHours:undefined,
    weightKg:finite(readiness.weightKg)&&readiness.weightKg>0&&readiness.weightKg<500?readiness.weightKg:undefined,
    energy:finite(readiness.energy)&&readiness.energy>=0&&readiness.energy<=5?readiness.energy:undefined,
    wristPain:finite(readiness.wristPain)&&readiness.wristPain>=0&&readiness.wristPain<=5?readiness.wristPain:undefined,
    elbowPain:finite(readiness.elbowPain)&&readiness.elbowPain>=0&&readiness.elbowPain<=5?readiness.elbowPain:undefined};
}

export function validateWorkoutLog(log:WorkoutLog):SessionValidation{
  const errors:string[]=[],warnings:string[]=[];
  if(!log.id)errors.push("missing log id"); if(!log.sessionId)errors.push("missing session id"); if(!log.exerciseId)errors.push("missing exercise id");
  if(!finite(log.date))errors.push("invalid log date");
  if(log.status==="skipped"&&log.result.reps?.some(x=>x>0))warnings.push("skipped log contains positive reps");
  if(log.status!=="skipped"&&log.skipped===true)warnings.push("skipped flag conflicts with non-skipped status");
  for(const value of [...(log.result.reps||[]),...(log.result.seconds||[]),...(log.result.emom||[])])if(!nonNegative(value))errors.push("negative or non-finite performance value");
  if(log.result.rir!==undefined&&(!finite(log.result.rir)||log.result.rir<0||log.result.rir>3))errors.push("RIR must be between 0 and 3");
  if(log.result.fatigue!==undefined&&(!finite(log.result.fatigue)||log.result.fatigue<1||log.result.fatigue>5))errors.push("fatigue must be between 1 and 5");
  return {valid:errors.length===0,errors,warnings};
}

export function validateSession(session:SessionSummary):SessionValidation{
  const errors:string[]=[],warnings:string[]=[];
  if(!session.id)errors.push("missing session id"); if(!finite(session.date))errors.push("invalid session date"); if(!nonNegative(session.durationSec))errors.push("invalid session duration");
  if(session.sessionFatigue!==undefined&&(!finite(session.sessionFatigue)||session.sessionFatigue<1||session.sessionFatigue>5))errors.push("session fatigue must be between 1 and 5");
  for(const log of session.logs||[]){const result=validateWorkoutLog(log);errors.push(...result.errors.map(x=>`log ${log.id}: ${x}`));warnings.push(...result.warnings.map(x=>`log ${log.id}: ${x}`));}
  return {valid:errors.length===0,errors,warnings};
}
export function sumReps(logs:CanonicalWorkoutLog[]):number{return logs.reduce((sum,log)=>sum+log.sets.reduce((s,set)=>s+(set.reps??0),0),0);}
export function sumEmom(logs:CanonicalWorkoutLog[]):number{return logs.filter(log=>log.kind==="EMOM").reduce((sum,log)=>sum+log.sets.reduce((s,set)=>s+(set.reps??0),0),0);}
export function bestSeconds(logs:CanonicalWorkoutLog[]):number{return logs.reduce((best,log)=>Math.max(best,...log.sets.map(set=>set.seconds??0)),0);}
