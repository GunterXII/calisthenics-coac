import type {
  BodyweightPerformance,
  CoachExposureDecision,
  ExerciseBlock,
  PerformanceBand,
  ProgressionCriteria,
  ProgressionEvaluation,
  Readiness,
  ReadinessAnalysis,
  SidePerformance,
} from "./types";
import type { ExerciseCatalogItem } from "./exercises";
import { criteriaForBlock, masteryCriteriaForBlock, progressionGateForBlock, progressionSpecForBlock, nextTargetFromSpec } from "./progressionRegistry";
import {trainingProfileForBlock} from "./trainingModel";

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
    quality?: ("Clean"|"Shaky"|"Lost position")[];
    note?:string;
    band?:string;
  };
  session?:{ readiness?:Readiness; date?:number };
  prescription?:{
    variantId?:string;
    targetRange?:string;
    sets?:number;
    minutes?:number;
    restSec?:number;
    kind?:string;
  };
}

const num=(v:unknown):number=>typeof v==="number"&&Number.isFinite(v)?v:typeof v==="string"&&v.trim()!==""&&Number.isFinite(Number(v))?Number(v):0;
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
  const energy=r.energy;
  const sleep=r.sleepHours;
  const painRecorded=r.wristPain!==undefined||r.elbowPain!==undefined;
  const pain=Math.max(r.wristPain??0,r.elbowPain??0);
  let score=70;
  const painGate:ReadinessAnalysis["gates"]["pain"]=!painRecorded?"UNKNOWN":pain>=3?"BLOCK":"PASS";
  const sleepGate:ReadinessAnalysis["gates"]["sleep"]=sleep===undefined?"UNKNOWN":sleep<6?"BLOCK":sleep<7?"UNKNOWN":"PASS";
  const energyGate:ReadinessAnalysis["gates"]["energy"]=energy===undefined?"UNKNOWN":energy<=2?"BLOCK":energy===3?"UNKNOWN":"PASS";
  if(energy!==undefined){score+=(energy-3)*8;if(energy<=2)reasons.push(`Energy ${energy}/5`);}
  if(sleep!==undefined){score+=sleep>=7?8:sleep<6?-15:-4;if(sleep<6)reasons.push(`Sleep ${sleep.toFixed(1)}h`);}
  if(pain>=4){reasons.push(`Pain ${pain}/5`);return {score:Math.max(0,Math.round(score-35)),status:"PAIN_REVIEW",reasons,gates:{pain:"BLOCK",sleep:sleepGate,energy:energyGate,overall:"BLOCK"},allowProgression:false,recommendedLoadMultiplier:0.8};}
  if(pain>=3){reasons.push(`Joint pain ${pain}/5`);return {score:Math.max(0,Math.round(score-20)),status:"RECOVERY",reasons,gates:{pain:"BLOCK",sleep:sleepGate,energy:energyGate,overall:"BLOCK"},allowProgression:false,recommendedLoadMultiplier:0.9};}
  score=Math.max(0,Math.min(100,score));
  if(score<55)return {score:Math.round(score),status:"RECOVERY",reasons:reasons.length?reasons:["Low overall readiness"],gates:{pain:painGate,sleep:sleepGate,energy:energyGate,overall:"BLOCK"},allowProgression:false,recommendedLoadMultiplier:0.9};
  if(score<72)return {score:Math.round(score),status:"CAUTION",reasons:reasons.length?reasons:["Moderate readiness"],gates:{pain:painGate,sleep:sleepGate,energy:energyGate,overall:"UNKNOWN"},allowProgression:false,recommendedLoadMultiplier:0.95};
  const overall:ReadinessAnalysis["gates"]["overall"]=(sleepGate==="BLOCK"||energyGate==="BLOCK"||painGate==="BLOCK")?"BLOCK":(sleepGate==="PASS"&&energyGate==="PASS"&&painGate==="PASS")?"PASS":"UNKNOWN";
  if(overall==="UNKNOWN")return {score:Math.round(score),status:"CAUTION",reasons:reasons.length?reasons:["Readiness is incomplete; progression requires recorded recovery gates."],gates:{pain:painGate,sleep:sleepGate,energy:energyGate,overall},allowProgression:false,recommendedLoadMultiplier:0.95};
  return {score:Math.round(score),status:"READY",reasons:reasons.length?reasons:["Readiness supports planned work"],gates:{pain:painGate,sleep:sleepGate,energy:energyGate,overall},allowProgression:true,recommendedLoadMultiplier:1};
}

