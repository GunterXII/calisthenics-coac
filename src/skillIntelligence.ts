import type { ExerciseCatalogItem } from "./exercises";
import type { ExerciseBlock } from "./types";

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

type Log = any;
type Session = any;

const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sum = (v: unknown) => Array.isArray(v) ? v.reduce((a:number,b:any)=>a+n(b),0) : 0;

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

function qualities(log:Log): string[] {
  const note=String(log?.result?.note||"");
  const m=note.match(/qualities\s+([^;]+)/i);
  return m ? m[1].split("/").map((x:string)=>x.trim()) : [];
}

function cleanRatio(log:Log) {
  const qs=qualities(log);
  if (!qs.length) return 1;
  return qs.filter(x=>x.toLowerCase()==="clean").length/qs.length;
}

function painOf(session:Session) {
  const r=session?.readiness||{};
  return Math.max(n(r.wristPain),n(r.elbowPain));
}

function readinessPenalty(session:Session) {
  const r=session?.readiness||{};
  const energy=n(r.energy), sleep=n(r.sleepHours);
  return (energy>0 && energy<=2) || (sleep>0 && sleep<6);
}

function specificQualification(id:string, log:Log, block:ExerciseBlock, catalog?:ExerciseCatalogItem) {
  if (log?.status !== "complete") return false;
  const r=log.result||{};
  const reps=Array.isArray(r.reps)?r.reps.map(n):[];
  const secs=Array.isArray(r.seconds)?r.seconds.map(n):[];
  const emom=Array.isArray(r.emom)?r.emom.map(n):[];
  const rir=r.rir==null ? undefined : n(r.rir);
  const range=targetRange(block.target,catalog);
  const clean=cleanRatio(log)>=0.8;
  const within=(v:number)=>range.min>0 ? v>=range.min : v>0;
  const allWithin=(values:number[])=>values.length>0&&values.every(within);
  const allAtLeast=(values:number[],min:number)=>values.length>0&&values.every(v=>v>=min);

  switch(id){
    case "touch":
      return secs.length>=3 && secs.slice(0,3).every((v:number)=>v>=8) && cleanRatio(log)===1;
    case "touch-band":
      return secs.length>=3 && secs.slice(0,3).every((v:number)=>v>=8) && (rir==null || rir>=1);
    case "oap": {
      const sides=Array.isArray(r.sides)?r.sides:[];
      const right=reps.filter((_:number,i:number)=>sides[i]==="R").filter((v:number)=>v>=2).length;
      const left=reps.filter((_:number,i:number)=>sides[i]==="L").filter((v:number)=>v>=2).length;
      return reps.length>=6 && right>=2 && left>=2 && (rir==null || rir>=1);
    }
    case "oap-band": return reps.length>=6 && allAtLeast(reps.slice(0,6),5) && (rir==null || rir>=1);
    case "flpu": return reps.length>=5 && allAtLeast(reps.slice(0,5),4) && clean;
    case "flpu-band": return reps.length>=3 && allAtLeast(reps.slice(0,3),6) && (rir==null || rir>=1);
    case "pike": return reps.length>=3 && allAtLeast(reps.slice(0,3),10) && (rir==null || rir>=1);
    case "diamond": return reps.length>=3 && allAtLeast(reps.slice(0,3),15) && (rir==null || rir>=1);
    case "archer-push": case "archer-pull": return reps.length>=6 && allAtLeast(reps.slice(0,6),8);
    case "high-pull": return reps.length>=4 && allAtLeast(reps.slice(0,4),5) && clean;
    case "dips": return emom.length>=10 && Math.min(...emom)>=30 && (emomStats(emom).drop<15) && (rir==null || rir>=2);
    case "pullup": return emom.length>=10 && Math.min(...emom)>=12 && emomStats(emom).drop<15;
    case "close-chin": return emom.length>=10 && Math.min(...emom)>=10 && emomStats(emom).drop<15;
    case "close-pull": return emom.length>=10 && Math.min(...emom)>=9 && emomStats(emom).drop<15;
    case "deep": return emom.length>=10 && Math.max(...emom)>=12 && emomStats(emom).drop<15;
    default:
      if (catalog?.kind === "HOLD" || block.kind === "SKILL_STATIC") return secs.length>=Math.max(3,block.sets||3) && allWithin(secs.slice(0,block.sets||3)) && clean;
      if (catalog?.kind === "REPS" || block.kind === "SKILL_REPS" || block.kind === "PERFORMANCE") return reps.length>=Math.max(3,block.sets||3) && allWithin(reps.slice(0,block.sets||3)) && (rir==null || rir>=1);
      return false;
  }
}

function emomStats(v:number[]){
  if(!v.length)return{drop:100};
  const best=Math.max(...v),worst=Math.min(...v);
  return {drop:best?((best-worst)/best)*100:100};
}

function lastLogsFor(sessions:Session[], id:string, catalogId?:string) {
  const ids=new Set([id,catalogId].filter(Boolean).map(String));
  return sessions.flatMap((s:Session)=>Array.isArray(s?.exercise_logs)?s.exercise_logs.map((l:Log)=>({...l,__session:s})):[])
    .filter((l:Log)=>ids.has(String(l.exercise_id)) && l.status!=="skipped")
    .sort((a:Log,b:Log)=>new Date(b.logged_at||b.__session?.completed_at||0).getTime()-new Date(a.logged_at||a.__session?.completed_at||0).getTime());
}

