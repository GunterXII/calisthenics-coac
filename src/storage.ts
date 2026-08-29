
import {exerciseExposureKeyString} from "./types";
import type {DayKey, MobilitySession, SessionSummary, WorkoutLog, ProgramOverride, CoachDecision, CoachProposal, CurrentVariantState, ExerciseExposureKey} from "./types";
export type {ProgramOverride, CoachDecision, CoachProposal, CurrentVariantState} from "./types";

const LOG_KEY="cc-v8-logs";
const SESSION_KEY="cc-v8-sessions";
const TARGET_KEY="cc-v8-targets";
const SETTINGS_KEY="cc-v8-settings";
const VARIANT_KEY="cc-v10-variants";
const DRAFT_KEY="cc-v10-draft";
const PROGRAM_OVERRIDE_KEY="cc-v12-program-overrides";
const COACH_DECISION_KEY="cc-v12-coach-decisions";
const MOBILITY_KEY="cc-v14-mobility";
const EMOM_DURATION_KEY="cc-v15-emom-duration";

function normalizeLog(raw:Omit<WorkoutLog,"sessionId"> & Partial<Pick<WorkoutLog,"sessionId">>):WorkoutLog{
  return {...raw,sessionId:raw.sessionId||`legacy:${raw.id}`,variantId:raw.variantId||raw.exerciseId};
}
export function getLogs():WorkoutLog[]{try{const raw=JSON.parse(localStorage.getItem(LOG_KEY)||"[]");return Array.isArray(raw)?raw.map(normalizeLog):[]}catch{return[]}}
export function saveLogs(v:WorkoutLog[]){localStorage.setItem(LOG_KEY,JSON.stringify(v))}
export function appendLogs(v:WorkoutLog[]){
 const byId=new Map<string,WorkoutLog>(getLogs().map(x=>[x.id,x]));
 v.forEach(x=>byId.set(x.id,x));
 saveLogs([...byId.values()].sort((a,b)=>a.date-b.date));
}

export function getSessions():SessionSummary[]{try{const raw=JSON.parse(localStorage.getItem(SESSION_KEY)||"[]");return Array.isArray(raw)?raw.map(s=>({...s,logs:(s.logs||[]).map((l:Omit<WorkoutLog,"sessionId"> & Partial<Pick<WorkoutLog,"sessionId">>)=>normalizeLog(l))})):[]}catch{return[]}}
export function saveSession(s:SessionSummary){
 const normalized={...s,logs:s.logs.map(l=>({...l,sessionId:s.id}))};
 const byId=new Map<string,SessionSummary>(getSessions().map(x=>[String(x.id),x]));
 byId.set(String(normalized.id),normalized);
 localStorage.setItem(SESSION_KEY,JSON.stringify([...byId.values()].sort((a,b)=>a.date-b.date)));
 appendLogs(normalized.logs);
}
export function replaceSession(s:SessionSummary){
  const normalized={...s,logs:s.logs.map(l=>({...l,sessionId:s.id}))};
  const next=getSessions().map(x=>x.id===s.id?normalized:x);
  localStorage.setItem(SESSION_KEY,JSON.stringify(next));
  const ids=new Set(normalized.logs.map(x=>x.id));
  saveLogs([...getLogs().filter(x=>!ids.has(x.id)),...normalized.logs]);
}