export function qualityIsKnown(log:CoachingLogRecord){return explicitQuality(log)!==undefined;}
function explicitQuality(log:CoachingLogRecord){
  const values=Array.isArray(log.result.quality)?log.result.quality.map(x=>x.toLowerCase()).filter(Boolean):[];
  if(!values.length)return undefined;
  return values.filter(v=>v==="clean").length/values.length;
}
export function qualityScore(log:CoachingLogRecord,expectedAttempts?:number){
  const explicit=explicitQuality(log);let score=explicit;
  if(score===undefined)return undefined;
  if(log.status!=="complete")score=Math.min(score,0.35);
  if(typeof log.result.rir==="number"){if(log.result.rir<=0)score-=0.12;else if(log.result.rir>=3)score+=0.04;}
  if(typeof log.result.fatigue==="number"){if(log.result.fatigue>=5)score-=0.12;else if(log.result.fatigue<=2)score+=0.03;}
  const attempts=Math.max(log.result.reps?.length||0,log.result.seconds?.length||0,log.result.emom?.length||0);
  if(expectedAttempts&&attempts<expectedAttempts)score-=0.1;
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
  const ss=Array.isArray(sides)?sides.map(String):[];if(!ss.length)return undefined;
  let rightBest=0,leftBest=0,rightQualifying=0,leftQualifying=0;
  reps.forEach((v,i)=>{if(ss[i]==="R"){rightBest=Math.max(rightBest,v);if(v>=minReps)rightQualifying++;}if(ss[i]==="L"){leftBest=Math.max(leftBest,v);if(v>=minReps)leftQualifying++;}});
  return {rightBest,leftBest,rightQualifying,leftQualifying,balanced:rightQualifying>0&&leftQualifying>0&&Math.abs(rightBest-leftBest)<=1};
}

export function normalizedBodyweightPerformance(rawValue:number,currentWeightKg?:number,referenceWeightKg?:number):BodyweightPerformance{
  if(!currentWeightKg||currentWeightKg<=0||!referenceWeightKg||referenceWeightKg<=0)return {currentWeightKg,referenceWeightKg,rawValue,normalizedValue:rawValue,interpretation:"NO_WEIGHT_DATA"};
  const normalized=rawValue*(referenceWeightKg/currentWeightKg);
  const delta=((normalized-rawValue)/Math.max(rawValue,0.0001))*100;
  return {currentWeightKg,referenceWeightKg,rawValue,normalizedValue:normalized,normalizedDeltaPct:delta,interpretation:delta>3?"IMPROVING":delta<-3?"DECLINING":"STABLE"};
}

function bandForTarget(kind:ExerciseBlock["kind"],target:string){
  const r=parseTargetRange(target);return {min:r.min,max:r.max};
}

function performanceBandFor(block:ExerciseBlock,reps:number[],seconds:number[],emom:number[]):PerformanceBand{
  const r=bandForTarget(block.kind,block.target); if(r.max<=0)return "INSUFFICIENT_DATA";
  if(block.kind==="EMOM"){
    if(!emom.length)return "INSUFFICIENT_DATA";
    const qualifying=emom.filter(v=>v>=r.min).length;
    if(qualifying!==emom.length)return "BELOW_RANGE";
    return emom.every(v=>v>=r.max)?"AT_UPPER":"IN_RANGE";
  }
  const values=block.kind==="SKILL_STATIC"||block.previousMode==="seconds"?seconds:reps;
  if(!values.length)return "INSUFFICIENT_DATA";
  const expected=Math.max(1,block.sets||values.length);
  const first=values.slice(0,expected);if(first.length<expected)return "BELOW_RANGE";
  if(first.some(v=>v<r.min))return "BELOW_RANGE";
  return first.every(v=>v>=r.max)?"AT_UPPER":"IN_RANGE";
}

export interface ExposureDecision {
  decision:CoachExposureDecision;
  performanceBand:PerformanceBand;
  qualifies:boolean;
  reasons:string[];
  confidence:number;
  stabilityScore:number;
}