function streak(logs:Log[], qualify:(l:Log)=>boolean) {
  let count=0;
  for(const l of logs){ if(qualify(l)) count++; else break; }
  return count;
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
    const qualifies=(l:Log)=>specificQualification(id,l,block,cat);
    const qstreak=streak(logs,qualifies);
    const latest=logs[0];
    const latestMetric=metric(latest);
    const recent=logs.slice(0,3).map(metric).filter(x=>x.value>0);
    const best=recent.length?Math.max(...recent.map(x=>x.value)):latestMetric.value;
    const previous=recent[1]?.value;
    const delta=previous?((latestMetric.value-previous)/previous)*100:0;
    const pain=Math.max(...logs.slice(0,3).map((l:Log)=>painOf(l.__session)));
    const readinessBad=logs.slice(0,2).some((l:Log)=>readinessPenalty(l.__session));
    const quality=cleanRatio(latest);
    const exposures=logs.length;
    const confidence=Math.min(100, Math.round(25 + exposures*12 + qstreak*20 + (quality>=.8?10:0)));
    const dataQuality=exposures>=4?"HIGH":exposures>=2?"MEDIUM":"LOW";
    let decision:SkillDecision="BUILDING",level:SkillLevel="YELLOW",action="KEEP CURRENT",why="Collect more clean exposures before changing the prescription.";
    if(pain>=4){ decision="REGRESS"; level="RED"; action="REDUCE LOAD / ASSISTANCE"; why=`Recent joint-pain signal is ${pain}/5. Do not use a weak session as evidence for progression.`; }
    else if(pain>=3){ decision="REVIEW"; level="YELLOW"; action="HOLD + MONITOR PAIN"; why=`Joint-pain signal reached ${pain}/5. Keep the variant stable and review the next exposure.`; }
    else if(qstreak>=2){ decision="PROGRESS"; level="GREEN"; action="COACH REVIEW → NEXT VARIANT"; why=`The progression standard was met in ${qstreak} consecutive exposures with sufficient data quality.`; }
    else if(qstreak===1){ decision="HOLD"; level="YELLOW"; action="REPEAT STANDARD ONCE"; why="The current standard was met once. Require a second consecutive qualifying exposure before promotion."; }
    else if(logs.length>=2 && delta<=-20 && !readinessBad){ decision="REVIEW"; level="YELLOW"; action="REVIEW FATIGUE / TECHNIQUE"; why=`Latest performance is ${Math.abs(Math.round(delta))}% below the previous exposure without a clear readiness explanation.`; }
    else if(logs.length>=3 && quality<.67){ decision="REVIEW"; level="YELLOW"; action="CLEAN UP TECHNIQUE"; why=`Only ${Math.round(quality*100)}% of the latest attempts were logged as clean.`; }
    else { decision="BUILDING"; level="YELLOW"; action="KEEP CURRENT + BUILD QUALITY"; why=readinessBad?"Recent readiness was low; preserve the current skill exposure rather than forcing a progression.":"Performance is still building toward the progression standard."; }

    const next = progressionNext(catalogId, block.name);
    out.push({id:`skill-${catalogId}`,exerciseId:catalogId,name:block.name,skill,decision,level,confidence,exposures,qualifyingStreak:qstreak,latest:formatMetric(latestMetric.value,latestMetric.unit),best:best,unit:latestMetric.unit,action,why,next:decision==="PROGRESS"?next:undefined,regression:decision==="REGRESS"?"Use a more assisted/easier progression and reassess quality.":undefined,dataQuality});
  }
  return out.sort((a,b)=>decisionRank(a.decision)-decisionRank(b.decision)||b.confidence-a.confidence).slice(0,16);
}

function decisionRank(d:SkillDecision){ return d==="PROGRESS"?0:d==="REGRESS"?1:d==="REVIEW"?2:d==="HOLD"?3:4; }
function formatMetric(v:number,u:"s"|"reps"|"EMOM"|"—"){return u==="s"?`${v.toFixed(1)}s`:u==="—"?"—":`${Math.round(v)} ${u}`;}
function progressionNext(id:string,current:string){
  const map:Record<string,string>={
    "touch":"Longer Free Front Touch","touch-band":"Lighter Band Front Touch","oap":"Strict BW OAP / Higher Consistency","oap-band":"Lighter Band OAP","flpu":"Cleaner / Higher Full FL Pull-up","flpu-band":"Lighter Band FL Pull-up","pike":"Feet-Elevated Pike Push-up","diamond":"Feet-Elevated Diamond Push-up","archer-push":"Assisted One-Arm Push-up","archer-pull":"Reduced-Assistance Archer / OAP Transition","high-pull":"Higher Chest-to-Bar High Pull","dips":"Band-Resisted / Deeper Dips","pullup":"Chest-to-Bar Pull-up","close-chin":"Chest-to-Bar Chin-up","close-pull":"Chest-to-Bar Close Pull-up","deep":"Feet-Elevated Deep Push-up"
  };
  return map[id]||`${current} → next catalog progression`;
}
