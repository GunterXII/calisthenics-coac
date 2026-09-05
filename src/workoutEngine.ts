import type {WorkoutLog} from "./types";
import {canonicalizeWorkoutLog, validateWorkoutLog, type CanonicalWorkoutLog, type SessionValidation} from "./dataFoundation";

export function shouldRestAfterStandardSet(completedSets:number,totalSets:number){
  return completedSets>0 && completedSets<Math.max(1,totalSets);
}

export function shouldRestAfterSideSet(completedSides:number,totalSides:number,side:"R"|"L"){
  // Rest only after a completed round (typically the L side) when another side remains.
  return side==="L" && completedSides<Math.max(1,totalSides);
}

export function totalSessionReps(logs:WorkoutLog[]){
  return logs.reduce((sum,log)=>{
    const canonical=canonicalizeWorkoutLog(log);
    const reps=canonical.sets.reduce((setSum,set)=>setSum+(set.reps??0),0);
    if(reps>0)return sum+reps;
    const emom=Array.isArray(log.result.emom)?log.result.emom.reduce((setSum,value)=>setSum+value,0):0;
    return sum+emom;
  },0);
}

export function isComparableExposure(log:WorkoutLog){
  return log.status==="complete" && log.skipped!==true;
}

export function canonicalWorkoutLog(log:WorkoutLog):CanonicalWorkoutLog{
  return canonicalizeWorkoutLog(log);
}

export function validateWorkoutData(log:WorkoutLog):SessionValidation{
  return validateWorkoutLog(log);
}
