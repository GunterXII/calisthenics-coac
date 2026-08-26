import type {
  BodyweightPerformance,
  ExerciseBlock,
  ProgressionCriteria,
  ProgressionEvaluation,
  Readiness,
  ReadinessAnalysis,
  SidePerformance,
} from "./types";
import type { ExerciseCatalogItem } from "./exercises";

export interface CoachingLogRecord {
  exerciseId:string;
  status:string;
  result:{
    reps?:number[];
    seconds?:number[];
    emom?:number[];
    sides?:("R"|"L")[];
    rir?:number;
    fatigue?:number;
    note?:string;
  };
  session?:{ readiness?:Readiness; date?:number };
}

const num=(v:unknown):number=>typeof v==="number" && Number.isFinite(v)?v:Number.isFinite(Number(v))?Number(v):0;
const nums=(v:unknown):number[]=>Array.isArray(v)?v.map(num):[];
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const max=(v:number[])=>v.length?Math.max(...v):0;
const min=(v:number[])=>v.length?Math.min(...v):0;
const sum=(v:number[])=>v.reduce((a,b)=>a+b,0);
const variance=(v:number[],m:number)=>v.length?v.reduce((a,b)=>a+(b-m)**2,0)/v.length:0;

export function parseTargetRange(target:string, catalog?:ExerciseCatalogItem){
  const t=target||catalog?.defaultTarget||"";
  const m=t.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(m)return {min:Number(m[1]),max:Number(m[2])};
  const one=t.match(/(\d+(?:\.\d+)?)/);
  if(one)return {min:Number(one[1]),max:Number(one[1])};
  if(catalog?.holdMin!=null||catalog?.holdMax!=null)return {min:num(catalog.holdMin),max:num(catalog.holdMax)};
  if(catalog?.repMin!=null||catalog?.repMax!=null)return {min:num(catalog.repMin),max:num(catalog.repMax)};
  return {min:0,max:0};
}

export function analyzeReadiness(readiness?:Readiness):ReadinessAnalysis{
  const r=readiness||{};
  const reasons:string[]=[];
  const energy=r.energy??0;
  const sleep=r.sleepHours??0;
  const pain=Math.max(r.wristPain??0,r.elbowPain??0);
  let score=70;
  if(energy){ score += (energy-3)*8; if(energy<=2) reasons.push(`Energy ${energy}/5`); }
  if(sleep){ score += sleep>=7?8:sleep<6?-15:-4; if(sleep<6) reasons.push(`Sleep ${sleep.toFixed(1)}h`); }
  if(pain>=4){ reasons.push(`Pain ${pain}/5`); return {score:Math.max(0,Math.round(score-35)),status:"PAIN_REVIEW",reasons,allowProgression:false,recommendedLoadMultiplier:0.8}; }
  if(pain>=3){ reasons.push(`Joint pain ${pain}/5`); return {score:Math.max(0,Math.round(score-20)),status:"RECOVERY",reasons,allowProgression:false,recommendedLoadMultiplier:0.9}; }
  score=Math.max(0,Math.min(100,score));
  if(score<55)return {score:Math.round(score),status:"RECOVERY",reasons:reasons.length?reasons:["Low overall readiness"],allowProgression:false,recommendedLoadMultiplier:0.9};
  if(score<72)return {score:Math.round(score),status:"CAUTION",reasons:reasons.length?reasons:["Moderate readiness"],allowProgression:false,recommendedLoadMultiplier:0.95};
  return {score:Math.round(score),status:"READY",reasons:reasons.length?reasons:["Readiness supports planned work"],allowProgression:true,recommendedLoadMultiplier:1};
}

function explicitQuality(log:CoachingLogRecord){
  const note=String(log.result.note||"");
  const match=note.match(/qualities\s+([^;]+)/i);
  if(!match)return undefined;
  const values=match[1].split("/").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!values.length)return undefined;
  return values.filter(v=>v==="clean").length/values.length;
}

export function qualityScore(log:CoachingLogRecord, expectedAttempts?:number){
  const explicit=explicitQuality(log);
  let score=explicit ?? 0.82;
  if(log.status!=="complete")score=Math.min(score,0.35);
  if(typeof log.result.rir==="number"){
    if(log.result.rir<=0)score-=0.12;
    else if(log.result.rir>=3)score+=0.04;
  }
  if(typeof log.result.fatigue==="number"){
    if(log.result.fatigue>=5)score-=0.12;
    else if(log.result.fatigue<=2)score+=0.03;
  }
  const attempts=Math.max(log.result.reps?.length||0,log.result.seconds?.length||0,log.result.emom?.length||0);
  if(expectedAttempts && attempts<expectedAttempts)score-=0.1;
  return Math.max(0,Math.min(1,score));
}

export function emomStability(emom:number[]){
  if(!emom.length)return {dropoffPct:100,cvPct:100,lastVsFirstPct:0,score:0};
  const first=emom[0],last=emom[emom.length-1],avg=mean(emom),std=Math.sqrt(variance(emom,avg));
  const dropoff=first>0?Math.max(0,((first-last)/first)*100):100;
  const cv=avg>0?(std/avg)*100:100;
  const lastVsFirst=first>0?(last/first)*100:0;
  const score=Math.max(0,Math.min(100,100-(dropoff*2.2)-(Math.max(0,cv-8)*1.7)));
  return {dropoffPct:dropoff,cvPct:cv,lastVsFirstPct:lastVsFirst,score};
}