/**
 * Interprets one exposure in context. It deliberately separates:
 * - being inside the prescribed range;
 * - being at the upper edge needed to justify progression;
 * - temporary recovery/fatigue blockers;
 * - variant-quality requirements.
 */
export function decideExposure(block:ExerciseBlock,log:CoachingLogRecord,criteria:ProgressionCriteria):ExposureDecision{
  const readiness=analyzeReadiness(log.session?.readiness);
  const profile=trainingProfileForBlock(block);
  const reps=nums(log.result.reps),seconds=nums(log.result.seconds),emom=nums(log.result.emom);
  const band=performanceBandFor(block,reps,seconds,emom);
  const reasons:string[]=[];
  let stabilityScore=100;
  const quality=qualityScore(log);
  const qKnown=qualityIsKnown(log);

  if(log.status==="skipped"){return {decision:"REVIEW",performanceBand:"INSUFFICIENT_DATA",qualifies:false,reasons:["Exercise was skipped; no performance conclusion is drawn."],confidence:90,stabilityScore:0};}
  if(log.status==="modified"){reasons.push("Exercise was modified/substituted; compare this exposure only with the same modified variant.");return {decision:"REVIEW",performanceBand:band,qualifies:false,reasons,confidence:75,stabilityScore};}
  if(readiness.status==="PAIN_REVIEW"){return {decision:"REGRESS",performanceBand:band,qualifies:false,reasons:["Blocking joint-pain signal; do not use this exposure as progression evidence."],confidence:96,stabilityScore};}
  if(readiness.status==="RECOVERY"){return {decision:"REDUCE_VOLUME",performanceBand:band,qualifies:false,reasons:[...readiness.reasons,"Recovery gates block progression."],confidence:90,stabilityScore};}
  if(log.result.fatigue!=null&&log.result.fatigue>=5){return {decision:"REDUCE_VOLUME",performanceBand:band,qualifies:false,reasons:["Session fatigue is 5/5; consolidate quality instead of adding load."],confidence:86,stabilityScore};}
  if(profile.fatigueCost>=5&&log.result.rir!=null&&log.result.rir<1){return {decision:"HOLD",performanceBand:band,qualifies:false,reasons:[`High-fatigue ${profile.role} exposure at RIR ${log.result.rir}; retain the current dose until quality improves.`],confidence:88,stabilityScore};}

  if(criteria.type==="emom"){
    const stats=emomStability(emom);stabilityScore=stats.score;
    const r=parseTargetRange(block.target);const stable=stats.dropoffPct<=15&&stats.cvPct<=20&&stats.lastVsFirstPct>=85;
    const top=emom.length>=criteria.minutes&&emom.slice(0,criteria.minutes).every(v=>v>=r.max);
    const floor=emom.length>=criteria.minutes&&emom.slice(0,criteria.minutes).every(v=>v>=Math.max(1,r.min));
    if(!floor){return {decision:"HOLD",performanceBand:"BELOW_RANGE",qualifies:false,reasons:[`Output fell below the prescribed floor (${r.min}/min).`,"Do not increase the target yet."],confidence:88,stabilityScore};}
    if(top&&!stable){return {decision:"HOLD",performanceBand:"AT_UPPER",qualifies:false,reasons:["Upper target was reached, but EMOM output was not stable enough to justify progression."],confidence:92,stabilityScore};}
    if(top&&stable&&readiness.allowProgression&&(criteria.minRir==null||((log.result.rir??-1)>=criteria.minRir))){return {decision:"PROGRESS",performanceBand:"AT_UPPER",qualifies:true,reasons:[`All ${criteria.minutes} minutes reached the upper target with stable output.`],confidence:95,stabilityScore};}
    reasons.push("Prescribed range is being met; keep the current target and build another comparable exposure.");
    if(criteria.minRir!=null&&log.result.rir==null)reasons.push("RIR is not recorded; progression evidence is incomplete.");
    return {decision:"HOLD",performanceBand:"IN_RANGE",qualifies:false,reasons,confidence:82,stabilityScore};
  }

  const range=parseTargetRange(block.target);
  const values=block.kind==="SKILL_STATIC"||block.previousMode==="seconds"?seconds:reps;
  const expected=Math.max(1,block.sets||values.length);
  const floor=values.length>=expected&&values.slice(0,expected).every(v=>v>=range.min);
  const top=values.length>=expected&&values.slice(0,expected).every(v=>v>=range.max);
  if(!floor){
    if((log.result.rir??1)<=0||readiness.status==="CAUTION")reasons.push("Performance fell below the prescribed floor on a fatigued/caution exposure; avoid reacting with an automatic regression.");
    else reasons.push(`At least one set is below the prescribed floor (${range.min}).`);
    return {decision:"HOLD",performanceBand:"BELOW_RANGE",qualifies:false,reasons,confidence:84,stabilityScore};
  }
  if(top&&readiness.allowProgression&&(criteria.minRir==null||((log.result.rir??-1)>=criteria.minRir))){
    if(criteria.type!=="skill_quality" && criteria.requireClean && (!qKnown || (quality??0)<0.8)) return {decision:"HOLD",performanceBand:"AT_UPPER",qualifies:false,reasons:["Upper target reached, but clean execution evidence is missing."],confidence:90,stabilityScore};
    return {decision:"PROGRESS",performanceBand:"AT_UPPER",qualifies:true,reasons:[`All prescribed sets reached the upper target (${range.max}).`],confidence:94,stabilityScore};
  }
  if(top&&criteria.minRir!=null&&(log.result.rir==null||log.result.rir<criteria.minRir))reasons.push(`Upper target reached, but minimum RIR ${criteria.minRir} evidence is missing or not met.`);
  else reasons.push(`Performance is inside the prescribed ${range.min}–${range.max} range; consolidate before increasing difficulty.`);
  return {decision:"HOLD",performanceBand:"IN_RANGE",qualifies:false,reasons,confidence:82,stabilityScore};
}

