import type {PlateauSignal,SessionSummary,WorkoutLog} from "./types";

function sameExposure(a:WorkoutLog,b:WorkoutLog):boolean{
  return a.exerciseId===b.exerciseId
    && String(a.variantId||a.exerciseId)===String(b.variantId||b.exerciseId)
    && a.status==="complete" && b.status==="complete"
    && String(a.prescription?.targetRange||"")===String(b.prescription?.targetRange||"")
    && (a.prescription?.sets??null)===(b.prescription?.sets??null)
    && (a.prescription?.minutes??null)===(b.prescription?.minutes??null)
    && String(a.prescription?.kind||"")===String(b.prescription?.kind||"")
    && String(a.result.band||"")===String(b.result.band||"");
}

function metric(log:WorkoutLog):number|undefined{
  if(log.result.reps?.length)return Math.max(...log.result.reps);
  if(log.result.seconds?.length)return Math.max(...log.result.seconds);
  return undefined;
}

function eligible(id:string,kind:string):boolean{
  if(kind==="EMOM")return false;
  return id==="oap"||id==="archer-pull"||id==="high-pull"||id==="flpu"||id==="touch"||id==="touch-band"||id==="oap-band"||id==="flpu-band";
}

export function detectPlateaus(sessions:SessionSummary[],minExposures=3):PlateauSignal[]{
  const logs=sessions.flatMap(s=>s.logs||[]).filter(l=>eligible(l.exerciseId,l.kind)&&l.status==="complete"&&!l.skipped).sort((a,b)=>a.date-b.date);
  const byId=new Map<string,WorkoutLog[]>();
  for(const log of logs){
    const arr=byId.get(log.exerciseId)||[];
    if(arr.length===0||sameExposure(log,arr[arr.length-1]))arr.push(log);
    else {
      const last=arr[arr.length-1];
      if(sameExposure(log,last))arr.push(log);
    }
    byId.set(log.exerciseId,arr);
  }
  const out:PlateauSignal[]=[];
  for(const [exerciseId,arr] of byId){
    const recent=arr.slice(-minExposures);
    if(recent.length<minExposures)continue;
    const values=recent.map(metric);
    if(values.some(v=>v===undefined))continue;
    const nums=values as number[];
    const first=nums[0], last=nums[nums.length-1], best=Math.max(...nums);
    const fatigues=recent.map(x=>x.result.fatigue).filter((x):x is number=>typeof x==="number");
    const avgFatigue=fatigues.length?fatigues.reduce((a,b)=>a+b,0)/fatigues.length:0;
    if(avgFatigue>=4)continue;
    if(last>first||best-first>=1)continue;
    out.push({
      exerciseId,
      variantId:String(recent[recent.length-1].variantId||exerciseId),
      exposures:minExposures,
      metric:recent[0].result.seconds?.length?"best hold":"best set",
      values:nums,
      improving:false,
      recommendation:exerciseId==="oap"?"CONSIDER_CLUSTER":"CONSIDER_VARIANT",
      reason:exerciseId==="oap"
        ?"Three comparable exposures show no clear improvement. Consider cluster singles before adding generic volume."
        :"Three comparable exposures show no clear improvement. Review technique, recovery and consider a controlled method or variant change before adding volume."
    });
  }
  return out;
}
