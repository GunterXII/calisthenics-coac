import type {ExerciseBlock,PlateauSignal,SessionSummary,WorkoutLog,TrainingRole} from "./types";

function roleEligible(block:ExerciseBlock):boolean{
  return block.trainingRole==="skill"||block.trainingRole==="strength";
}

function sameExposure(a:WorkoutLog,b:WorkoutLog):boolean{
  return a.exerciseId===b.exerciseId
    && String(a.variantId||a.exerciseId)===String(b.variantId||b.exerciseId)
    && a.status==="complete"
    && b.status==="complete"
    && String(a.prescription?.targetRange||"")===String(b.prescription?.targetRange||"")
    && (a.prescription?.sets??null)===(b.prescription?.sets??null)
    && (a.prescription?.minutes??null)===(b.prescription?.minutes??null)
    && String(a.prescription?.kind||"")===(String(b.prescription?.kind||""))
    && String(a.result.band||"")===String(b.result.band||"");
}

function performanceMetric(log:WorkoutLog):number|undefined{
  if(log.result.reps?.length)return Math.max(...log.result.reps);
  if(log.result.seconds?.length)return Math.max(...log.result.seconds);
  if(log.result.emom?.length)return Math.min(...log.result.emom);
  return undefined;
}

function comparableHistory(block:ExerciseBlock,sessions:SessionSummary[]):WorkoutLog[]{
  return sessions.flatMap(s=>s.logs||[])
    .filter(l=>l.exerciseId===block.id&&l.status==="complete"&&!l.skipped)
    .sort((a,b)=>a.date-b.date)
    .filter((log,_,all)=>{
      const index=all.indexOf(log);
      for(let i=index-1;i>=0;i--)if(sameExposure(log,all[i]))return true;
      return false;
    });
}

export function detectPlateau(block:ExerciseBlock,sessions:SessionSummary[],minExposures=3):PlateauSignal|null{
  if(!roleEligible(block)||block.kind==="EMOM")return null;
  const history=comparableHistory(block,sessions);
  if(history.length<minExposures)return null;
  const recent=history.slice(-minExposures);
  if(recent.some(x=>performanceMetric(x)===undefined))return null;
  const values=recent.map(x=>performanceMetric(x)!);
  const first=values[0],last=values[values.length-1];
  const best=Math.max(...values);
  const rirs=recent.map(x=>x.result.rir).filter((x):x is number=>typeof x==="number");
  const fatigues=recent.map(x=>x.result.fatigue).filter((x):x is number=>typeof x==="number");
  const highFatigue=fatigues.length>0&&fatigues.reduce((a,b)=>a+b,0)/fatigues.length>=4;
  const noImprovement=last<=first&&best-first<1;
  if(!noImprovement||highFatigue)return null;
  const isOap=block.id==="oap";
  return {
    exerciseId:block.id,
    variantId:String(recent[recent.length-1].variantId||block.id),
    exposures:minExposures,
    metric:block.previousMode==="seconds"?"best hold":"best set",
    values,
    improving:false,
    recommendation:isOap?"CONSIDER_CLUSTER":"CONSIDER_VARIANT",
    reason:isOap
      ?"Three comparable exposures show no clear improvement. Before adding generic volume, consider cluster singles to increase high-quality OAP work."
      :"Three comparable exposures show no clear improvement. Review technique, recovery and consider a controlled method or variant change before adding volume."
  };
}

export function detectPlateaus(blocks:ExerciseBlock[],sessions:SessionSummary[]):PlateauSignal[]{
  return blocks.map(b=>detectPlateau(b,sessions)).filter((x):x is PlateauSignal=>Boolean(x));
}