export function mergeSessions(incoming:SessionSummary[]){
 const byId=new Map<string,SessionSummary>(getSessions().map(x=>[String(x.id),x]));
 incoming.forEach(x=>{
   const normalized={...x,logs:(x.logs||[]).map(l=>normalizeLog({...l,sessionId:x.id}))};
   const prev=byId.get(String(normalized.id));
   byId.set(String(normalized.id), !prev || normalized.date>=prev.date ? normalized : prev);
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

export function latestLog(day:DayKey,id:string,beforeDate?:number,variantId?:string){
  return getLogs()
    .filter(x=>x.day===day&&x.exerciseId===id&&!x.skipped&&x.status==="complete"&&(beforeDate===undefined||x.date<beforeDate)&&(!variantId||exerciseExposureKeyString({exerciseId:x.exerciseId,variantId:x.variantId||x.exerciseId})===exerciseExposureKeyString({exerciseId:id,variantId})))
    .sort((a,b)=>b.date-a.date)[0];
}
export function latestSession(day:DayKey){return getSessions().filter(x=>x.day===day).sort((a,b)=>b.date-a.date)[0]}

interface TodayTargetState { value:number; updatedAt:number; min:number; max:number; }

export function getTodayTarget(id:string,fallback:number,min=Number.NEGATIVE_INFINITY,max=Number.POSITIVE_INFINITY,programUpdatedAt=0){
  try{
    const raw=JSON.parse(localStorage.getItem(TARGET_KEY)||"{}");
    const entry=raw?.[id];
    if(entry && typeof entry==="object") {
      const value=Number(entry.value);
      const updatedAt=Number(entry.updatedAt)||0;
      if(Number.isFinite(value) && updatedAt>=programUpdatedAt) return Math.max(min,Math.min(max,value));
      return fallback;
    }
    // Backward compatibility for the old numeric target format. Legacy values are
    // treated as older than any explicit program override.
    if(typeof entry==="number" && programUpdatedAt<=0) return Math.max(min,Math.min(max,entry));
    return fallback;
  }catch{return fallback}
}

export function setTodayTarget(id:string,value:number,min=Number.NEGATIVE_INFINITY,max=Number.POSITIVE_INFINITY){
  const x=JSON.parse(localStorage.getItem(TARGET_KEY)||"{}");
  x[id]={value:Math.max(min,Math.min(max,value)),updatedAt:Date.now(),min,max};
  localStorage.setItem(TARGET_KEY,JSON.stringify(x));
}

// Legacy aliases kept for imported V8/V9 backups. New workout code should use
// getTodayTarget/setTodayTarget so program overrides can supersede older values.
export function getTarget(id:string,fallback?:number){return getTodayTarget(id,fallback??0)}
export function setTarget(id:string,value:number){setTodayTarget(id,value)}

export function getEmomDuration(id:string,fallback=10){
  try{const x=JSON.parse(localStorage.getItem(EMOM_DURATION_KEY)||"{}");const v=Number(x[id]);return Number.isFinite(v)&&v>0?v:fallback}catch{return fallback}
}
export function setEmomDuration(id:string,value:number){
  const x=JSON.parse(localStorage.getItem(EMOM_DURATION_KEY)||"{}");x[id]=value;
  localStorage.setItem(EMOM_DURATION_KEY,JSON.stringify(x));
}

export function getSetting<T>(key:string,fallback:T):T{
  try{const x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");return (x[key]??fallback) as T}catch{return fallback}
}
export function setSetting<T>(key:string,value:T){
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

function prescriptionText(p:import("./types").PrescriptionSnapshot|undefined){
  if(!p)return null;
  const target=p.todayTarget!==undefined?`${p.todayTarget}${p.kind==="EMOM"?"/min":""}`:p.targetRange;
  const dose=p.kind==="EMOM"?`${p.minutes||10} min EMOM`:`${p.sets||"?"} sets`;
  const rest=p.restSec>0?` · ${p.restSec}s rest`:"";
  const band=p.defaultBand&&p.defaultBand!=="None"?` · default ${p.defaultBand}`:"";
  return `${dose} · target ${target}${rest}${band}`;
}

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
    const prescribed=prescriptionText(l.prescription);
    if(prescribed)r+=` | PRESCRIBED ${prescribed}`;
    lines.push(`${l.exerciseName}: ${r}`);
  });
  if(s.sessionNote)lines.push("",`SESSION NOTE: ${s.sessionNote}`);
  return lines.join("\n");
}

export function makeCoachHandoff(s:SessionSummary){
  const all=getLogs();
  const lines:string[]=[
    `CALISTHENICS COACH — ${s.day}`,
    `Duration: ${Math.round(s.durationSec/60)} min`,
    `Total reps: ${s.totalReps} · EMOM reps: ${s.emomReps} · Best static: ${s.bestSkillSeconds.toFixed(1)}s`,
  ];
  const r=s.readiness||{};
  const readiness=[
    r.energy!==undefined?`energy ${r.energy}/5`:null,
    r.sleepHours!==undefined?`sleep ${r.sleepHours}h`:null,
    r.wristPain!==undefined?`wrist pain ${r.wristPain}/5`:null,
    r.elbowPain!==undefined?`elbow pain ${r.elbowPain}/5`:null,
    r.weightKg!==undefined?`weight ${r.weightKg}kg`:null,
  ].filter(Boolean) as string[];
  if(readiness.length) lines.push(`Readiness: ${readiness.join(' · ')}`);
  lines.push('', 'PERFORMANCE');
  s.logs.forEach(l=>{
    if(l.status==='skipped'){
      lines.push(`${l.exerciseName}: SKIPPED`);
      return;
    }
    const currentLogIds=new Set(s.logs.map(x=>x.id));
    const prior=all
      .filter(x=>x.exerciseId===l.exerciseId&&x.day===l.day&&!currentLogIds.has(x.id)&&!x.skipped&&x.status==="complete"&&x.date<l.date&&(!l.variantId||String(x.variantId||x.exerciseId)===String(l.variantId)))
      .sort((a,b)=>b.date-a.date)[0];
    const suffix:string[]=[];
    const prescribed=prescriptionText(l.prescription);
    if(prescribed) suffix.push(`prescribed ${prescribed}`);
    if(l.kind==='EMOM'&&l.result.emom?.length){
      const cur=sum(l.result.emom),prev=prior?.result.emom?.length?sum(prior.result.emom):undefined;
      suffix.push(`EMOM ${l.result.emom.join('/')}`,`total ${cur}`);
      if(prev!==undefined)suffix.push(`prev ${prev}`,`${cur-prev>=0?'+':''}${cur-prev}`);
    }else if(l.result.seconds?.length){
      const cur=Math.max(...l.result.seconds),prev=prior?.result.seconds?.length?Math.max(...prior.result.seconds):undefined;
      suffix.push(`holds ${l.result.seconds.map(x=>x.toFixed(1)).join('/') }s`,`best ${cur.toFixed(1)}s`);
      if(prev!==undefined)suffix.push(`prev ${prev.toFixed(1)}s`,`${cur-prev>=0?'+':''}${(cur-prev).toFixed(1)}s`);
    }else if(l.result.reps?.length){
      const cur=sum(l.result.reps),prev=prior?.result.reps?.length?sum(prior.result.reps):undefined;
      suffix.push(`sets ${l.result.reps.join('/')}`,`total ${cur}`);
      if(prev!==undefined)suffix.push(`prev ${prev}`,`${cur-prev>=0?'+':''}${cur-prev}`);
    }
    if(l.result.band&&l.result.band!=='None')suffix.push(`band ${l.result.band}`);
    if(l.result.rir!==undefined)suffix.push(`RIR ${l.result.rir}`);
    if(l.result.fatigue!==undefined)suffix.push(`fatigue ${l.result.fatigue}/5`);
    if(l.status==='modified')suffix.push(`modified: ${l.modification||'unspecified'}`);
    if(l.status==='incomplete')suffix.push('incomplete');
    lines.push(`${l.variantName||l.exerciseName}: ${suffix.join(' · ')||'completed'}`);
    if(l.result.note && !l.result.note.startsWith('Coach range')) lines.push(`  note: ${l.result.note}`);
  });
  if(s.sessionNote?.trim())lines.push('',`SESSION NOTE: ${s.sessionNote.trim()}`);
  lines.push('', 'COACH REQUEST', 'Review performance vs previous exposure and decide whether the next session should stay the same, progress, regress, or reduce volume.');
  return lines.join('\n');
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
    schemaVersion:10,
    exportedAt:Date.now(),
    logs:getLogs(),
    sessions:getSessions(),
    targets:JSON.parse(localStorage.getItem(TARGET_KEY)||"{}"),
    settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}"),
    variants:getVariants(),
    programOverrides:getProgramOverrides(),
    coachDecisions:getCoachDecisions(),
    coachProposals:getCoachProposals(),
    mobilitySessions:getMobilitySessions()
  },null,2);
}

