import type { WorkoutLog } from "./types";

export function shouldRestAfterStandardSet(completedSets:number,totalSets:number){
  return completedSets>0 && completedSets<Math.max(1,totalSets);
}

export function shouldRestAfterSideSet(completedSides:number,totalSides:number,side:"R"|"L"){
  // Rest only after a completed round (typically the L side) when another side remains.
  return side==="L" && completedSides<Math.max(1,totalSides);
}

export function totalSessionReps(logs:WorkoutLog[]){
  return logs.reduce((sum,log)=>{
    const reps=(log.result.reps||[]).reduce((a,b)=>a+Number(b||0),0);
    const emom=(log.result.emom||[]).reduce((a,b)=>a+Number(b||0),0);
    return sum+reps+emom;
  },0);
}

export function isComparableExposure(log:WorkoutLog){
  return log.status==="complete";
}