export function evaluateProgression(block:ExerciseBlock,log:CoachingLogRecord,criteria:ProgressionCriteria,referenceWeightKg?:number):ProgressionEvaluation{
  if(log.status!=="complete") return {qualifies:false,qualityKnown:qualityIsKnown(log),qualityScore:qualityScore(log),stabilityScore:0,reasons:[`This exposure is ${log.status}; it is not eligible for progression qualification.`],performanceBand:"INSUFFICIENT_DATA",decision:"HOLD",confidence:100,comparableExposure:false};
  const reps=nums(log.result.reps),seconds=nums(log.result.seconds),emom=nums(log.result.emom);
  const qKnown=qualityIsKnown(log),qScore=qualityScore(log);
  let qualifies=false;let stabilityScore=100;let side:SidePerformance|undefined;
  const raw=max(seconds)||max(reps)||sum(emom);const bw=log.session?.readiness?.weightKg;
  const bodyweightPerformance=raw>0?normalizedBodyweightPerformance(raw,bw,referenceWeightKg):undefined;
  const exposure=decideExposure(block,log,criteria);
  const reasons=[...exposure.reasons];

  if(criteria.type==="reps"){
    side=sidePerformance(reps,log.result.sides||[],criteria.minReps);
    const perSet=reps.length>=criteria.minSets&&reps.slice(0,criteria.minSets).every(v=>v>=criteria.minReps);
    const sidePass=criteria.side==="both"?Boolean(side&&side.rightQualifying>=(criteria.minQualifyingRepsPerSide??1)&&side.leftQualifying>=(criteria.minQualifyingRepsPerSide??1)):true;
    qualifies=perSet&&sidePass;
    if(criteria.minRir!=null&&(log.result.rir==null||log.result.rir<criteria.minRir))qualifies=false;
    if(criteria.requireClean&&(!qKnown||(qScore??0)<0.8))qualifies=false;
    if(!perSet)reasons.push(`Need ${criteria.minSets} sets at ${criteria.minReps}+ reps.`);
    if(criteria.minRir!=null&&log.result.rir==null)reasons.push("RIR is not recorded; progression evidence is incomplete.");
    if(criteria.requireClean&&!qKnown)reasons.push("Execution quality is not recorded; progression evidence is incomplete.");
    if(!sidePass)reasons.push("Both sides must meet the consistency standard.");
  }else if(criteria.type==="seconds"){
    qualifies=seconds.length>=criteria.minHolds&&seconds.slice(0,criteria.minHolds).every(v=>v>=criteria.minSeconds);
    if(criteria.minRir!=null&&(log.result.rir==null||log.result.rir<criteria.minRir))qualifies=false;
    if(criteria.requireClean&&(!qKnown||(qScore??0)<0.8))qualifies=false;
    if(criteria.minRir!=null&&log.result.rir==null)reasons.push("RIR is not recorded; progression evidence is incomplete.");
    if(criteria.requireClean&&!qKnown)reasons.push("Execution quality is not recorded; progression evidence is incomplete.");
    if(!qualifies)reasons.push(`Need ${criteria.minHolds} clean holds at ${criteria.minSeconds}s+.`);
  }else if(criteria.type==="emom"){
    stabilityScore=emomStability(emom).score;
    const stats=emomStability(emom);
    const floor=emom.length>=criteria.minutes&&emom.slice(0,criteria.minutes).every(v=>v>=criteria.minPerMinute);
    const dropOk=criteria.maxDropoffPct==null||stats.dropoffPct<=criteria.maxDropoffPct;
    const cvOk=criteria.maxCvPct==null||stats.cvPct<=criteria.maxCvPct;
    const lastOk=criteria.minLastVsFirstPct==null||stats.lastVsFirstPct>=criteria.minLastVsFirstPct;
    qualifies=floor&&dropOk&&cvOk&&lastOk;
    if(criteria.minRir!=null&&(log.result.rir==null||log.result.rir<criteria.minRir))qualifies=false;
    if(!floor)reasons.push(`Need ${criteria.minutes} minutes above the qualification floor.`);
    if(!dropOk||!cvOk||!lastOk)reasons.push(`EMOM stability is ${Math.round(stats.score)}/100; keep output more even across the block.`);
  }else{
    const cleanEnough=qKnown&&(qScore??0)>=criteria.minQualityPct/100;qualifies=criteria.minExposures<=1&&cleanEnough;
    if(!cleanEnough)reasons.push(qKnown?`Quality ${Math.round((qScore??0)*100)}% is below ${criteria.minQualityPct}%.`:"Execution quality is not recorded; progression evidence is incomplete.");
  }
  if(exposure.decision!=="PROGRESS"&&qualifies&&criteria.type!=="skill_quality"){
    // Qualification for historical mastery can still be valid, but a single exposure never triggers a future change by itself.
    reasons.push("Exposure meets the formal progression criteria; the Coach still requires the configured consecutive-exposure gate.");
  }
  if(qualifies)reasons.push(`Qualifies with ${qKnown?`recorded quality ${Math.round((qScore??0)*100)}%`:`no explicit quality requirement`}.`);
  return {qualifies,qualityKnown:qKnown,qualityScore:qScore,stabilityScore,reasons,sidePerformance:side,bodyweightPerformance,performanceBand:exposure.performanceBand,decision:exposure.decision,confidence:exposure.confidence};
}

export function referenceWeightFromLogs(logs:CoachingLogRecord[]){
  const weights=logs.map(x=>x.session?.readiness?.weightKg).filter((x):x is number=>typeof x==="number"&&x>0);return weights.length?weights[weights.length-1]:undefined;
}

export { criteriaForBlock, masteryCriteriaForBlock, masteryCriteriaForBlock as variantMasteryCriteria, progressionGateForBlock, progressionSpecForBlock, nextTargetFromSpec } from "./progressionRegistry";

/** Compare the prescription snapshot, not just the exercise name. */
export function isSamePrescription(a:CoachingLogRecord,b:CoachingLogRecord):boolean{
  const ap=a.prescription,bp=b.prescription;
  if(!ap||!bp)return true;
  return String(ap.variantId||"")===String(bp.variantId||"")&&String(ap.targetRange||"")===String(bp.targetRange||"")&&(ap.sets??null)===(bp.sets??null)&&(ap.minutes??null)===(bp.minutes??null)&&(ap.restSec??null)===(bp.restSec??null)&&(ap.kind??"")===(bp.kind??"") && String(a.result.band||"")===String(b.result.band||"");
}