export function normalizeBackupData(data:unknown){
  if(!data||typeof data!=="object")throw new Error("Invalid backup");
  const x=data as Record<string,unknown>;
  const schema=Number(x.schemaVersion);
  if(![8,9,10].includes(schema))throw new Error("Unsupported backup version");
  if(!Array.isArray(x.logs)||!Array.isArray(x.sessions))throw new Error("Invalid backup");
  const sessions=(x.sessions as SessionSummary[]).map(s=>({...s,logs:(s.logs||[]).map(l=>normalizeLog(l as Omit<WorkoutLog,"sessionId"> & Partial<Pick<WorkoutLog,"sessionId">>))}));
  const sessionIds=new Set(sessions.map(s=>s.id));
  const logs=(x.logs as Array<Omit<WorkoutLog,"sessionId"> & Partial<Pick<WorkoutLog,"sessionId">>>).map(l=>normalizeLog(l));
  logs.forEach(l=>{if(!sessionIds.has(l.sessionId))l.sessionId=`legacy:${l.id}`;});
  return {
    ...x, schemaVersion:10, logs, sessions,
    targets:(x.targets&&typeof x.targets==="object"?x.targets:{}),
    settings:(x.settings&&typeof x.settings==="object"?x.settings:{}),
    variants:x.variants||{}, programOverrides:x.programOverrides||{},
    coachDecisions:x.coachDecisions||[], coachProposals:x.coachProposals||[],
    mobilitySessions:Array.isArray(x.mobilitySessions)?x.mobilitySessions:[],
  };
}

