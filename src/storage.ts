
import type {DayKey, MobilitySession, SessionSummary, WorkoutLog} from "./types";

const LOG_KEY="cc-v8-logs";
const SESSION_KEY="cc-v8-sessions";
const TARGET_KEY="cc-v8-targets";
const SETTINGS_KEY="cc-v8-settings";
const VARIANT_KEY="cc-v10-variants";
const DRAFT_KEY="cc-v10-draft";
const PROGRAM_OVERRIDE_KEY="cc-v12-program-overrides";
const COACH_DECISION_KEY="cc-v12-coach-decisions";
const MOBILITY_KEY="cc-v14-mobility";

export function getLogs():WorkoutLog[]{try{return JSON.parse(localStorage.getItem(LOG_KEY)||"[]")}catch{return[]}}
export function saveLogs(v:WorkoutLog[]){localStorage.setItem(LOG_KEY,JSON.stringify(v))}
export function appendLogs(v:WorkoutLog[]){
 const byId=new Map<string,WorkoutLog>(getLogs().map(x=>[x.id,x]));
 v.forEach(x=>byId.set(x.id,x));
 saveLogs([...byId.values()].sort((a,b)=>a.date-b.date));
}

export function getSessions():SessionSummary[]{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"[]")}catch{return[]}}
export function saveSession(s:SessionSummary){
 const byId=new Map<string,SessionSummary>(getSessions().map(x=>[String(x.id),x]));
 byId.set(String(s.id),s);
 localStorage.setItem(SESSION_KEY,JSON.stringify([...byId.values()].sort((a,b)=>a.date-b.date)));
 appendLogs(s.logs);
}
export function replaceSession(s:SessionSummary){
  const next=getSessions().map(x=>x.id===s.id?s:x);
  localStorage.setItem(SESSION_KEY,JSON.stringify(next));
  const ids=new Set(s.logs.map(x=>x.id));
  saveLogs([...getLogs().filter(x=>!ids.has(x.id)),...s.logs]);
}

export function mergeSessions(incoming:SessionSummary[]){
 const byId=new Map<string,SessionSummary>(getSessions().map(x=>[String(x.id),x]));
 incoming.forEach(x=>{
   const prev=byId.get(String(x.id));
   byId.set(String(x.id), !prev || x.date>=prev.date ? x : prev);
 });
 const merged=[...byId.values()].sort((a,b)=>a.date-b.date);
 localStorage.setItem(SESSION_KEY,JSON.stringify(merged));
 const logById=new Map<string,WorkoutLog>(getLogs().map(x=>[x.id,x]));
 incoming.flatMap(x=>x.logs||[]).forEach(x=>logById.set(x.id,x));
 saveLogs([...logById.values()].sort((a,b)=>a.date-b.date));
 return merged;
}


export function getMobilitySessions():MobilitySession[]{try{return JSON.parse(localStorage.getItem(MOBILITY_KEY)||"[]")}catch{return[]}}
export function saveMobilitySession(s:MobilitySession){
  const byId=new Map<string,MobilitySession>(getMobilitySessions().map(x=>[String(x.id),x]));
  byId.set(String(s.id),s);
  localStorage.setItem(MOBILITY_KEY,JSON.stringify([...byId.values()].sort((a,b)=>a.date-b.date)));
}

export function latestLog(day:DayKey,id:string){
  return getLogs().filter(x=>x.day===day&&x.exerciseId===id&&!x.skipped).sort((a,b)=>b.date-a.date)[0];
}
export function latestSession(day:DayKey){return getSessions().filter(x=>x.day===day).sort((a,b)=>b.date-a.date)[0]}

export function getTarget(id:string,fallback?:number){
  try{const x=JSON.parse(localStorage.getItem(TARGET_KEY)||"{}");return x[id]??fallback}catch{return fallback}
}
export function setTarget(id:string,value:number){
  const x=JSON.parse(localStorage.getItem(TARGET_KEY)||"{}");x[id]=value;
  localStorage.setItem(TARGET_KEY,JSON.stringify(x));
}

export function getSetting<T=any>(key:string,fallback:T):T{
  try{const x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");return (x[key]??fallback) as T}catch{return fallback}
}
export function setSetting(key:string,value:any){
  const x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");x[key]=value;
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(x));
}

