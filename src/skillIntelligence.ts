import type { ExerciseCatalogItem } from "./exercises";
import type { ExerciseBlock, SessionSummary, WorkoutLog } from "./types";
import {evaluateProgression,criteriaForBlock,progressionStreak,analyzeReadiness,decideExposure} from "./coachingEngine";
import {getProgressionSpec} from "./program";

export type SkillDecision = "PROGRESS" | "HOLD" | "REGRESS" | "REVIEW" | "BUILDING";
export type SkillLevel = "GREEN" | "YELLOW" | "RED";

export interface SkillInsight {
  id: string;
  exerciseId: string;
  name: string;
  skill: string;
  decision: SkillDecision;
  level: SkillLevel;
  confidence: number;
  exposures: number;
  qualifyingStreak: number;
  latest: string;
  best: number;
  unit: "s" | "reps" | "EMOM" | "—";
  action: string;
  why: string;
  next?: string;
  regression?: string;
  dataQuality: "LOW" | "MEDIUM" | "HIGH";
}

type Log = WorkoutLog & { __session?: SessionSummary };
type Session = SessionSummary;

const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sum = (v: unknown) => Array.isArray(v) ? v.reduce((a:number,b:unknown)=>a+n(b),0) : 0;

function metric(log: Log) {
  const r = log?.result || {};
  if (Array.isArray(r.seconds) && r.seconds.length) return { value: Math.max(...r.seconds.map(n)), unit:"s" as const };
  if (Array.isArray(r.reps) && r.reps.length) return { value: sum(r.reps), unit:"reps" as const };
  if (Array.isArray(r.emom) && r.emom.length) return { value: sum(r.emom), unit:"EMOM" as const };
  return { value:0, unit:"—" as const };
}

function targetRange(target:string|undefined, catalog?:ExerciseCatalogItem) {
  const t = target || catalog?.defaultTarget || "";
  const m = t.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if (m) return { min:Number(m[1]), max:Number(m[2]) };
  const one = t.match(/(\d+(?:\.\d+)?)/);
  if (one) return { min:Number(one[1]), max:Number(one[1]) };
  if (catalog?.holdMin!=null || catalog?.holdMax!=null) return { min:n(catalog.holdMin), max:n(catalog.holdMax) };
  if (catalog?.repMin!=null || catalog?.repMax!=null) return { min:n(catalog.repMin), max:n(catalog.repMax) };
  return { min:0, max:0 };
}

function cleanRatio(log:Log) {
  const quality=log.result.quality;
  if(!quality?.length) return undefined;
  return quality.filter(x=>x==="Clean").length/quality.length;
}

function painOf(session:Session) {
  const r=session?.readiness||{};
  return Math.max(n(r.wristPain),n(r.elbowPain));
}



function specificQualification(id:string, log:Log, block:ExerciseBlock, catalog?:ExerciseCatalogItem) {
  return evaluateProgression(block,{exerciseId:String(log.exerciseId||id),status:String(log.status||"incomplete"),result:log.result||{},session:{readiness:log.__session?.readiness,date:log.date}},criteriaForBlock(block)).qualifies;
}

function lastLogsFor(sessions:Session[], id:string, catalogId?:string) {
  const ids=new Set([id,catalogId].filter(Boolean).map(String));
  return sessions.flatMap((s:Session)=>s.logs.map((l:Log)=>({...l,__session:s})))
    .filter((l:Log)=>ids.has(String(l.exerciseId)) && l.status!=="skipped")
    .sort((a:Log,b:Log)=>b.date-a.date);
}

function streak(logs:Log[], qualify:(l:Log)=>boolean) {
  let count=0;
  for(const l of logs){ if(qualify(l)) count++; else break; }
  return count;
}


function coachingRecordForSkillLog(log:Log){
  return {exerciseId:log.exerciseId,status:log.status,result:log.result,session:{readiness:log.__session?.readiness,date:log.date}};
}