export function importBackup(text:string){
  const data=normalizeBackupData(JSON.parse(text));
  localStorage.setItem(LOG_KEY,JSON.stringify(data.logs));
  localStorage.setItem(SESSION_KEY,JSON.stringify(data.sessions));
  localStorage.setItem(TARGET_KEY,JSON.stringify(data.targets||{}));
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(data.settings||{}));
  localStorage.setItem(VARIANT_KEY,JSON.stringify(data.variants||{}));
  localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(data.programOverrides||{}));
  localStorage.setItem(COACH_DECISION_KEY,JSON.stringify(data.coachDecisions||[]));
  localStorage.setItem(COACH_PROPOSAL_KEY,JSON.stringify(data.coachProposals||[]));
  localStorage.setItem(MOBILITY_KEY,JSON.stringify(data.mobilitySessions||[]));
}

export function currentWeekBucket(date=Date.now()){
  const d=new Date(date); const day=(d.getDay()+6)%7;
  const monday=new Date(d); monday.setHours(0,0,0,0); monday.setDate(d.getDate()-day);
  return monday.getTime();
}

export function getVariants():Record<string,CurrentVariantState>{
  try{
    const raw=JSON.parse(localStorage.getItem(VARIANT_KEY)||"{}");
    if(!raw||typeof raw!=="object")return{};
    const next:Record<string,CurrentVariantState>={};
    for(const [key,value] of Object.entries(raw as Record<string,Partial<CurrentVariantState>>)){
      next[key]={
        exerciseId:value.exerciseId||key,
        variantId:value.variantId||key,
        variantName:value.variantName||key,
        step:typeof value.step==="number"?value.step:0,
        status:value.status||"active",
        updatedAt:typeof value.updatedAt==="number"?value.updatedAt:Date.now(),
        lastCoachAction:value.lastCoachAction||"none",
      };
    }
    return next;
  }catch{return{}}
}
export function getVariant(id:string):CurrentVariantState|undefined{return getVariants()[id]}
export function setVariant(id:string,value:CurrentVariantState){
  const x=getVariants();x[id]=value;localStorage.setItem(VARIANT_KEY,JSON.stringify(x));
}
export function clearVariant(id:string){
  const x=getVariants();delete x[id];localStorage.setItem(VARIANT_KEY,JSON.stringify(x));
}