export function formatClock(totalSec:number){
  const m=Math.floor(Math.max(0,totalSec)/60),s=Math.max(0,totalSec)%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
export function emomStats(v:number[]){
  if(!v.length)return{total:0,avg:0,best:0,worst:0,drop:0};
  const best=Math.max(...v),worst=Math.min(...v),total=v.reduce((a,b)=>a+b,0);
  return{total,avg:total/v.length,best,worst,drop:best?((best-worst)/best)*100:0};
}

function sum(v:number[]|undefined){return (v||[]).reduce((a,b)=>a+b,0)}

export function makeSessionReport(s:SessionSummary){
  const lines=[
    `CALISTHENICS COACH — ${s.day}`,
    `Duration: ${Math.round(s.durationSec/60)} min`,
    `Total reps: ${s.totalReps}`,
    `EMOM reps: ${s.emomReps}`,
    `Best static skill: ${s.bestSkillSeconds.toFixed(1)}s`,
    ""
  ];
  s.logs.forEach(l=>{
    let r=l.status==="skipped"?"SKIPPED":l.status==="modified"?`MODIFIED → ${l.modification||"unspecified"}`:l.status==="incomplete"?"INCOMPLETE":"COMPLETE";
    if(l.kind==="EMOM")r+=` | MINS ${(l.result.emom||[]).join("/")} | TOTAL ${sum(l.result.emom)}`;
    else if(l.kind==="SKILL_STATIC"||l.result.seconds?.length)r+=` | HOLDS ${(l.result.seconds||[]).map(x=>x.toFixed(1)).join("/")}s`;
    else if(l.result.reps?.length)r+=` | SETS ${l.result.reps.join("/")}`;
    if(l.result.sides?.length)r+=` | SIDES ${l.result.sides.join("/")}`;
    if(l.result.band&&l.result.band!=="None")r+=` | BAND ${l.result.band}`;
    if(l.result.rir!==undefined)r+=` | RIR ${l.result.rir}`;
    if(l.result.fatigue!==undefined)r+=` | FATIGUE ${l.result.fatigue}/5`;
    lines.push(`${l.exerciseName}: ${r}`);
  });
  if(s.sessionNote)lines.push("",`SESSION NOTE: ${s.sessionNote}`);
  return lines.join("\n");
}

export function makeCoachHandoff(s:SessionSummary){
  const all=getLogs();
  const lines:[string, string][]=[];
  s.logs.forEach(l=>{
    if(l.status==="skipped") return;
    const prior=all.filter(x=>x.exerciseId===l.exerciseId&&x.day===l.day&&x.date<s.date).sort((a,b)=>b.date-a.date)[0];
    if(l.kind==="EMOM"){
      const cur=sum(l.result.emom),prev=prior?sum(prior.result.emom):0;
      lines.push([l.exerciseName,`EMOM ${cur} total${prior?` · prev ${prev} · ${cur-prev>=0?"+":""}${cur-prev}`:""}`]);
    }else if(l.result.seconds?.length){
      const cur=Math.max(...l.result.seconds),prev=prior?.result.seconds?.length?Math.max(...prior.result.seconds):undefined;
      lines.push([l.exerciseName,`HOLD ${cur.toFixed(1)}s${prev!==undefined?` · prev ${prev.toFixed(1)}s · ${cur-prev>=0?"+":""}${(cur-prev).toFixed(1)}s`:""}`]);
    }else if(l.result.reps?.length){
      const cur=sum(l.result.reps),prev=prior?.result.reps?.length?sum(prior.result.reps):undefined;
      lines.push([l.exerciseName,`SETS ${l.result.reps.join("/")} · total ${cur}${prev!==undefined?` · prev total ${prev} · ${cur-prev>=0?"+":""}${cur-prev}`:""}`]);
    }
  });
  return [`CALISTHENICS COACH — ${s.day}`,`Duration ${Math.round(s.durationSec/60)} min · ${s.totalReps} reps · ${s.emomReps} EMOM`,``,`PERFORMANCE HANDOFF`,...lines.map(([n,v])=>`${n}: ${v}`)].join("\n");
}

export function makeWeeklyReport(offset=0){
  const end=Date.now()-offset*7*86400000,start=end-7*86400000;
  const ss=getSessions().filter(s=>s.date>=start&&s.date<end).sort((a,b)=>a.date-b.date);
  const reps=sum(ss.map(s=>s.totalReps)),emom=sum(ss.map(s=>s.emomReps));
  const best=ss.reduce((m,s)=>Math.max(m,s.bestSkillSeconds),0);
  const weights=ss.map(s=>s.readiness.weightKg).filter((x):x is number=>typeof x==="number"&&x>0);
  const modified=ss.flatMap(s=>s.logs).filter(l=>l.status==="modified").length;
  const incomplete=ss.flatMap(s=>s.logs).filter(l=>l.status==="incomplete").length;
  const skipped=ss.flatMap(s=>s.logs).filter(l=>l.status==="skipped").length;
  return [
    `CALISTHENICS COACH — WEEKLY REPORT`,
    `Sessions: ${ss.length}`,
    `Total reps: ${reps}`,
    `EMOM reps: ${emom}`,
    `Best static skill: ${best.toFixed(1)}s`,
    weights.length?`Weight: ${weights[0].toFixed(1)} → ${weights[weights.length-1]!.toFixed(1)} kg | avg ${(weights.reduce((a,b)=>a+b,0)/weights.length).toFixed(1)} kg`:"Weight: no data",
    `Modified: ${modified} | Incomplete: ${incomplete} | Skipped: ${skipped}`,
    "",
    ...ss.map(s=>`${s.day}: ${Math.round(s.durationSec/60)} min | ${s.totalReps} reps | ${s.emomReps} EMOM | best ${s.bestSkillSeconds.toFixed(1)}s`)
  ].join("\n");
}

export function exportBackup(){
  return JSON.stringify({
    schemaVersion:9,
    exportedAt:Date.now(),
    logs:getLogs(),
    sessions:getSessions(),
    targets:JSON.parse(localStorage.getItem(TARGET_KEY)||"{}"),
    settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}"),
    variants:getVariants(),
    programOverrides:getProgramOverrides(),
    coachDecisions:getCoachDecisions(),
    mobilitySessions:getMobilitySessions()
  },null,2);
}