export function analyzeSkillIntelligence(sessions:Session[], blocks:ExerciseBlock[], catalog:ExerciseCatalogItem[]):SkillInsight[] {
  const out:SkillInsight[]=[];
  for(const block of blocks){
    const id=String(block.id);
    const catalogId=String(block.catalogExerciseId||id).split("__")[0];
    const cat=catalog.find(x=>x.id===catalogId)||catalog.find(x=>x.id===id);
    const skill=String(cat?.skill||"GENERAL");
    const logs=lastLogsFor(sessions,id,catalogId);
    if(!logs.length) continue;
    const latest=logs[0];
    const latestMetric=metric(latest);
    const recent=logs.slice(0,3).map(metric).filter(x=>x.value>0);
    const best=recent.length?Math.max(...recent.map(x=>x.value)):latestMetric.value;
    const exposures=logs.length;
    const latestRecord=coachingRecordForSkillLog(latest);
    const latestEval=evaluateProgression(block,latestRecord,criteriaForBlock(block));
    const latestDecision=decideExposure(block,latestRecord,criteriaForBlock(block));
    const qstreak=progressionStreak(block,logs.slice(-Math.max(2,(criteriaForBlock(block).consecutiveSessions||2))).map(l=>coachingRecordForSkillLog(l)),criteriaForBlock(block));
    const readiness=analyzeReadiness(latest.__session?.readiness);
    const confidence=Math.min(100,Math.round(25 + exposures*12 + qstreak*20 + (latestEval.qualityKnown?10:0)));
    const dataQuality=exposures>=4?"HIGH":exposures>=2?"MEDIUM":"LOW";
    let decision:SkillDecision="BUILDING",level:SkillLevel="YELLOW",action="KEEP CURRENT",why="Collect more comparable exposures before changing the prescription.";
    if(readiness.status==="PAIN_REVIEW"||readiness.gates.pain==="BLOCK"){ decision=latestDecision.decision==="REGRESS"?"REGRESS":"REVIEW"; level="RED"; action="HOLD + REVIEW READINESS"; why="Readiness has a blocking pain gate; performance is not used as progression evidence."; }
    else if(latestDecision.decision==="REDUCE_VOLUME"){ decision="BUILDING"; level="YELLOW"; action="REDUCE VOLUME / RECOVER"; why=latestDecision.reasons[0]||"Recovery signal is too high for progression."; }
    else if(qstreak>=2 && latestEval.qualifies && latestDecision.decision==="PROGRESS"){ decision="PROGRESS"; level="GREEN"; action="COACH REVIEW → NEXT VARIANT"; why=`The central progression engine reports ${qstreak} consecutive comparable qualifying exposures.`; }
    else if(qstreak===1){ decision="HOLD"; level="YELLOW"; action="REPEAT STANDARD ONCE"; why="The central progression engine has one qualifying exposure; another comparable exposure is required."; }
    else if(!latestEval.qualityKnown && latestEval.reasons.some((r:string)=>r.includes("quality"))){ decision="HOLD"; level="YELLOW"; action="RECORD QUALITY / HOLD"; why="Execution quality is missing, so the Coach will not treat the exposure as clean evidence."; }
    else if(!readiness.allowProgression){ decision="BUILDING"; level="YELLOW"; action="KEEP CURRENT + BUILD QUALITY"; why="Readiness does not authorize progression yet."; }
    else { decision="BUILDING"; level="YELLOW"; action="KEEP CURRENT + BUILD QUALITY"; why=latestDecision.reasons[0]||"Performance is still building toward the progression standard."; }

    const next = progressionNext(catalogId, block.name);
    out.push({id:`skill-${catalogId}`,exerciseId:catalogId,name:block.name,skill,decision,level,confidence,exposures,qualifyingStreak:qstreak,latest:formatMetric(latestMetric.value,latestMetric.unit),best:best,unit:latestMetric.unit,action,why,next:decision==="PROGRESS"?next:undefined,regression:undefined,dataQuality});
  }
  return out.sort((a,b)=>decisionRank(a.decision)-decisionRank(b.decision)||b.confidence-a.confidence).slice(0,16);
}

function decisionRank(d:SkillDecision){ return d==="PROGRESS"?0:d==="REGRESS"?1:d==="REVIEW"?2:d==="HOLD"?3:4; }
function formatMetric(v:number,u:"s"|"reps"|"EMOM"|"—"){return u==="s"?`${v.toFixed(1)}s`:u==="—"?"—":`${Math.round(v)} ${u}`;}
function progressionNext(id:string,current:string){
  return getProgressionSpec(id)?.next || `${current} → next catalog progression`;
}