const COACH_PROPOSAL_KEY="cc-v15-coach-proposals";
export function getCoachProposals():CoachProposal[]{try{return JSON.parse(localStorage.getItem(COACH_PROPOSAL_KEY)||"[]")}catch{return[]}}
export function saveCoachProposal(p:Omit<CoachProposal,"id"|"date">){const next:CoachProposal={...p,id:crypto.randomUUID(),date:Date.now()};localStorage.setItem(COACH_PROPOSAL_KEY,JSON.stringify([...getCoachProposals(),next].slice(-100)));return next}
export function updateCoachProposal(id:string,status:CoachProposal["status"]){const next=getCoachProposals().map(p=>p.id===id?{...p,status}:p);localStorage.setItem(COACH_PROPOSAL_KEY,JSON.stringify(next));return next.find(p=>p.id===id)}
export function acceptCoachProposalAtomically(
  proposalId:string,
  override:ProgramOverride,
  variantState:CurrentVariantState|undefined,
  decision:Omit<CoachDecision,"id"|"date">
){
  const proposal=getCoachProposals().find(p=>p.id===proposalId);
  if(!proposal) throw new Error("Coach proposal not found");
  if(proposal.status!=="pending") return {proposal,changed:false};
  const proposalSnapshot=getCoachProposals();
  const overrideSnapshot=getProgramOverrides();
  const variantSnapshot=getVariants();
  const decisionSnapshot=getCoachDecisions();
  try{
    const nextOverrides={...overrideSnapshot,[override.exerciseId]:override};
    const nextVariants={...variantSnapshot};
    if(variantState) nextVariants[variantState.exerciseId]=variantState;
    const nextProposals=proposalSnapshot.map(p=>p.id===proposalId?{...p,status:"accepted" as const}:p);
    const nextDecisions=[...decisionSnapshot,{...decision,id:crypto.randomUUID(),date:Date.now()}].slice(-200);
    localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(nextOverrides));
    localStorage.setItem(VARIANT_KEY,JSON.stringify(nextVariants));
    localStorage.setItem(COACH_PROPOSAL_KEY,JSON.stringify(nextProposals));
    localStorage.setItem(COACH_DECISION_KEY,JSON.stringify(nextDecisions));
    return {proposal:nextProposals.find(p=>p.id===proposalId)!,changed:true};
  }catch(error){
    localStorage.setItem(PROGRAM_OVERRIDE_KEY,JSON.stringify(overrideSnapshot));
    localStorage.setItem(VARIANT_KEY,JSON.stringify(variantSnapshot));
    localStorage.setItem(COACH_PROPOSAL_KEY,JSON.stringify(proposalSnapshot));
    localStorage.setItem(COACH_DECISION_KEY,JSON.stringify(decisionSnapshot));
    throw error;
  }
}

export function getCoachDecisions():CoachDecision[]{try{return JSON.parse(localStorage.getItem(COACH_DECISION_KEY)||"[]")}catch{return[]}}
export function saveCoachDecision(d:Omit<CoachDecision,"id"|"date">){const next:{id:string;date:number;type:CoachDecision["type"];exerciseId?:string;title:string;detail:string;from?:string;to?:string}={...d,id:crypto.randomUUID(),date:Date.now()};localStorage.setItem(COACH_DECISION_KEY,JSON.stringify([...getCoachDecisions(),next].slice(-100)))}
export function clearCoachDecisions(){localStorage.removeItem(COACH_DECISION_KEY)}

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
export function saveDraft(d:import("./types").WorkoutDraft){localStorage.setItem(DRAFT_KEY,JSON.stringify({...d,updatedAt:Date.now()}))}
export function clearDraft(){localStorage.removeItem(DRAFT_KEY)}