export function importBackup(text:string){
  const data=JSON.parse(text);
  if(data.schemaVersion!==8&&data.schemaVersion!==9)throw new Error("Unsupported backup version");
  if(!Array.isArray(data.logs)||!Array.isArray(data.sessions))throw new Error("Invalid backup");
  localStorage.setItem(LOG_KEY,JSON.stringify(data.logs));
  localStorage.setItem(SESSION_KEY,JSON.stringify(data.sessions));
  localStorage.setItem(TARGET_KEY,JSON.stringify(data.targets||{}));
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(data.settings||{}));
  localStorage.setItem(VARIANT_KEY,JSON.stringify(data.variants||{}));
  localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(data.programOverrides||{}));
  localStorage.setItem(COACH_DECISION_KEY,JSON.stringify(data.coachDecisions||[]));
  localStorage.setItem(MOBILITY_KEY,JSON.stringify(data.mobilitySessions||[]));
}

export function currentWeekBucket(date=Date.now()){
  const d=new Date(date); const day=(d.getDay()+6)%7;
  const monday=new Date(d); monday.setHours(0,0,0,0); monday.setDate(d.getDate()-day);
  return monday.getTime();
}

export function getVariants():Record<string,any>{
  try{return JSON.parse(localStorage.getItem(VARIANT_KEY)||"{}")}catch{return{}}
}
export function getVariant(id:string){return getVariants()[id]}
export function setVariant(id:string,value:any){
  const x=getVariants();x[id]=value;localStorage.setItem(VARIANT_KEY,JSON.stringify(x));
}
export function clearVariant(id:string){
  const x=getVariants();delete x[id];localStorage.setItem(VARIANT_KEY,JSON.stringify(x));
}

export type CoachDecision={id:string;date:number;type:"program"|"progression"|"coach";exerciseId?:string;title:string;detail:string;from?:string;to?:string};
export function getCoachDecisions():CoachDecision[]{try{return JSON.parse(localStorage.getItem(COACH_DECISION_KEY)||"[]")}catch{return[]}}
export function saveCoachDecision(d:Omit<CoachDecision,"id"|"date">){const next:{id:string;date:number;type:CoachDecision["type"];exerciseId?:string;title:string;detail:string;from?:string;to?:string}={...d,id:crypto.randomUUID(),date:Date.now()};localStorage.setItem(COACH_DECISION_KEY,JSON.stringify([...getCoachDecisions(),next].slice(-100)))}
export function clearCoachDecisions(){localStorage.removeItem(COACH_DECISION_KEY)}

export type ProgramOverride={exerciseId:string;catalogExerciseId?:string;name?:string;detail?:string;kind?:string;target?:string;sets?:number;rest?:number;minutes?:number;bandOptions?:string[];defaultBand?:string;updatedAt:number;previous?:ProgramOverride|null};
export function getProgramOverrides():Record<string,ProgramOverride>{try{return JSON.parse(localStorage.getItem(PROGRAM_OVERRIDE_KEY)||"{}")}catch{return{}}}
export function getProgramOverride(id:string){return getProgramOverrides()[id]}
export function setProgramOverride(id:string,value:ProgramOverride){const x=getProgramOverrides();const previous=x[id]||null;x[id]={...value,previous};localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(x));return previous}
export function restoreProgramOverride(id:string,previous:ProgramOverride|null){const x=getProgramOverrides();if(previous)x[id]=previous;else delete x[id];localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(x))}
export function clearProgramOverride(id:string){const x=getProgramOverrides();delete x[id];localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(x))}
export function clearAllProgramOverrides(){localStorage.removeItem(PROGRAM_OVERRIDE_KEY)}

export function mergeProgramLayer(incomingOverrides:Record<string,ProgramOverride>, incomingDecisions:CoachDecision[]){
  if(Object.keys(incomingOverrides).length){
    const current=getProgramOverrides();
    for(const [id,value] of Object.entries(incomingOverrides)){
      const prev=current[id];
      if(!prev || value.updatedAt>=prev.updatedAt) current[id]=value;
    }
    localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(current));
  }
  if(incomingDecisions.length){
    const current=getCoachDecisions();
    const byId=new Map(current.map(d=>[String(d.id),d]));
    incomingDecisions.forEach(d=>byId.set(String(d.id),d));
    localStorage.setItem(COACH_DECISION_KEY,JSON.stringify([...byId.values()].sort((a,b)=>a.date-b.date).slice(-200)));
  }
}

export function getDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch{return null}}
export function saveDraft(d:any){localStorage.setItem(DRAFT_KEY,JSON.stringify({...d,updatedAt:Date.now()}))}
export function clearDraft(){localStorage.removeItem(DRAFT_KEY)}