function sidePerformance(reps:number[],sides:unknown[],minReps:number):SidePerformance|undefined{
  const ss=Array.isArray(sides)?sides.map(String):[];
  if(!ss.length)return undefined;
  let rightBest=0,leftBest=0,rightQualifying=0,leftQualifying=0;
  reps.forEach((v,i)=>{
    if(ss[i]==="R"){rightBest=Math.max(rightBest,v);if(v>=minReps)rightQualifying++;}
    if(ss[i]==="L"){leftBest=Math.max(leftBest,v);if(v>=minReps)leftQualifying++;}
  });
  return {rightBest,leftBest,rightQualifying,leftQualifying,balanced:rightQualifying>0&&leftQualifying>0&&Math.abs(rightBest-leftBest)<=1};
}

export function normalizedBodyweightPerformance(rawValue:number,currentWeightKg?:number,referenceWeightKg?:number):BodyweightPerformance{
  if(!currentWeightKg||currentWeightKg<=0||!referenceWeightKg||referenceWeightKg<=0){
    return {currentWeightKg,referenceWeightKg,rawValue,normalizedValue:rawValue,interpretation:"NO_WEIGHT_DATA"};
  }
  const normalized=rawValue*(referenceWeightKg/currentWeightKg);
  const delta=((normalized-rawValue)/Math.max(rawValue,0.0001))*100;
  const interpretation=delta>3?"IMPROVING":delta<-3?"DECLINING":"STABLE";
  return {currentWeightKg,referenceWeightKg,rawValue,normalizedValue:normalized,normalizedDeltaPct:delta,interpretation};
}

export function evaluateProgression(
  block:ExerciseBlock,
  log:CoachingLogRecord,
  criteria:ProgressionCriteria,
  referenceWeightKg?:number,
):ProgressionEvaluation{
  const reps=nums(log.result.reps),seconds=nums(log.result.seconds),emom=nums(log.result.emom);
  const reasons:string[]=[];
  const quality=qualityScore(log);
  let qualifies=false;
  let stabilityScore=100;
  let side:SidePerformance|undefined;
  const bw=log.session?.readiness?.weightKg;
  const raw=max(seconds)||max(reps)||sum(emom);
  const bodyweightPerformance=raw>0?normalizedBodyweightPerformance(raw,bw,referenceWeightKg):undefined;

  if(criteria.type==="reps"){
    const perSet=reps.length>=criteria.minSets && reps.slice(0,criteria.minSets).every(v=>v>=criteria.minReps);
    side=sidePerformance(reps,log.result.sides||[],criteria.minReps);
    const sidePass=criteria.side==="both"?Boolean(side&&side.rightQualifying>=(criteria.minQualifyingRepsPerSide??1)&&side.leftQualifying>=(criteria.minQualifyingRepsPerSide??1)):true;
    qualifies=perSet&&sidePass;
    if(criteria.minRir!=null && (log.result.rir??Infinity)<criteria.minRir)qualifies=false;
    if(criteria.requireClean && quality<0.8)qualifies=false;
    if(!perSet)reasons.push(`Need ${criteria.minSets} sets at ${criteria.minReps}+ reps.`);
    if(!sidePass)reasons.push("Both sides must meet the OAP consistency standard.");
  } else if(criteria.type==="seconds"){
    qualifies=seconds.length>=criteria.minHolds && seconds.slice(0,criteria.minHolds).every(v=>v>=criteria.minSeconds);
    if(criteria.minRir!=null&&(log.result.rir??Infinity)<criteria.minRir)qualifies=false;
    if(criteria.requireClean&&quality<0.8)qualifies=false;
    if(!qualifies)reasons.push(`Need ${criteria.minHolds} clean holds at ${criteria.minSeconds}s+.`);
  } else if(criteria.type==="emom"){
    const stats=emomStability(emom);
    stabilityScore=stats.score;
    const dropOk=criteria.maxDropoffPct==null||stats.dropoffPct<=criteria.maxDropoffPct;
    const cvOk=criteria.maxCvPct==null||stats.cvPct<=criteria.maxCvPct;
    const lastOk=criteria.minLastVsFirstPct==null||stats.lastVsFirstPct>=criteria.minLastVsFirstPct;
    const volumeOk=emom.length>=criteria.minutes&&emom.slice(0,criteria.minutes).every(v=>v>=criteria.minPerMinute);
    qualifies=volumeOk&&dropOk&&cvOk&&lastOk;
    if(criteria.minRir!=null&&(log.result.rir??Infinity)<criteria.minRir)qualifies=false;
    if(!volumeOk)reasons.push(`Need ${criteria.minutes} minutes at ${criteria.minPerMinute}+ reps/min.`);
    if(!dropOk||!cvOk||!lastOk)reasons.push(`EMOM stability is ${Math.round(stats.score)}/100; keep output more even across the block.`);
  } else {
    const exposures=criteria.minExposures;
    const cleanEnough=quality>=criteria.minQualityPct/100;
    qualifies=exposures<=1&&cleanEnough;
    if(!cleanEnough)reasons.push(`Quality ${Math.round(quality*100)}% is below ${criteria.minQualityPct}%.`);
  }

  if(qualifies)reasons.push(`Qualifies at ${Math.round(quality*100)}% quality.`);
  return {qualifies,qualityScore:quality,stabilityScore,reasons,sidePerformance:side,bodyweightPerformance};
}

export function referenceWeightFromLogs(logs:CoachingLogRecord[]){
  const weights=logs.map(x=>x.session?.readiness?.weightKg).filter((x):x is number=>typeof x==="number"&&x>0);
  return weights.length?weights[weights.length-1]:undefined;
}
