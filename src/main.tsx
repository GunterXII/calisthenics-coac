
import {useEffect,useRef,useState,type FormEvent} from "react";
import {createRoot} from "react-dom/client";
import {ArrowLeft,Download,Minus,Play,Plus,Upload,LogOut,RefreshCw,ChevronUp,ChevronDown,Trash2,PlusCircle,History,MessageSquare,RotateCcw,Volume2,VolumeX} from "lucide-react";
import {BAND_OPTIONS,PROGRAM,PROGRESSIONS,PROGRESSION_LADDERS} from "./program";
import {EXERCISE_CATALOG,type ExerciseCatalogItem} from "./exercises";
import {POST_WORKOUT_MOBILITY,type MobilityExercise} from "./mobility";
import type {Band,BlockKind,BlockStatus,DayKey,DayProgram,ExerciseBlock,SessionSummary,WorkoutLog,MobilitySession,MobilityLog,Readiness} from "./types";
import {supabaseConfigured, supabase} from "./lib/supabase";
import {getSession, signInWithPassword, signUpWithPassword, resetPassword, signOut, syncLocalSessions, uploadWorkoutSession, syncProgramLayer, uploadMobilitySession, syncMobilitySessions, fetchExerciseCatalog, fetchMyProfile, fetchCoachAthletes, fetchCoachAthleteProgram, fetchCoachAthleteSessions, fetchCoachAthleteAudit, fetchCoachNotes, createCoachNote, coachRecordDecision, fetchAthleteCoachingProfile, saveAthleteCoachingProfile, fetchMyCoachingProfile, saveMyCoachingProfile, fetchProgramLayer, coachAddProgramBlock, coachDeleteProgramBlock, coachReorderProgramDay, coachPromoteSkillRung, getMyCoachCode, saveCoachProgramBlock, resetCoachProgramBlock, linkMyAthleteAccountToCoach, fetchMyCoach, unlinkMyCoach, type UserProfile, type CoachAthlete, type AthleteCoachingProfile} from "./lib/backend";
import {buildSkillGraphViews, type SkillGraphView} from "./skillGraph";
import {appendLogs,emomStats,exportBackup,formatClock,getDraft,getLogs,getSessions,getSetting,getTarget,getVariant,importBackup,latestLog,latestSession,makeSessionReport,makeWeeklyReport,replaceSession,saveMobilitySession,saveDraft,clearDraft,saveSession,setSetting,setTarget,setVariant,getProgramOverrides,getProgramOverride,setProgramOverride,restoreProgramOverride,clearProgramOverride,clearAllProgramOverrides,getCoachDecisions,saveCoachDecision,makeCoachHandoff,getEmomDuration,setEmomDuration,getCoachProposals,saveCoachProposal,updateCoachProposal,type CoachProposal} from "./storage";
import {analyzeSkillIntelligence,type SkillInsight} from "./skillIntelligence";
import "./styles.css";

const DAYS:DayKey[]=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LABEL:Record<BlockKind,string>={HANDSTAND:"HANDSTAND",SKILL_STATIC:"SKILL",SKILL_REPS:"SKILL",VOLUME_SKILL:"SKILL VOLUME",PERFORMANCE:"PERFORMANCE",EMOM:"EMOM",ACCESSORY:"ACCESSORY",CORE:"CORE"};

function useNow(active:boolean){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!active)return;const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id)},[active]);
  return now;
}
function useWakeLock(active:boolean){
  useEffect(()=>{
    let lock:any=null;
    const get=async()=>{try{if(active&&"wakeLock" in navigator)lock=await (navigator as any).wakeLock.request("screen")}catch{}};
    get();
    const vis=()=>{if(active&&document.visibilityState==="visible")get()};
    document.addEventListener("visibilitychange",vis);
    return()=>{document.removeEventListener("visibilitychange",vis);try{lock?.release()}catch{}};
  },[active]);
}
let audioContext: AudioContext | null = null;
function initAudio(){
  try{
    if(!audioContext) audioContext = new AudioContext();
    if(audioContext.state === "suspended") void audioContext.resume();
  }catch{}
}
function playTone(kind:"countdown"|"start"|"complete"|"rest"="countdown"){
  try{
    initAudio();
    if(!audioContext) return;
    const now=audioContext.currentTime;
    const osc=audioContext.createOscillator();
    const gain=audioContext.createGain();
    const cfg={
      countdown:{frequency:760,duration:0.085,volume:0.065},
      start:{frequency:980,duration:0.14,volume:0.085},
      complete:{frequency:1180,duration:0.28,volume:0.10},
      rest:{frequency:520,duration:0.13,volume:0.055},
    }[kind];
    osc.type="sine"; osc.frequency.value=cfg.frequency;
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(cfg.volume,now+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+cfg.duration);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(now); osc.stop(now+cfg.duration+0.02);
  }catch{}
}
function feedback(kind:"countdown"|"start"|"complete"|"rest",sound:boolean,vibration:boolean){
  if(sound) playTone(kind);
  if(vibration){try{navigator.vibrate?.(kind==="complete"?[70,45,100]:75)}catch{}}
}
function beep(){try{navigator.vibrate?.(75)}catch{}}


function ResumeWorkoutModal({draft,onResume,onDiscard,blockCount}:{draft:any;onResume:()=>void;onDiscard:()=>void;blockCount:number}){
 const p=effectiveProgram(draft.day as DayKey);
 return <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
   <div className="mx-auto w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
     <div className="eyebrow">WORKOUT IN PROGRESS</div>
     <h2 className="mt-2 text-2xl font-extrabold">{p.title}</h2>
     <p className="mt-2 text-xs text-muted">You have an unfinished session from {new Date(draft.startedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}.</p>
     <div className="mt-4 rounded-xl border border-line bg-panel2 p-3 text-[10px] text-zinc-400">
       Progress: {Math.max(0,draft.index+1)} / {blockCount}
     </div>
     <div className="mt-5 grid grid-cols-2 gap-2">
       <button className="secondary-cta" onClick={onDiscard}>DISCARD</button>
       <button className="primary-cta" onClick={onResume}>RESUME</button>
     </div>
   </div>
 </div>
}

function cloneEffectiveBlock(day:DayKey,base:ExerciseBlock):ExerciseBlock{
 const o=getProgramOverride(base.id);
 return o?{...base,...o,kind:(o.kind as BlockKind)||base.kind,bandOptions:o.bandOptions as Band[]||base.bandOptions,defaultBand:(o.defaultBand as Band)||base.defaultBand}:base;
}
function effectiveProgram(day:DayKey){
 const p=PROGRAM[day];
 return {...p,blocks:p.blocks.map(b=>cloneEffectiveBlock(day,b))};
}
function toUiKind(item:ExerciseCatalogItem):BlockKind{
 if(item.category==="CORE") return "CORE";
 if(item.category==="ACCESSORY") return "ACCESSORY";
 if(item.category==="PREHAB") return item.kind==="HOLD" ? "SKILL_STATIC" : "ACCESSORY";
 if(item.category==="SKILL") return item.kind==="HOLD" ? "SKILL_STATIC" : "SKILL_REPS";
 return "PERFORMANCE";
}
function exerciseCatalog(remote:ExerciseCatalogItem[]){
 const seen=new Set<string>(); const out:{id:string;name:string;detail?:string;kind:BlockKind;bandOptions?:Band[];category?:string;skill?:string;pattern?:string;difficulty?:number;sideMode?:string;defaultTarget?:string;restSec?:number}[]=[];
 const add=(item:ExerciseCatalogItem)=>{if(seen.has(item.id))return;seen.add(item.id);out.push({id:item.id,name:item.name,detail:item.detail,category:item.category,kind:toUiKind(item),bandOptions:item.equipment.includes("band")?BAND_OPTIONS:undefined,skill:item.skill,pattern:item.pattern,difficulty:item.difficulty,sideMode:item.sideMode,defaultTarget:item.defaultTarget,restSec:item.restSec ?? undefined})};
 remote.forEach(add);
 DAYS.forEach(d=>PROGRAM[d].blocks.forEach(b=>{const item=remote.find(x=>x.id===b.id)||remote.find(x=>x.name===b.name);if(item)add(item);else if(!seen.has(b.id)){seen.add(b.id);out.push({id:b.id,name:b.name,detail:b.detail,kind:b.kind,bandOptions:b.bandOptions})}}));
 return out;
}
function Plan({day,setDay,refresh,remoteCatalog}:{day:DayKey;setDay:(x:DayKey)=>void;refresh:number;remoteCatalog:ExerciseCatalogItem[]}){
 const p=effectiveProgram(day),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState(""),[undo,setUndo]=useState<(()=>void)|null>(null);
 const overrides=getProgramOverrides(),catalog=exerciseCatalog(remoteCatalog);
 const [coachLinked,setCoachLinked]=useState(false);
 useEffect(()=>{fetchMyCoach().then(c=>setCoachLinked(Boolean(c))).catch(()=>setCoachLinked(false))},[refresh]);
 const showNotice=(msg:string,undoFn?:()=>void)=>{setEditing(null);setNotice(msg);setUndo(()=>undoFn||null);setTimeout(()=>setNotice(""),3500)};
 return <div>
  <div className="eyebrow">PLAN</div><div className="flex items-end justify-between gap-4"><div><h1>Your program.</h1><p className="sub">{coachLinked?"Coach-managed plan.":"Your training plan."}</p></div>{!coachLinked&&<button className="secondary-cta" onClick={()=>{const snapshot=getProgramOverrides();clearAllProgramOverrides();syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));showNotice("PROGRAM RESET TO COACH DEFAULTS",()=>{Object.values(snapshot).forEach((o:any)=>setProgramOverride(o.exerciseId,o));syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));})}}>RESET ALL</button>}</div>
  <div className="my-7 grid grid-cols-7 gap-1">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} className={`rounded-lg border px-1 py-2 text-[9px] font-extrabold ${day===d?"border-transparent bg-violet-600 text-white":"border-line bg-panel text-zinc-600"}`}>{d.slice(0,3).toUpperCase()}</button>)}</div>
  {notice&&<div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] text-emerald-300"><span>{notice}</span>{undo&&<button className="text-[9px] font-bold tracking-[.1em] text-white underline" onClick={()=>{undo();setUndo(null);setNotice("CHANGE UNDONE")}}>UNDO</button>}</div>}
  <div className="mb-3 flex items-center justify-between"><div><div className="section-kicker">{p.title}</div><div className="mt-1 text-[10px] text-zinc-500">{p.subtitle}</div></div><span className="text-[9px] text-zinc-600">{p.blocks.length}</span></div>
  <div className="grid gap-2">{p.blocks.map((b,i)=><div key={b.id} className="rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="tag">{LABEL[b.kind]}</span><strong className="mt-1 block">{b.name}</strong><p className="mt-1 text-[10px] text-zinc-500">{b.kind==="EMOM"?`${b.minutes||10} min EMOM · ${b.target}${b.rest?` · ${b.rest}s rest`:""}`:`${b.sets?`${b.sets} sets · `:""}${b.target}${b.rest?` · ${b.rest}s rest`:""}`}</p>{overrides[b.id]&&<span className="mt-2 inline-block text-[8px] font-bold tracking-[.12em] text-violet2">CUSTOMIZED</span>}</div>{!coachLinked&&<button className="mini-btn shrink-0" aria-label={`Edit ${b.name}`} onClick={()=>{setNotice("");setEditing(b.id)}}>⋯</button>}</div>
   {editing===b.id&&<ProgramEditor block={b} catalog={catalog} onClose={()=>setEditing(null)} onSaved={(undoFn)=>showNotice("PROGRAM SAVED — NEXT SESSION UPDATED",undoFn)}/>}
  </div>)}</div>
 </div>;
}
function CoachLinkCard({onLinked}:{onLinked:()=>void}){
 const [coach,setCoach]=useState<CoachAthlete|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 useEffect(()=>{fetchMyCoach().then(setCoach).catch(()=>setCoach(null))},[]);
 const link=async()=>{if(!code.trim())return;setBusy(true);setMsg('');try{await linkMyAthleteAccountToCoach(code);const next=await fetchMyCoach();if(!next)throw new Error('COACH LINK CREATED BUT COACH COULD NOT BE LOADED');setCoach(next);setMsg('COACH LINKED — FUTURE PROGRAM CHANGES WILL SYNC HERE.');onLinked();}catch(e:any){setMsg(e?.message||'COACH LINK FAILED')}finally{setBusy(false)}};
 const unlink=async()=>{if(!coach)return;setBusy(true);setMsg('');try{await unlinkMyCoach(coach.id);setCoach(null);clearAllProgramOverrides();setMsg('COACH DISCONNECTED. YOUR LOCAL PROGRAM IS NOW ATHLETE-CONTROLLED.');}catch(e:any){setMsg(e?.message||'COACH DISCONNECT FAILED')}finally{setBusy(false)}};
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="section-kicker">COACH CONNECTION</div>{coach?<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-extrabold">{coach.display_name||'Your coach'}</div><div className="mt-1 text-[9px] text-zinc-600">LINKED {new Date(coach.linked_at).toLocaleDateString()}</div></div><button className="secondary-cta" disabled={busy} onClick={unlink}>{busy?'WORKING…':'DISCONNECT COACH'}</button></div>:<><p className="mt-2 text-[10px] leading-5 text-zinc-500">Have your coach send you their 10-character code. Linking does not change your workout history.</p><div className="mt-3 flex gap-2"><input className="flex-1 rounded-xl border border-line bg-panel2 p-3 font-mono text-sm uppercase tracking-[.18em]" maxLength={10} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="COACH CODE"/><button className="primary-cta" disabled={busy||code.length!==10} onClick={link}>{busy?'LINKING…':'LINK'}</button></div></>}{msg&&<div className={`mt-2 text-[9px] ${msg.includes('FAILED')?'text-rose-300':'text-emerald-300'}`}>{msg}</div>}</div>;
}

function ProgramEditor({block,catalog,onClose,onSaved}:{block:ExerciseBlock;catalog:{id:string;name:string;detail?:string;kind:BlockKind;bandOptions?:Band[];category?:string;skill?:string;pattern?:string;difficulty?:number;sideMode?:string;defaultTarget?:string;restSec?:number}[];onClose:()=>void;onSaved:(undo?:()=>void)=>void}){
 const currentOverride=getProgramOverride(block.id);
 const currentCatalogId=(currentOverride as any)?.catalogExerciseId || catalog.find(x=>x.name===block.name)?.id || block.id;
 const currentCatalog=catalog.find(x=>x.id===currentCatalogId)||catalog.find(x=>x.name===block.name);
 const compatible=catalog.filter(x=>{
   if(!currentCatalog)return true;
   if(x.id===currentCatalog.id)return true;
   const sameSkill=x.skill===currentCatalog.skill;
   const samePattern=x.pattern===currentCatalog.pattern;
   const sameKind=x.kind===currentCatalog.kind;
   // Keep coach substitutions in the same performance mode. A static handstand is
   // not a valid rep progression for a pike/HSPU movement, for example.
   return (sameSkill||samePattern) && sameKind;
 }).sort((a,b)=>Number(a.difficulty||0)-Number(b.difficulty||0)||a.name.localeCompare(b.name));
 const [catalogId,setCatalogId]=useState(currentCatalog?.id||block.id),[name,setName]=useState(block.name),[kind,setKind]=useState<BlockKind>(block.kind),[sets,setSets]=useState(String(block.sets||1)),[target,setTargetLocal]=useState(block.target||currentCatalog?.defaultTarget||""),[rest,setRestLocal]=useState(String(block.rest||currentCatalog?.restSec||0)),[minutes,setMinutesLocal]=useState(String(block.minutes||10)),[band,setBand]=useState((block.defaultBand||currentCatalog?.bandOptions?.find(x=>x!=="None")||"")),[detail,setDetail]=useState(block.detail||currentCatalog?.detail||"");
 const choose=(id:string)=>{const c=catalog.find(x=>x.id===id);if(!c)return;setCatalogId(c.id);setName(c.name);setKind(c.kind);setDetail(c.detail||"");setTargetLocal(c.defaultTarget||"");setRestLocal(String(c.restSec||90));setMinutesLocal(c.kind==="EMOM"?String(block.minutes||10):"10");setBand(c.bandOptions?.find(x=>x!=="None")||"")};
 const save=()=>{const s=Math.max(1,Number(sets)||1),r=Math.max(0,Number(rest)||0),m=kind==="EMOM"?Math.max(5,Math.min(15,Number(minutes)||10)):undefined;const selectedCatalog=catalog.find(x=>x.id===catalogId);const bands=(selectedCatalog?.bandOptions||block.bandOptions||[]).filter(x=>x!=="None") as Band[];const nextName=name.trim()||block.name;const previous=setProgramOverride(block.id,{exerciseId:block.id,catalogExerciseId:catalogId,name:nextName,detail:detail.trim()||undefined,kind,target:target.trim()||block.target,sets:s,rest:r,minutes:m,bandOptions:bands.length?bands:undefined,defaultBand:(band as Band)||undefined,updatedAt:Date.now()});if(m!==undefined)setEmomDuration(block.id,m);saveCoachDecision({type:"program",exerciseId:block.id,title:`Program changed — ${nextName}`,detail:`${kind==="EMOM"?`${m} min EMOM · `:""}Target ${target.trim()||block.target} · ${s} sets · ${r}s rest`,from:block.name,to:nextName});syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));onSaved(()=>restoreProgramOverride(block.id,previous));};
 const reset=()=>{const previous=getProgramOverride(block.id)||null;clearProgramOverride(block.id);if(block.kind==="EMOM")setEmomDuration(block.id,block.minutes||10);saveCoachDecision({type:"program",exerciseId:block.id,title:`Program reset — ${block.name}`,detail:"Returned to coach default prescription",from:block.name,to:block.name});syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));onSaved(()=>{if(previous)setProgramOverride(block.id,previous);else clearProgramOverride(block.id);if(block.kind==="EMOM")setEmomDuration(block.id,block.minutes||10);syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));});};
 return <div className="mt-4 rounded-xl border border-violet-500/15 bg-panel2 p-4">
  <div className="flex items-center justify-between"><div className="field-label">EDIT PRESCRIPTION</div><button className="text-[9px] font-bold text-zinc-600" onClick={onClose}>CLOSE</button></div>
  <label className="mt-3 block"><span className="field-label">EXERCISE / VARIANT</span><select value={catalogId} onChange={e=>choose(e.target.value)}>{compatible.map(x=><option key={x.id} value={x.id}>{x.name}{x.difficulty?` · D${x.difficulty}`:""}</option>)}</select><span className="mt-1 block text-[8px] text-zinc-600">Showing compatible movements by skill or movement pattern.</span></label>
  {kind==="EMOM" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3"><span className="field-label">EMOM DURATION</span><div className="mt-2 flex items-center gap-2"><button className="mini-btn" disabled={Number(minutes)<=5} onClick={()=>setMinutesLocal(String(Math.max(5,(Number(minutes)||10)-1)))}><Minus size={14}/></button><input className="w-full rounded-xl border border-line bg-panel2 p-3 text-center font-extrabold outline-none" inputMode="numeric" value={minutes} onChange={e=>setMinutesLocal(e.target.value.replace(/\D/g,""))}/><button className="mini-btn" disabled={Number(minutes)>=15} onClick={()=>setMinutesLocal(String(Math.min(15,(Number(minutes)||10)+1)))}><Plus size={14}/></button></div><div className="mt-1 text-[8px] text-zinc-600">5–15 minutes · changes future sessions only</div></div><Field label="TARGET / MIN" value={target} set={setTargetLocal} placeholder="8–10"/></div> : <div className="mt-3 grid gap-2 sm:grid-cols-3"><Field label="SETS" value={sets} set={setSets} placeholder="3"/><Field label="TARGET" value={target} set={setTargetLocal} placeholder="8–10"/><Field label="REST (S)" value={rest} set={setRestLocal} placeholder="90"/></div>}
  {kind==="EMOM"&&<div className="mt-2 text-[8px] text-zinc-600">Recovery is automatic inside each minute; the listed rest value is not used by the EMOM timer.</div>}
  {(currentCatalog?.bandOptions||block.bandOptions||[]).length>0&&<div className="mt-3"><BandSelect label="DEFAULT LOOP" value={band} set={setBand} options={(currentCatalog?.bandOptions||block.bandOptions||[]) as string[]}/></div>}
  <label className="mt-3 block"><span className="field-label">COACH NOTE</span><input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Optional cue"/></label>
  <div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={reset}>RESET THIS</button><button className="primary-cta" onClick={save}>SAVE CHANGES</button></div>
  <div className="mt-2 text-[8px] leading-4 text-zinc-600">Only future sessions change. Historical logs remain untouched.</div>
 </div>;
}

function remoteToExerciseBlock(r:any, day:DayKey, index:number):ExerciseBlock {
 const payload=typeof r.override_payload === "object" && r.override_payload ? r.override_payload : {};
 return {
   id:String(r.exercise_id), catalogExerciseId:String(payload.catalogExerciseId ?? r.catalog_exercise_id ?? String(r.exercise_id).split("__")[0]), kind:(payload.kind ?? r.kind ?? "PERFORMANCE") as BlockKind,
   name:String(payload.name ?? r.name ?? r.exercise_id), detail:String(payload.detail ?? r.detail ?? ""),
   target:String(payload.target ?? r.target ?? ""), sets:payload.sets ?? r.sets ?? undefined,
   rest:Number(payload.rest ?? r.rest_sec ?? 0), minutes:payload.minutes ?? r.minutes ?? undefined,
   bandOptions:(payload.bandOptions ?? r.band_options ?? undefined) as Band[]|undefined, defaultBand:(payload.defaultBand ?? (r.band_options?.find((b:string)=>b!=="None"))) as Band|undefined, previousMode:r.kind==="EMOM"?"emom":undefined,
   day, sortOrder:index,
 } as ExerciseBlock;
}
function coachEffectiveProgram(day:DayKey, remoteBlocks:any[]):DayProgram{
 const base=PROGRAM[day];
 const dayRemote=(remoteBlocks||[]).filter(r=>String(r.day)===day).sort((a,b)=>Number(a.sort_order??99)-Number(b.sort_order??99));
 const remoteById=new Map<string,any>(dayRemote.map(r=>[String(r.exercise_id),r]));
 const blocks:ExerciseBlock[]=base.blocks.map((baseBlock:ExerciseBlock,i:number)=>{
   const r=remoteById.get(baseBlock.id);
   if(!r)return {...baseBlock,catalogExerciseId:baseBlock.catalogExerciseId||baseBlock.id,sortOrder:i};
   remoteById.delete(baseBlock.id);
   return remoteToExerciseBlock(r,day,i);
 });
 for(const r of remoteById.values()) blocks.push(remoteToExerciseBlock(r,day,blocks.length));
 return {...base,blocks};
}
function coachResultSummary(log:any){
 const r=log?.result||{};
 if(Array.isArray(r.seconds)&&r.seconds.length)return `${Math.max(...r.seconds).toFixed(1)}s`;
 if(Array.isArray(r.reps)&&r.reps.length)return `${r.reps.join(" / ")} reps`;
 if(Array.isArray(r.emom)&&r.emom.length)return `${r.emom.reduce((a:number,b:number)=>a+b,0)} EMOM reps`;
 return "—";
}
function coachProgressionInsights(sessions:any[], program:any, catalog:ExerciseCatalogItem[]){
 const blocks=(program?.blocks||[]) as ExerciseBlock[];
 return analyzeSkillIntelligence(sessions,blocks,catalog.length?catalog:EXERCISE_CATALOG);
}

function coachDecisionEngine(sessions:any[], program:any){
 const ordered=(sessions||[]).slice(0,8);
 const decisions:{level:"GREEN"|"YELLOW"|"RED";title:string;detail:string;action:string}[]=[];
 const readiness=ordered.map(s=>s?.readiness||{}).filter(r=>Object.keys(r).length);
 const latest=readiness[0]||{};
 const energy=Number(latest.energy);
 const sleep=Number(latest.sleepHours);
 const pain=Math.max(Number(latest.elbowPain||0),Number(latest.wristPain||0));
 if(Number.isFinite(pain)&&pain>=4) decisions.push({level:"RED",title:"PAIN LOAD",detail:`Latest reported joint pain is ${pain}/5. Avoid adding intensity until the pattern is reviewed.`,action:"REVIEW / DELOAD"});
 else if(Number.isFinite(pain)&&pain>=3) decisions.push({level:"YELLOW",title:"JOINT LOAD",detail:`Latest reported joint pain is ${pain}/5. Keep the current prescription and monitor the next session.`,action:"HOLD LOAD"});
 if(Number.isFinite(energy)&&energy<=2) decisions.push({level:"YELLOW",title:"LOW READINESS",detail:`Energy is ${energy}/5. A hard progression today is not justified by readiness alone.`,action:"KEEP CURRENT"});
 if(Number.isFinite(sleep)&&sleep<6) decisions.push({level:"YELLOW",title:"SLEEP DEBT",detail:`Latest sleep is ${sleep}h. Avoid interpreting a weak session as a loss of skill.`,action:"KEEP / MONITOR"});
 const totals=ordered.map(s=>Number(s?.total_reps||0)).filter(Number.isFinite);
 if(totals.length>=3){
   const recent=totals.slice(0,3), older=totals.slice(3,6);
   const r=recent.reduce((a,b)=>a+b,0)/recent.length;
   const o=older.length?older.reduce((a,b)=>a+b,0)/older.length:0;
   if(o>0&&r<o*.8) decisions.push({level:"YELLOW",title:"VOLUME DROP",detail:`Recent average volume is ${Math.round(r)} reps versus ${Math.round(o)} previously.`,action:"REVIEW FATIGUE"});
   else if(o>0&&r>o*1.15) decisions.push({level:"GREEN",title:"VOLUME TREND",detail:`Recent average volume is ${Math.round(r)} reps versus ${Math.round(o)} previously.`,action:"PROGRESSION CANDIDATE"});
 }
 const recentDays=new Set(ordered.slice(0,7).map(s=>String(s?.day||""))).size;
 if(ordered.length>=5) decisions.push({level:"GREEN",title:"ADHERENCE",detail:`${ordered.length} recent completed sessions are available for review across ${recentDays} training days.`,action:"DATA SUFFICIENT"});
 const blocks=program?.blocks||[];
 if(!decisions.length) decisions.push({level:"GREEN",title:"STABLE",detail:`No major negative signal is detected in the latest available athlete data.`,action:"KEEP PLAN"});
 return decisions.slice(0,5);
}

function coachTimelineRows(sessions:any[], program:any){
 const logs=(sessions||[]).flatMap((s:any)=>Array.isArray(s.exercise_logs)?s.exercise_logs.map((l:any)=>({...l,__session:s})):[]);
 const by=new Map<string,any[]>();
 for(const l of logs){if(l?.status==="skipped")continue;const id=String(l.exercise_id||"");if(!id)continue;if(!by.has(id))by.set(id,[]);by.get(id)!.push(l)}
 const names=new Map<string,string>((program?.blocks||[]).map((b:any)=>[String(b.exercise_id),String(b.name)]));
 for(const l of logs)if(!names.has(String(l.exercise_id)))names.set(String(l.exercise_id),String(l.exercise_name||l.exercise_id));
 const out:any[]=[];
 for(const [id,arr] of by){const ordered=arr.slice().sort((a:any,b:any)=>new Date(b.logged_at||b.__session?.completed_at||0).getTime()-new Date(a.logged_at||a.__session?.completed_at||0).getTime()).slice(0,6);
  const metric=(l:any)=>{const r=l?.result||{};if(Array.isArray(r.seconds)&&r.seconds.length)return [Math.max(...r.seconds),"s"];if(Array.isArray(r.reps)&&r.reps.length)return [r.reps.reduce((a:number,b:number)=>a+Number(b||0),0),"reps"];if(Array.isArray(r.emom)&&r.emom.length)return [r.emom.reduce((a:number,b:number)=>a+Number(b||0),0),"EMOM"];return [0,""]};
  const vals=ordered.map(metric).filter((x:any)=>x[0]>0);if(!vals.length)continue;const latest=vals[0][0],best=Math.max(...vals.map((x:any)=>x[0])),prev=vals[1]?.[0];const delta=prev?((latest-prev)/prev)*100:0;let signal=vals.length<3?"DATA BUILDING":delta>=8?"PROGRESSING":delta<=-12?"REGRESSING":"STABLE";out.push({id,name:names.get(id)||id,latest,best,unit:vals[0][1],delta,signal,exposures:vals.length});}
 return out.sort((a,b)=>b.exposures-a.exposures).slice(0,12);
}
function CoachTimeline({sessions,program}:{sessions:any[];program:any}){const rows=coachTimelineRows(sessions,program);return <div className="mt-5 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">ATHLETE TIMELINE</div><div className="mt-1 text-[9px] text-zinc-500">Last exposures, best result and short-term direction.</div></div><span className="tag">LAST 6</span></div>{!rows.length?<div className="mt-3 text-xs text-zinc-600">Not enough exercise data yet.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">{rows.map((r:any)=><div key={r.id} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] text-zinc-600">{r.exposures} EXPOSURES</div><div className="mt-1 text-sm font-extrabold">{r.name}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${r.signal==="PROGRESSING"?"text-emerald-400":r.signal==="REGRESSING"?"text-amber-300":"text-violet2"}`}>{r.signal}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><div><div className="field-label">LATEST</div><div className="mt-1 text-sm font-bold">{r.latest.toFixed(r.unit==="s"?1:0)} <span className="text-[8px] text-zinc-600">{r.unit}</span></div></div><div><div className="field-label">BEST</div><div className="mt-1 text-sm font-bold">{r.best.toFixed(r.unit==="s"?1:0)} <span className="text-[8px] text-zinc-600">{r.unit}</span></div></div><div><div className="field-label">DELTA</div><div className="mt-1 text-sm font-bold">{r.exposures>1?`${r.delta>=0?"+":""}${r.delta.toFixed(0)}%`:"—"}</div></div></div></div>)}</div>}</div>}

function SkillIntelligencePanel({insights}:{insights:SkillInsight[]}){
 const color=(d:SkillInsight["decision"])=>d==="PROGRESS"?"text-emerald-400":d==="REGRESS"?"text-rose-400":d==="REVIEW"?"text-amber-300":d==="HOLD"?"text-violet2":"text-zinc-500";
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
  <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">SKILL INTELLIGENCE</div><div className="mt-1 text-[9px] text-zinc-500">Evidence-based progression engine: consecutive qualification, quality, readiness and fatigue signals.</div></div><span className="tag">COACH ENGINE</span></div>
  {!insights.length?<div className="mt-3 text-xs text-zinc-600">Not enough skill exposure data yet.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">
   {insights.slice(0,10).map(x=><div key={x.id} className="rounded-xl border border-line bg-panel p-3">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{x.skill} · {x.dataQuality} DATA</div><div className="mt-1 text-sm font-extrabold">{x.name}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${color(x.decision)}`}>{x.decision}</span></div>
    <div className="mt-3 grid grid-cols-3 gap-2"><div><div className="field-label">LATEST</div><div className="mt-1 text-xs font-bold">{x.latest}</div></div><div><div className="field-label">BEST</div><div className="mt-1 text-xs font-bold">{x.best.toFixed(x.unit==="s"?1:0)} {x.unit}</div></div><div><div className="field-label">QUALIFY</div><div className="mt-1 text-xs font-bold">{x.qualifyingStreak}/2</div></div></div>
    <div className="mt-3 rounded-lg bg-panel2 p-2 text-[9px] leading-4 text-zinc-500">{x.why}</div>
    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[8px] font-bold tracking-[.1em] text-violet2">{x.action}</span>{x.next&&<span className="text-right text-[8px] text-zinc-600">NEXT · {x.next}</span>}</div>
   </div>)}
  </div>}
 </div>;
}

function SkillGraphPanel({catalog,blocks,insights,onPromote}:{catalog:ExerciseCatalogItem[];blocks:ExerciseBlock[];insights:SkillInsight[];onPromote:(view:SkillGraphView)=>void}){
 const activeIds=blocks.map(b=>String(b.catalogExerciseId||b.id).split("__")[0]);
 const qualifyingIds=insights.filter(x=>x.decision==="PROGRESS").map(x=>x.exerciseId);
 const views=buildSkillGraphViews(catalog,activeIds,qualifyingIds);
 const tone=(s:string)=>s==="READY"?"text-emerald-400":s==="CURRENT"?"text-violet2":s==="LOCKED"?"text-amber-300":"text-zinc-600";
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
  <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">SKILL GRAPH</div><div className="mt-1 text-[9px] text-zinc-500">Mechanical roadmap + evidence gate. READY means the current rung has passed Skill Intelligence; promotion still requires Coach confirmation.</div></div><span className="tag">PATHWAYS</span></div>
  <div className="mt-3 grid gap-2 lg:grid-cols-2">{views.map(v=><div key={v.id} className="rounded-xl border border-line bg-panel p-3">
   <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-extrabold">{v.name}</div><div className="mt-1 text-[8px] text-zinc-600">{v.completion}% pathway mapped</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${tone(v.status)}`}>{v.status}</span></div>
   <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">{v.nodes.map((n,i)=><div key={n.id} className={`min-w-[92px] rounded-lg border px-2 py-2 ${i===v.currentIndex?"border-violet-500/40 bg-violet-500/10":"border-line bg-panel2"}`}><div className="text-[8px] font-bold">{i+1}. {n.name}</div><div className="mt-1 text-[7px] text-zinc-600">D{n.difficulty}</div></div>)}</div>
   <div className="mt-3 rounded-lg bg-panel2 p-2 text-[9px] leading-4 text-zinc-500">{v.note}</div>
   {v.next&&<div className="mt-2 flex items-center justify-between gap-2"><div><span className="text-[8px] font-bold tracking-[.1em] text-violet2">NEXT MECHANICAL RUNG</span><div className="text-[9px] font-bold">{v.next.name}</div></div>{v.status==="READY"&&<button className="primary-cta shrink-0 !py-2" onClick={()=>onPromote(v)}>REVIEW PROMOTION</button>}</div>}
  </div>)}</div>
 </div>;
}
function CoachDecisionCenter({athleteId,insights,decisions,onRecorded}:{athleteId:string;insights:any[];decisions:any[];onRecorded:()=>void}){
 const [resolved,setResolved]=useState<Record<string,"accepted"|"rejected">>({});
 const [reason,setReason]=useState<Record<string,string>>({});
 const [decisionError,setDecisionError]=useState("");
 const [open,setOpen]=useState<string|null>(null);
 const rows=[
   ...decisions.map((d:any)=>({id:`signal-${d.title}-${d.action}`,type:"SIGNAL",title:d.title,detail:d.detail,action:d.action,level:d.level})),
   ...insights.filter((x:any)=>x.decision==="PROGRESS"||x.decision==="REGRESS"||x.decision==="REVIEW").map((x:SkillInsight)=>({id:x.exerciseId,type:"SKILL",title:x.name,detail:`${x.why} · Confidence ${x.confidence}% · ${x.exposures} exposures`,action:x.action,level:x.level}))
 ];
 const resolve=async(r:any,status:"accepted"|"rejected")=>{
   const why=reason[r.id]?.trim()||"No reason recorded.";
   setDecisionError("");
   const title=`${r.type} ${status.toUpperCase()} — ${r.title}`;
   const detail=`${r.action}. Reason: ${why}`;
   try {
     await coachRecordDecision({athleteId,exerciseId:r.id,title,detail,from:r.level,to:status,reason:why});
     saveCoachDecision({type:"coach",exerciseId:r.id,title,detail,from:r.level,to:status});
     onRecorded();
     setResolved(v=>({...v,[r.id]:status}));
     setOpen(null);
   } catch (e:any) {
     setDecisionError(e?.message||"DECISION SAVE FAILED");
   }
 };
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
   <div className="flex items-end justify-between gap-3">
     <div><div className="section-kicker">COACH DECISION CENTER</div><div className="mt-1 text-[9px] text-zinc-500">Review the recommendation, record the human decision, and preserve the reason.</div></div>
     <span className="tag">HUMAN DECISION</span>
   </div>{decisionError&&<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[9px] text-rose-300">{decisionError}</div>}
   {!rows.length?<div className="mt-3 text-xs text-zinc-600">No decision requiring review.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">
    {rows.slice(0,8).map((r:any)=>{
      const status=resolved[r.id];
      return <div key={r.id} className="rounded-xl border border-line bg-panel p-3">
       <div className="flex items-start justify-between gap-2"><div><span className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{r.type}</span><div className="mt-1 text-[11px] font-extrabold">{r.title}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${r.level==="RED"?"text-rose-400":r.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{r.level}</span></div>
       <div className="mt-2 text-[9px] leading-4 text-zinc-500">{r.detail}</div>
       <div className="mt-2 rounded-lg bg-panel2 p-2 text-[8px] font-bold tracking-[.1em] text-violet2">RECOMMENDATION · {r.action}</div>
       {status?<div className={`mt-2 rounded-lg p-2 text-[9px] font-bold ${status==="accepted"?"bg-emerald-500/10 text-emerald-300":"bg-rose-500/10 text-rose-300"}`}>{status.toUpperCase()} · DECISION RECORDED</div>:
       open===r.id?<div className="mt-3">
        <textarea value={reason[r.id]||""} onChange={e=>setReason(v=>({...v,[r.id]:e.target.value}))} className="min-h-16 w-full rounded-lg border border-line bg-panel2 p-2 text-[9px]" placeholder="Why are you accepting or rejecting this recommendation?"/>
        <div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>resolve(r,"rejected")}>REJECT</button><button className="primary-cta" onClick={()=>resolve(r,"accepted")}>ACCEPT</button></div>
       </div>:<button className="secondary-cta mt-3 w-full" onClick={()=>setOpen(r.id)}>REVIEW DECISION</button>}
      </div>
    })}
   </div>}
 </div>
}

function CoachPerformanceDashboard({sessions,program,decisions}:{sessions:any[];program:any;decisions:any[]}){
 const rows=coachTimelineRows(sessions,program);
 const logs=(sessions||[]).slice(0,6).flatMap((s:any)=>Array.isArray(s.exercise_logs)?s.exercise_logs.map((l:any)=>({...l,__session:s})):[]).filter((l:any)=>l?.status!=="skipped");
 const readiness=(sessions||[]).map((s:any)=>s.readiness||{}).filter((r:any)=>Object.keys(r).length);
 const pain=readiness.length?Math.max(...readiness.slice(0,6).map((r:any)=>Math.max(Number(r.elbowPain||0),Number(r.wristPain||0)))):0;
 const energy=readiness.length?readiness.slice(0,6).reduce((a:number,r:any)=>a+Number(r.energy||0),0)/readiness.slice(0,6).length:0;
 const sleep=readiness.length?readiness.slice(0,6).reduce((a:number,r:any)=>a+Number(r.sleepHours||0),0)/readiness.slice(0,6).length:0;
 const totalReps=(sessions||[]).slice(0,6).reduce((a:number,s:any)=>a+Number(s.total_reps||0),0);
 const best=rows.filter(r=>r.best>0).sort((a,b)=>b.best-a.best).slice(0,6);
 const status=(r:any)=>r.signal==="PROGRESSING"?"text-emerald-400":r.signal==="REGRESSING"?"text-amber-300":"text-violet2";
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
   <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">ATHLETE PERFORMANCE DASHBOARD</div><div className="mt-1 text-[9px] text-zinc-500">Premium snapshot for coaching decisions — performance, consistency, recovery and workload.</div></div><span className="tag">LAST 6</span></div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">EXPOSURES</div><div className="mt-1 text-xl font-extrabold">{logs.length}</div><div className="mt-1 text-[8px] text-zinc-600">logged exercise exposures</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">VOLUME</div><div className="mt-1 text-xl font-extrabold">{totalReps}</div><div className="mt-1 text-[8px] text-zinc-600">reps · last 6 sessions</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">READINESS</div><div className="mt-1 text-xl font-extrabold">{energy?energy.toFixed(1):"—"}<span className="text-[9px] text-zinc-600"> / 5</span></div><div className="mt-1 text-[8px] text-zinc-600">avg energy · sleep {sleep?sleep.toFixed(1):"—"}h</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">JOINT LOAD</div><div className="mt-1 text-xl font-extrabold">{pain||"—"}<span className="text-[9px] text-zinc-600"> / 5</span></div><div className="mt-1 text-[8px] text-zinc-600">max elbow/wrist · last 6</div></div>
   </div>
   <div className="mt-3 grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border border-line bg-panel p-4"><div className="section-kicker">SKILL LEADERS</div><div className="mt-3 space-y-2">{best.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 p-2"><div><div className="text-[10px] font-bold">{r.name}</div><div className="text-[8px] text-zinc-600">{r.exposures} exposures · best {r.best.toFixed(r.unit==="s"?1:0)} {r.unit}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${status(r)}`}>{r.signal}</span></div>)}{!best.length&&<div className="text-xs text-zinc-600">Not enough performance data yet.</div>}</div></div>
    <div className="rounded-xl border border-line bg-panel p-4"><div className="section-kicker">COACH STATUS</div><div className="mt-3 space-y-2">{decisions.slice(0,5).map((d:any,i:number)=><div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 p-2"><div><div className="text-[10px] font-bold">{d.title}</div><div className="text-[8px] text-zinc-600">{d.action}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${d.level==="RED"?"text-rose-400":d.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{d.level}</span></div>)}{!decisions.length&&<div className="text-xs text-zinc-600">No active signals.</div>}</div></div>
   </div>
 </div>;
}


function recentSessions(sessions:any[],days=7){
 const since=Date.now()-days*86400000;
 return (sessions||[]).filter(s=>Number(s?.completed_at?Date.parse(s.completed_at):s?.date||0)>=since);
}
function sessionFatigue(s:any){
 const vals=(s?.exercise_logs||[]).map((l:any)=>Number(l?.result?.fatigue||l?.result?.fatigue_score||0)).filter((x:number)=>x>0);
 return vals.length?vals.reduce((a:number,b:number)=>a+b,0)/vals.length:0;
}
function adherenceSummary(sessions:any[],scheduledDays=6){
 const days=new Set((sessions||[]).map(s=>new Date(s.completed_at||s.date||0).toISOString().slice(0,10)));
 const last7=recentSessions(sessions,7);
 return {completed:last7.length,scheduled:scheduledDays,rate:scheduledDays?Math.min(100,Math.round((last7.length/scheduledDays)*100)):0,activeDays:days.size};
}
function weeklyLoadSummary(sessions:any[]){
 const weeks=new Map<number,{sessions:number;sets:number;reps:number;emom:number;fatigue:number;fatigueN:number}>();
 for(const s of sessions||[]){
  const d=new Date(s.completed_at||s.date||0); const day=(d.getUTCDay()+6)%7; d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()-day); const key=d.getTime();
  const row=weeks.get(key)||{sessions:0,sets:0,reps:0,emom:0,fatigue:0,fatigueN:0}; row.sessions++;
  for(const l of s.exercise_logs||[]){ if(l.status==='skipped')continue; row.sets+=Array.isArray(l.result?.reps)?l.result.reps.length:Array.isArray(l.result?.seconds)?l.result.seconds.length:Array.isArray(l.result?.emom)?l.result.emom.length:0; row.reps+=(l.result?.reps||[]).reduce((a:number,b:number)=>a+Number(b||0),0); row.emom+=(l.result?.emom||[]).reduce((a:number,b:number)=>a+Number(b||0),0); if(Number(l.result?.fatigue)>0){row.fatigue+=Number(l.result.fatigue);row.fatigueN++;}}
  weeks.set(key,row);
 }
 return [...weeks.entries()].sort((a,b)=>b[0]-a[0]).slice(0,4).map(([week,v])=>({...v,week,fatigue:v.fatigueN?v.fatigue/v.fatigueN:0}));
}
function exerciseTrendRows(sessions:any[],limit=12){
 const map=new Map<string,{name:string;vals:number[];dates:number[];pain:number[];fatigue:number[];rirs:number[];bands:string[]}>();
 const logs=(sessions||[]).flatMap(s=>(s.exercise_logs||[]).map((l:any)=>({...l,__session:s})).filter((l:any)=>l.status!=='skipped')).sort((a:any,b:any)=>Date.parse(b.logged_at||b.__session?.completed_at||0)-Date.parse(a.logged_at||a.__session?.completed_at||0));
 for(const l of logs){const id=String(l.exercise_id);const r=l.result||{};let val=0;if(Array.isArray(r.seconds)&&r.seconds.length)val=Math.max(...r.seconds);else if(Array.isArray(r.reps)&&r.reps.length)val=r.reps.reduce((a:number,b:number)=>a+Number(b||0),0);else if(Array.isArray(r.emom)&&r.emom.length)val=r.emom.reduce((a:number,b:number)=>a+Number(b||0),0);if(!val)continue;const row=map.get(id)||{name:String(l.exercise_name||id),vals:[],dates:[],pain:[],fatigue:[],rirs:[],bands:[]};if(row.vals.length<6){row.vals.push(val);row.dates.push(Date.parse(l.logged_at||l.__session?.completed_at||0));row.pain.push(Math.max(Number(l.__session?.readiness?.wristPain||0),Number(l.__session?.readiness?.elbowPain||0)));if(Number(r.fatigue)>0)row.fatigue.push(Number(r.fatigue));if(Number.isFinite(Number(r.rir)))row.rirs.push(Number(r.rir));if(r.band)row.bands.push(String(r.band));}map.set(id,row);}
 return [...map.entries()].map(([id,r])=>{const latest=r.vals[0],prev=r.vals[1];const delta=prev?((latest-prev)/prev)*100:0;const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;const consistency=r.vals.length>1&&Math.max(...r.vals)-Math.min(...r.vals)<=Math.max(1,Math.max(...r.vals)*0.1)?'HIGH':r.vals.length>2?'MEDIUM':'LOW';return {id,name:r.name,latest,best:Math.max(...r.vals),delta,trend:delta>=8?'UP':delta<=-8?'DOWN':'FLAT',consistency,avgPain:avg(r.pain),avgFatigue:avg(r.fatigue),avgRir:avg(r.rirs),band:r.bands[0]||'None',exposures:r.vals.length};}).sort((a,b)=>b.exposures-a.exposures).slice(0,limit);
}
function profileGoalsText(profile:AthleteCoachingProfile|null){if(!profile)return 'Goals not configured';return [profile.primaryGoal, ...(profile.prioritySkills||[])].filter(Boolean).join(' · ')||'Goals not configured';}

function CoachWorkspace({remoteCatalog}:{remoteCatalog:ExerciseCatalogItem[]}){
 const [athletes,setAthletes]=useState<CoachAthlete[]>([]),[selected,setSelected]=useState<string>(""),[program,setProgram]=useState<any>(null),[sessions,setSessions]=useState<any[]>([]),[audit,setAudit]=useState<any[]>([]),[notes,setNotes]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[day,setDay]=useState<DayKey>(DAYS[(new Date().getDay()+6)%7]),[editing,setEditing]=useState<string|null>(null),[saved,setSaved]=useState(""),[coachCode,setCoachCode]=useState<string|null>(null),[showAdd,setShowAdd]=useState(false),[noteTitle,setNoteTitle]=useState(""),[noteBody,setNoteBody]=useState(""),[notePriority,setNotePriority]=useState("normal"),[noteVisible,setNoteVisible]=useState(true),[promotion,setPromotion]=useState<SkillGraphView|null>(null),[promotionBusy,setPromotionBusy]=useState(false),[coachingProfile,setCoachingProfile]=useState<AthleteCoachingProfile|null>(null),[profileDraft,setProfileDraft]=useState<AthleteCoachingProfile|null>(null),[profileSaving,setProfileSaving]=useState(false);
 const catalog=exerciseCatalog(remoteCatalog);
 const loadAthletes=async()=>{setError("");try{const rows=await fetchCoachAthletes();setAthletes(rows);setSelected(prev=>prev&&rows.some(x=>x.id===prev)?prev:(rows[0]?.id||""));}catch(e:any){setError(e?.message||"COACH RELATIONSHIP LOAD FAILED")}finally{setLoading(false)}};
 const loadAthlete=async(id:string)=>{if(!id){setProgram(null);setSessions([]);setAudit([]);setNotes([]);return;}setLoading(true);setError("");try{const [p,s,a,n,cp]=await Promise.all([fetchCoachAthleteProgram(id),fetchCoachAthleteSessions(id,30),fetchCoachAthleteAudit(id,60),fetchCoachNotes(id,20),fetchAthleteCoachingProfile(id)]);setProgram(p);setSessions(s);setAudit(a);setNotes(n);setCoachingProfile(cp);setProfileDraft(cp||{athlete_id:id,primaryGoal:"",secondaryGoals:[],prioritySkills:[],targetDate:"",notes:"",schedule_days:6,equipment:["Pull-up bar","Dip bars","Loop bands","Parallettes"],preferences:{}});}catch(e:any){setError(e?.message||"ATHLETE DATA LOAD FAILED")}finally{setLoading(false)}};
 useEffect(()=>{
  loadAthletes();
  (async()=>{
    try{
      const me=await fetchMyProfile();
      if(me?.role==="coach"&&me.coach_code){setCoachCode(String(me.coach_code));return;}
      const code=await getMyCoachCode();
      setCoachCode(code);
    }catch(e:any){
      setCoachCode(null);
      setError(e?.message||"COACH CODE LOAD FAILED");
    }
  })();
},[]);
 useEffect(()=>{loadAthlete(selected);},[selected]);
 const athlete=athletes.find(x=>x.id===selected); const effective=coachEffectiveProgram(day,program?.blocks||[]);
 const remoteById=new Map<string,any>((program?.blocks||[]).map((b:any)=>[String(b.exercise_id),b] as const));
 const latestReadiness=(sessions||[]).map((s:any)=>s.readiness||{}).find((r:any)=>r&&Object.keys(r).length)||{};
 const flags:string[]=[];
 if(latestReadiness.energy!==undefined&&Number(latestReadiness.energy)<=2)flags.push("LOW ENERGY");
 if(latestReadiness.sleepHours!==undefined&&Number(latestReadiness.sleepHours)<6)flags.push("LOW SLEEP");
 if(latestReadiness.elbowPain!==undefined&&Number(latestReadiness.elbowPain)>=3)flags.push("ELBOW LOAD");
 if(latestReadiness.wristPain!==undefined&&Number(latestReadiness.wristPain)>=3)flags.push("WRIST LOAD");
 const insights=coachProgressionInsights(sessions,program,remoteCatalog); const decisions=coachDecisionEngine(sessions,program); const adherence=adherenceSummary(sessions,6); const weeklyLoad=weeklyLoadSummary(sessions); const trendRows=exerciseTrendRows(sessions);
 const refreshAthlete=async()=>{if(selected)await loadAthlete(selected)};
 const move=async(index:number,delta:number)=>{const blocks=effective.blocks.slice();const next=index+delta;if(next<0||next>=blocks.length)return;[blocks[index],blocks[next]]=[blocks[next],blocks[index]];try{await coachReorderProgramDay(selected,day,blocks.map(b=>({exerciseId:b.id})),"Coach reordered session blocks");await refreshAthlete();setSaved("ORDER SAVED");setTimeout(()=>setSaved(""),2500)}catch(e:any){setError(e?.message||"REORDER FAILED")}};
 const remove=async(block:ExerciseBlock)=>{try{await coachDeleteProgramBlock(selected,block.id,"Coach removed block from future program");await refreshAthlete();setSaved("BLOCK REMOVED — HISTORY UNCHANGED");}catch(e:any){setError(e?.message||"REMOVE FAILED")}};
 const addBlock=async(item:ExerciseCatalogItem)=>{const id=`${item.id}__${Date.now()}`;try{await coachAddProgramBlock({athleteId:selected,exerciseId:id,day,catalogExerciseId:item.id,name:item.name,kind:toUiKind(item),detail:item.detail||"",target:item.defaultTarget||"",sets:item.kind==="HOLD"?3:3,rest:item.restSec||90,bandOptions:item.equipment.includes("band")?BAND_OPTIONS.filter(x=>x!=="None"):undefined,sortOrder:effective.blocks.length,reason:"Coach added a prepared catalog exercise"});setShowAdd(false);await refreshAthlete();setSaved(`${item.name.toUpperCase()} ADDED TO ${day.toUpperCase()}`);}catch(e:any){setError(e?.message||"ADD FAILED")}};
 const promoteSkill=async(view:SkillGraphView)=>{
  if(!selected||!view.current||!view.next||promotionBusy)return;
  const current=effective.blocks.find(b=>String(b.catalogExerciseId||b.id).split("__")[0]===view.current!.exerciseId);
  const next=remoteCatalog.find(x=>x.id===view.next!.exerciseId)||EXERCISE_CATALOG.find(x=>x.id===view.next!.exerciseId);
  if(!current||!next){setError("PROMOTION FAILED — CURRENT OR NEXT CATALOG NODE NOT FOUND");return;}
  setPromotionBusy(true);setError("");
  try{
    await coachPromoteSkillRung({athleteId:selected,day,currentExerciseId:current.id,currentCatalogExerciseId:view.current.exerciseId,nextCatalogExerciseId:next.id,name:next.name,kind:toUiKind(next),detail:next.detail||"",target:next.defaultTarget||"",sets:current.sets||3,rest:next.restSec||current.rest||90,bandOptions:next.equipment.includes("band")?BAND_OPTIONS.filter(x=>x!=="None"):undefined,reason:`Coach promoted ${view.name}: ${view.current.name} → ${view.next.name}`});
    setPromotion(null);await refreshAthlete();setSaved(`PROMOTED — ${next.name.toUpperCase()}`);setTimeout(()=>setSaved(""),3000);
  }catch(e:any){setError(e?.message||"SKILL PROMOTION FAILED")}finally{setPromotionBusy(false)}
 };
 const saveProfile=async()=>{if(!selected||!profileDraft)return;setProfileSaving(true);setError("");try{const saved=await saveAthleteCoachingProfile(selected,profileDraft);setCoachingProfile(saved);setProfileDraft(saved);setSaved("ATHLETE PROFILE SAVED");setTimeout(()=>setSaved(""),2500);}catch(e:any){setError(e?.message||"PROFILE SAVE FAILED")}finally{setProfileSaving(false)}};
 const copyCoachCode=async()=>{if(!coachCode)return;try{await navigator.clipboard.writeText(coachCode);setSaved("COACH CODE COPIED");setTimeout(()=>setSaved(""),1800)}catch{setError("COACH CODE COPY FAILED — COPY IT MANUALLY")}};
 const saveNote=async()=>{if(!noteBody.trim())return;try{await createCoachNote({athleteId:selected,title:noteTitle,body:noteBody,priority:notePriority,athleteVisible:noteVisible});setNoteTitle("");setNoteBody("");await refreshAthlete();setSaved("NOTE SAVED");}catch(e:any){setError(e?.message||"NOTE SAVE FAILED")}};
 if(loading&&!athletes.length)return <div className="py-20 text-center"><div className="eyebrow">COACH</div><div className="mt-3 text-sm font-bold">LOADING ATHLETE ROSTER…</div></div>;
 return <div>
   {promotion&&<div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"><div className="mx-auto w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"><div className="eyebrow">COACH PROMOTION REVIEW</div><h2 className="mt-2 text-2xl font-extrabold">{promotion.current?.name} → {promotion.next?.name}</h2><p className="mt-2 text-xs leading-5 text-zinc-500">Skill Intelligence has qualified the current rung. This action changes only future sessions and leaves historical logs untouched.</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">CURRENT</div><div className="mt-1 text-[10px] font-bold">{promotion.current?.name}</div></div><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">STATUS</div><div className="mt-1 text-[10px] font-bold text-emerald-300">QUALIFIED</div></div><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">NEXT</div><div className="mt-1 text-[10px] font-bold">{promotion.next?.name}</div></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" disabled={promotionBusy} onClick={()=>setPromotion(null)}>CANCEL</button><button className="primary-cta" disabled={promotionBusy} onClick={()=>promoteSkill(promotion)}>{promotionBusy?"PUBLISHING…":"PROMOTE TO NEXT RUNG"}</button></div></div></div>}
   <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="eyebrow">COACH WORKSPACE</div><h1>Manage athletes.</h1><p className="sub">One place to review evidence, prescribe training and publish decisions.</p></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 md:min-w-[220px]"><div className="flex items-center justify-between gap-4"><div className="field-label !mb-0">YOUR COACH CODE</div><span className="text-[8px] font-bold tracking-[.12em] text-emerald-400">PAIRING ONLY</span></div><div className="mt-1 flex items-center justify-between gap-3"><div className="font-mono text-lg font-extrabold tracking-[.18em]">{coachCode||"—"}</div><button className="secondary-cta !px-3 !py-2" disabled={!coachCode} onClick={copyCoachCode}>COPY</button></div><div className="mt-2 text-[8px] leading-4 text-zinc-600">Share this code with an athlete. It does not grant access by itself.</div></div></div><div className="mt-4 sticky top-[70px] z-20 rounded-2xl border border-line bg-ink/95 p-2 backdrop-blur-xl"><div className="grid grid-cols-3 gap-1"><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-intelligence")?.scrollIntoView({behavior:"smooth",block:"start"})}>OVERVIEW</button><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-program")?.scrollIntoView({behavior:"smooth",block:"start"})}>PROGRAM</button><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-history")?.scrollIntoView({behavior:"smooth",block:"start"})}>HISTORY</button></div></div>
   {error&&<div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[10px] text-rose-300">{error}</div>}
   {!athletes.length?<div className="mt-6 grid gap-3 md:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-line bg-panel p-5"><div className="section-kicker">YOUR COACHING ROSTER</div><h2 className="mt-2 text-2xl font-extrabold tracking-tight">No athletes yet.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-zinc-500">Give your 10-character Coach Code to an athlete. Once they connect from Reports → Coach, their training evidence will appear here automatically.</p><div className="mt-5 rounded-xl border border-line bg-panel2 p-4"><div className="field-label">NEXT STEP</div><div className="mt-2 text-sm font-bold">Wait for the first athlete connection.</div><div className="mt-1 text-[9px] leading-4 text-zinc-600">The Coach does not need to create athletes manually.</div></div></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="section-kicker">COACHING LOOP</div><div className="mt-3 grid gap-2 text-[10px] font-bold"><div className="rounded-xl bg-panel2 p-3">01 · ATHLETE TRAINS</div><div className="rounded-xl bg-panel2 p-3">02 · EVIDENCE SYNCs</div><div className="rounded-xl bg-panel2 p-3">03 · COACH REVIEWS</div><div className="rounded-xl bg-panel2 p-3">04 · COACH PUBLISHES</div></div></div></div>:<div className="mt-6 grid gap-3 md:grid-cols-[240px_1fr]">
    <div className="rounded-2xl border border-line bg-panel p-3"><div className="field-label">ATHLETES</div><div className="mt-2 grid gap-1">{athletes.map(a=><button key={a.id} onClick={()=>{setSelected(a.id);setEditing(null)}} className={`rounded-xl border px-3 py-3 text-left ${selected===a.id?"border-violet-500/40 bg-violet-500/10":"border-line bg-panel2"}`}><div className="text-xs font-bold">{a.display_name||"Athlete"}</div><div className="mt-1 text-[8px] text-zinc-600">{a.height_cm?`${a.height_cm} cm`:"Height —"} · {a.weight_kg?`${a.weight_kg} kg`:"Weight —"}</div></button>)}</div></div>
    <div className="min-w-0">
      {athlete&&<div className="grid gap-2 sm:grid-cols-4"><SmallMetric label="ATHLETE" value={athlete.display_name||"Athlete"}/><SmallMetric label="SESSIONS" value={String(sessions.length)}/><SmallMetric label="PROGRAM" value={program?.program?`v${program.program.version}`:"DEFAULT"}/><SmallMetric label="FLAGS" value={String(flags.length)}/></div>}
      {athlete&&<div className="mt-3 grid gap-2 md:grid-cols-3"><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">READINESS</div><div className="mt-2 text-sm font-extrabold">{latestReadiness.energy!==undefined?`${latestReadiness.energy}/5 energy`:"No readiness logged"}</div><div className="mt-1 text-[9px] text-zinc-600">{latestReadiness.sleepHours!==undefined?`${latestReadiness.sleepHours}h sleep`:"Sleep not logged"}</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">FLAGS</div><div className="mt-2 text-sm font-extrabold">{flags.length?flags.join(" · "):"NO ACTIVE FLAGS"}</div><div className="mt-1 text-[9px] text-zinc-600">Review signals only.</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">LATEST NOTE</div><div className="mt-2 text-sm font-extrabold line-clamp-2">{sessions[0]?.session_note||"No session note yet."}</div></div></div>}
      <div id="coach-intelligence" className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">COACH INTELLIGENCE</div><div className="mt-1 text-[9px] text-zinc-500">Decision support from readiness, pain, recent volume and adherence. The Coach never changes the plan automatically.</div></div><span className="tag">HUMAN REVIEW</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{decisions.map((d,i)=><div key={i} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-2"><div className="text-[10px] font-extrabold">{d.title}</div><span className={`text-[8px] font-extrabold tracking-[.12em] ${d.level==="RED"?"text-rose-400":d.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{d.level}</span></div><div className="mt-2 text-[9px] leading-4 text-zinc-500">{d.detail}</div><div className="mt-2 text-[8px] font-bold tracking-[.12em] text-violet2">{d.action}</div></div>)}</div></div>
      <CoachTimeline sessions={sessions} program={program}/>
      <CoachDecisionCenter athleteId={selected} insights={insights} decisions={decisions} onRecorded={refreshAthlete}/>
      <CoachPerformanceDashboard sessions={sessions} program={program} decisions={decisions}/>
      <SkillIntelligencePanel insights={insights}/>
      <SkillGraphPanel catalog={remoteCatalog.length?remoteCatalog:EXERCISE_CATALOG} blocks={effective.blocks} insights={insights} onPromote={setPromotion}/>
      <div className="mt-5 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between"><div><div className="section-kicker">PROGRESSION REVIEW</div><div className="mt-1 text-[9px] text-zinc-600">Evidence from actual exposures. The engine never promotes automatically.</div></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{insights.map((x:SkillInsight)=><div key={x.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{x.skill} · {x.exposures} EXPOSURES</div><div className="mt-1 text-sm font-bold">{x.name}</div></div><span className="text-[8px] font-extrabold tracking-[.12em] text-violet2">{x.decision}</span></div><div className="mt-2 text-[9px] text-zinc-500">{x.action} · {x.qualifyingStreak}/2 consecutive qualifying</div></div>)}{!insights.length&&<div className="text-xs text-zinc-600">Not enough logged data yet.</div>}</div></div>
      <div className="mt-4 flex gap-1 overflow-x-auto pb-1">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} className={`rounded-lg border px-3 py-2 text-[9px] font-bold whitespace-nowrap ${day===d?"border-violet-500/40 bg-violet-500/10 text-violet2":"border-line bg-panel text-zinc-600"}`}>{d.slice(0,3).toUpperCase()}</button>)}</div>
      <div className="mt-3 rounded-2xl border border-line bg-panel"><div className="border-b border-line p-4 flex items-center justify-between gap-3"><div><div className="section-kicker">{effective.title}</div><div className="mt-1 text-[10px] text-zinc-500">{effective.subtitle}</div></div><button className="secondary-cta" onClick={()=>setShowAdd(v=>!v)}><PlusCircle size={14}/> ADD EXERCISE</button></div>{showAdd&&<div className="border-b border-line p-4"><div className="field-label">CATALOG PICKER</div><div className="mt-2 grid max-h-64 gap-1 overflow-y-auto">{catalog.filter(x=>!effective.blocks.some(b=>b.id.startsWith(x.id+"__"))&&(!program?.blocks||!program.blocks.some((b:any)=>b.day===day && b.override_payload?.catalogExerciseId===x.id))).slice(0,80).map(x=><button key={x.id} onClick={()=>addBlock(remoteCatalog.find(r=>r.id===x.id)||EXERCISE_CATALOG.find(r=>r.id===x.id)!)} className="rounded-xl border border-line bg-panel2 p-3 text-left"><div className="text-xs font-bold">{x.name}</div><div className="mt-1 text-[8px] text-zinc-600">{x.skill||x.category} · D{x.difficulty||"—"} · {x.defaultTarget||"custom target"}</div></button>)}</div></div>}
      {effective.blocks.map((b:ExerciseBlock,i:number)=>{const remote=remoteById.get(b.id);return <div key={b.id} className="border-b border-line p-4 last:border-b-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="tag">{LABEL[b.kind]}</span><strong className="mt-1 block">{b.name}</strong><p className="mt-1 text-[10px] text-zinc-500">{b.sets?`${b.sets} sets · `:""}{b.target}{b.rest?` · ${b.rest}s rest`:""}</p>{remote&&<span className="mt-2 inline-block text-[8px] font-bold tracking-[.12em] text-violet2">COACH MANAGED</span>}</div><div className="flex items-center gap-1"><button className="mini-btn" disabled={i===0} onClick={()=>move(i,-1)} title="Move up"><ChevronUp size={14}/></button><button className="mini-btn" disabled={i===effective.blocks.length-1} onClick={()=>move(i,1)} title="Move down"><ChevronDown size={14}/></button><button className="secondary-cta" onClick={()=>setEditing(b.id)}>EDIT</button><button className="mini-btn" onClick={()=>remove(b)} title="Remove"><Trash2 size={14}/></button></div></div>{editing===b.id&&<CoachProgramEditor athleteId={selected} day={day} block={b} remoteBlock={remote} sortOrder={i} catalog={catalog} onClose={()=>setEditing(null)} onSaved={async msg=>{setEditing(null);setSaved(msg);await refreshAthlete();setTimeout(()=>setSaved(""),3000)}}/>}</div>})}</div>
      {saved&&<div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] text-emerald-300">{saved}</div>}
      <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">COACH NOTES</div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]"><input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="Title"/><select value={notePriority} onChange={e=>setNotePriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div><textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-panel2 p-3 text-xs" placeholder="What should the athlete know?"/><div className="mt-2 flex items-center justify-between gap-3"><label className="text-[9px] text-zinc-500"><input type="checkbox" checked={noteVisible} onChange={e=>setNoteVisible(e.target.checked)} className="mr-2"/>Visible to athlete</label><button className="primary-cta" onClick={saveNote} disabled={!noteBody.trim()}>SAVE NOTE</button></div><div className="mt-4 grid gap-2">{notes.slice(0,6).map((n:any)=><div key={n.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold">{n.title}</div><div className="mt-1 text-[9px] text-zinc-500">{n.priority?.toUpperCase()} · {n.athlete_visible?"ATHLETE VISIBLE":"PRIVATE"}</div></div><span className="text-[8px] text-zinc-600">{new Date(n.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-[10px] leading-5 text-zinc-400">{n.body}</p></div>)}{!notes.length&&<div className="text-xs text-zinc-600">No coach notes yet.</div>}</div></div>
      <div id="coach-history" className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">PROGRAM HISTORY</div><div className="mt-3 max-h-80 overflow-y-auto">{audit.slice(0,20).map((a:any)=><div key={a.id} className="history-row"><span>{new Date(a.created_at).toLocaleDateString()}</span><strong>{a.action?.toUpperCase()} · {a.entity_type}</strong><span className="text-right text-muted">{a.reason||"—"}</span></div>)}{!audit.length&&<p className="text-xs text-zinc-600">No program history yet.</p>}</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">RECENT SESSIONS</div>{sessions.slice(0,8).map((s:any)=><div key={s.id} className="history-row"><span>{s.completed_at?new Date(s.completed_at).toLocaleDateString():"—"}</span><strong>{s.day}</strong><span className="text-right text-muted">{Math.round(Number(s.duration_sec||0)/60)} min · {Number(s.total_reps||0)} reps</span></div>)}{!sessions.length&&<p className="mt-3 text-xs text-zinc-600">No completed sessions yet.</p>}</div></div>
    </div></div>}
 </div>;
}

function CoachProgramEditor({athleteId,day,block,remoteBlock,sortOrder,catalog,onClose,onSaved}:{athleteId:string;day:DayKey;block:ExerciseBlock;remoteBlock:any;sortOrder:number;catalog:{id:string;name:string;detail?:string;kind:BlockKind;bandOptions?:Band[];category?:string;skill?:string;pattern?:string;difficulty?:number;sideMode?:string;defaultTarget?:string;restSec?:number}[];onClose:()=>void;onSaved:(message:string)=>void}){
 const payload=remoteBlock?.override_payload||{}; const currentCatalogId=payload.catalogExerciseId||catalog.find(x=>x.name===block.name)?.id||block.id; const currentCatalog=catalog.find(x=>x.id===currentCatalogId)||catalog.find(x=>x.name===block.name); const compatible=catalog.filter(x=>{
   if(!currentCatalog)return true;
   if(x.id===currentCatalog.id)return true;
   const sameSkill=x.skill===currentCatalog.skill;
   const samePattern=x.pattern===currentCatalog.pattern;
   const sameKind=x.kind===currentCatalog.kind;
   return (sameSkill||samePattern) && sameKind;
 }).sort((a,b)=>Number(a.difficulty||0)-Number(b.difficulty||0)||a.name.localeCompare(b.name));
 const [catalogId,setCatalogId]=useState(currentCatalog?.id||block.id),[name,setName]=useState(payload.name||block.name),[kind,setKind]=useState<BlockKind>((payload.kind||block.kind) as BlockKind),[sets,setSets]=useState(String(payload.sets??block.sets??1)),[target,setTargetLocal]=useState(payload.target??block.target??currentCatalog?.defaultTarget??""),[rest,setRestLocal]=useState(String(payload.rest??block.rest??currentCatalog?.restSec??0)),[band,setBand]=useState((payload.defaultBand||block.defaultBand||currentCatalog?.bandOptions?.find(x=>x!=="None")||"")),[detail,setDetail]=useState(payload.detail??block.detail??currentCatalog?.detail??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const choose=(id:string)=>{const c=catalog.find(x=>x.id===id);if(!c)return;setCatalogId(c.id);setName(c.name);setKind(c.kind);setDetail(c.detail||"");setTargetLocal(c.defaultTarget||"");setRestLocal(String(c.restSec||90));setBand(c.bandOptions?.find(x=>x!=="None")||"")};
 const save=async()=>{setBusy(true);setError("");try{const selectedCatalog=catalog.find(x=>x.id===catalogId);const bands=(selectedCatalog?.bandOptions||block.bandOptions||[]).filter(x=>x!=="None") as Band[];await saveCoachProgramBlock({athleteId,catalogExerciseId:catalogId,block:{id:block.id,day,name:name.trim()||block.name,kind,detail:detail.trim()||undefined,target:target.trim()||block.target,sets:Math.max(1,Number(sets)||1),rest:Math.max(0,Number(rest)||0),bandOptions:bands.length?bands:undefined,sortOrder}});onSaved("COACH CHANGE PUBLISHED — ATHLETE WILL SEE IT ON NEXT LOAD");}catch(e:any){setError(e?.message||"COACH SAVE FAILED")}finally{setBusy(false)}};
 const reset=async()=>{setBusy(true);setError("");try{await resetCoachProgramBlock(athleteId,block.id,day,block);onSaved("COACH OVERRIDE REMOVED — DEFAULT RESTORED")}catch(e:any){setError(e?.message||"COACH RESET FAILED")}finally{setBusy(false)}};
 return <div className="mt-4 rounded-xl border border-violet-500/15 bg-panel2 p-4"><div className="flex items-center justify-between"><div className="field-label">COACH EDITOR</div><button className="text-[9px] font-bold text-zinc-600" onClick={onClose}>CLOSE</button></div>{error&&<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[9px] text-rose-300">{error}</div>}<label className="mt-3 block"><span className="field-label">EXERCISE / VARIANT</span><select value={catalogId} onChange={e=>choose(e.target.value)} disabled={busy}>{compatible.map(x=><option key={x.id} value={x.id}>{x.name}{x.difficulty?` · D${x.difficulty}`:""}</option>)}</select><span className="mt-1 block text-[8px] text-zinc-600">Compatible by skill or movement pattern. The catalog is the source of prepared alternatives.</span></label><div className="mt-3 grid grid-cols-3 gap-2"><Field label="SETS" value={sets} set={setSets} placeholder="3"/><Field label="TARGET" value={target} set={setTargetLocal} placeholder="8–10"/><Field label="REST (S)" value={rest} set={setRestLocal} placeholder="90"/></div>{(currentCatalog?.bandOptions||block.bandOptions||[]).length>0&&<div className="mt-3"><BandSelect label="DEFAULT LOOP" value={band} set={setBand} options={(currentCatalog?.bandOptions||block.bandOptions||[]) as string[]}/></div>}<label className="mt-3 block"><span className="field-label">COACH NOTE</span><input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Optional cue" disabled={busy}/></label><div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" disabled={busy} onClick={reset}>RESET TO DEFAULT</button><button className="primary-cta" disabled={busy} onClick={save}>{busy?"SAVING…":"PUBLISH CHANGE"}</button></div><div className="mt-2 text-[8px] leading-4 text-zinc-600">Only the future prescription changes. Workout history is immutable.</div></div>;
}

function App(){
 const [tab,setTab]=useState<"today"|"plan"|"reports">("today");
 const [day,setDay]=useState<DayKey>(DAYS[(new Date().getDay()+6)%7]);
 const [player,setPlayer]=useState<any>(null);
 const [draft,setDraft]=useState<any>(()=>getDraft());
 const [refresh,setRefresh]=useState(0);
 const [session,setSession]=useState<any>(null);
 const [profile,setProfile]=useState<UserProfile|null>(null);
 const [authReady,setAuthReady]=useState(!supabaseConfigured);
 const [syncing,setSyncing]=useState(false);
 const [exerciseCatalog,setExerciseCatalog]=useState<ExerciseCatalogItem[]>(EXERCISE_CATALOG);

 useEffect(()=>{
   if(!supabase||!supabaseConfigured){ setAuthReady(true); return; }
   let alive=true;
   (async()=>{
     try{
       const current=await getSession();
       if(!alive)return;
       setSession(current);
       if(current){
         let loadedProfile:UserProfile|null=null;
         try{loadedProfile=await fetchMyProfile();setProfile(loadedProfile)}catch(e){console.warn("Profile load deferred.",e)}
         setSyncing(true);
         try{
           if(loadedProfile?.role!=='coach'){ await syncLocalSessions(getSessions()); await syncProgramLayer(); await syncMobilitySessions(); }
           try{setExerciseCatalog(await fetchExerciseCatalog())}catch(e){console.warn("Exercise catalog fallback.",e)}
           if(alive)setRefresh(x=>x+1);
         } finally { if(alive)setSyncing(false); }
       }
     }catch(e){ console.error(e); } finally { if(alive)setAuthReady(true); }
   })();
   const {data}=supabase.auth.onAuthStateChange((event,next)=>{
     if(!alive)return;
     setSession(next);
     if(event==='SIGNED_IN'&&next){
       setSyncing(true);
       (async()=>{
         try{
           const loadedProfile=await fetchMyProfile();
           if(alive)setProfile(loadedProfile);
           if(loadedProfile?.role!=='coach') await Promise.all([syncLocalSessions(getSessions()),syncProgramLayer(),syncMobilitySessions()]);
           try{setExerciseCatalog(await fetchExerciseCatalog())}catch(e){console.warn("Exercise catalog fallback.",e)}
           if(alive)setRefresh(x=>x+1);
         }catch(e){console.error(e)}finally{if(alive)setSyncing(false)}
       })();
     }
   });
   return()=>{alive=false;data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(!player)setDraft(getDraft())},[player,refresh]);
 const start=()=>{clearDraft();setDraft(null);setPlayer({day,index:-1,logs:[],started:Date.now(),readiness:{}})};
 const resume=()=>{if(!draft)return;setPlayer(draft);setDraft(null)};
 if(supabaseConfigured&&!authReady)return <LoadingScreen/>;
 if(supabaseConfigured&&!session)return <AuthScreen onSignedIn={setSession}/>;
 if(player)return <WorkoutPlayer state={player} setState={setPlayer} refresh={()=>setRefresh(x=>x+1)}/>;
 if(profile?.role === "coach") return <div className="min-h-[100dvh] bg-ink text-white"><Header email={session?.user?.email} syncing={syncing} onSignOut={async()=>{await signOut();setSession(null);setProfile(null)}}/><main className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8"><CoachWorkspace remoteCatalog={exerciseCatalog}/></main></div>;
 return <div className="min-h-[100dvh] bg-ink text-white pb-[calc(88px+env(safe-area-inset-bottom))]">
  <Header email={session?.user?.email} syncing={syncing} onSignOut={supabaseConfigured?async()=>{await signOut();setSession(null)}:undefined}/>
  <main className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
    {tab==="today"&&<Today day={day} setDay={setDay} start={start} draft={draft} onResume={resume}/>}
    {tab==="plan"&&<Plan day={day} setDay={setDay} refresh={refresh} remoteCatalog={exerciseCatalog}/>}
    {tab==="reports"&&<Reports refresh={refresh}/>}
  </main>
  <Nav tab={tab} setTab={setTab}/>
 </div>
}

function LoadingScreen(){return <div className="min-h-[100dvh] bg-ink text-white grid place-items-center"><div className="text-center"><div className="eyebrow">CALISTHENICS COACH</div><div className="mt-3 text-sm font-extrabold">RESTORING SESSION</div></div></div>}

function AuthScreen({onSignedIn}:{onSignedIn:(s:any)=>void}){
 const [mode,setMode]=useState<"sign_in"|"sign_up"|"reset">("sign_in"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMsg("");try{
   if(mode==="reset"){
     const r=await resetPassword(email);
     if(r.error)throw r.error;
     setMsg("PASSWORD RESET EMAIL SENT. CHECK YOUR INBOX.");
   }else{
     const r=mode==='sign_in'?await signInWithPassword(email.trim(),password):await signUpWithPassword(email.trim(),password);
     if(r.error) throw r.error;
     if(r.data.session) onSignedIn(r.data.session); else setMsg("ACCOUNT CREATED. CONFIRM YOUR EMAIL, THEN SIGN IN.");
   }
 }catch(err:any){setMsg(err?.message||"AUTHENTICATION FAILED")}finally{setBusy(false)}};
 const title=mode==="reset"?"Reset your password":mode==="sign_up"?"Create your account":"Your training, synced.";
 return <div className="min-h-[100dvh] bg-ink text-white px-4 pt-[calc(env(safe-area-inset-top)+16px)]"><div className="mx-auto max-w-sm pt-16">
   <div className="eyebrow">CALISTHENICS <span className="text-violet2">COACH</span></div><h1 className="mt-3 text-4xl font-extrabold tracking-tight">{title}</h1><p className="mt-3 text-xs leading-5 text-zinc-500">One account for workouts, history, progress and future coach sync.</p>
   <form onSubmit={submit} className="mt-8 rounded-2xl border border-line bg-panel p-4">
    {mode!=="reset"&&<div className="flex rounded-xl border border-line bg-panel2 p-1"><button type="button" className={`flex-1 rounded-lg py-2 text-[9px] font-bold ${mode==='sign_in'?'bg-violet-600 text-white':'text-zinc-600'}`} onClick={()=>{setMode('sign_in');setMsg('')}}>SIGN IN</button><button type="button" className={`flex-1 rounded-lg py-2 text-[9px] font-bold ${mode==='sign_up'?'bg-violet-600 text-white':'text-zinc-600'}`} onClick={()=>{setMode('sign_up');setMsg('')}}>CREATE ACCOUNT</button></div>}
    <label className="mt-4 block"><span className="field-label">EMAIL</span><input className="mt-1 w-full rounded-xl border border-line bg-panel2 p-3 text-base sm:text-sm" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
    {mode!=="reset"&&<label className="mt-3 block"><span className="field-label">PASSWORD</span><input className="mt-1 w-full rounded-xl border border-line bg-panel2 p-3 text-base sm:text-sm" type="password" autoComplete={mode==='sign_in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/></label>}
    {msg&&<div className="mt-3 rounded-xl border border-violet-500/15 bg-violet-500/5 p-3 text-[9px] leading-4 text-zinc-400">{msg}</div>}
    <button className="primary-cta mt-4 w-full" disabled={busy}>{busy?'PLEASE WAIT…':mode==='reset'?'SEND RESET EMAIL':mode==='sign_in'?'SIGN IN':'CREATE ACCOUNT'}</button>
    <div className="mt-3 flex justify-center gap-3 text-[9px] text-zinc-600"><button type="button" className="underline" onClick={()=>{setMode(mode==='reset'?'sign_in':'reset');setMsg('')}}>{mode==='reset'?'BACK TO SIGN IN':'FORGOT PASSWORD?'}</button></div>
   </form>
 </div></div>
}
function Header({email,syncing,onSignOut}:{email?:string;syncing?:boolean;onSignOut?:()=>void}){
 return <header className="sticky top-0 z-30 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
  <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16">
   <div className="text-[12px] font-extrabold tracking-[.14em]">CALISTHENICS <span className="text-violet2">COACH</span></div>
   <div className="flex items-center gap-3">
    <div className="text-right"><div className="text-[8px] font-bold tracking-[.14em] text-zinc-600">{syncing?'SYNCING':'SYNCED'}</div><div className="max-w-[160px] truncate text-[8px] text-zinc-700">{email||'LOCAL MODE'}</div></div>
    {onSignOut&&<button className="min-h-9 min-w-9 rounded-full border border-line bg-panel text-zinc-500" onClick={onSignOut} aria-label="Sign out"><LogOut size={14}/></button>}
   </div>
  </div>
 </header>
}
function Nav({tab,setTab}:{tab:string;setTab:(x:any)=>void}){
 return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"><div className="mx-auto grid h-[68px] max-w-5xl grid-cols-3 sm:h-[72px]">{[["today","TODAY"],["plan","PLAN"],["reports","REPORTS"]].map(([id,l])=><button key={id} aria-label={l} onClick={()=>setTab(id)} className={`text-[10px] font-bold ${tab===id?"text-violet2":"text-zinc-600"}`}>{l}</button>)}</div></nav>
}



const LOCAL_PROFILE_KEY="cc-athlete-coaching-profile";
function getLocalAthleteProfile():AthleteCoachingProfile|null{try{const x=JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY)||"null");return x&&typeof x==='object'?x:null}catch{return null}}
function saveLocalAthleteProfile(profile:AthleteCoachingProfile){localStorage.setItem(LOCAL_PROFILE_KEY,JSON.stringify({...profile,updated_at:new Date().toISOString()}));}

function AthleteGoalCard(){
 const [profile,setProfile]=useState<AthleteCoachingProfile|null>(()=>getLocalAthleteProfile());
 useEffect(()=>{if(supabaseConfigured){fetchMyCoachingProfile().then(p=>{if(p){setProfile(p);saveLocalAthleteProfile(p)}}).catch(()=>{})}},[]);
 if(!profile)return null;
 return <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="section-kicker">CURRENT COACH FOCUS</div><div className="mt-2 text-sm font-extrabold">{profile.primaryGoal||"Performance development"}</div><div className="mt-2 flex flex-wrap gap-2 text-[8px] font-bold tracking-[.1em] text-violet2">{(profile.prioritySkills||[]).slice(0,4).map(x=><span key={x} className="chip">{x}</span>)}</div></div>
}
function RecoveryTrend(){const ss=getSessions().slice(-7);const rows=ss.map(s=>({date:new Date(s.date).toLocaleDateString(),sleep:s.readiness.sleepHours,energy:s.readiness.energy,pain:Math.max(s.readiness.wristPain||0,s.readiness.elbowPain||0)}));return <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">RECOVERY — LAST 7</div><div className="mt-3 grid gap-2">{rows.slice().reverse().map(r=><div key={r.date} className="history-row"><span>{r.date}</span><strong>{r.sleep?`${r.sleep.toFixed(1)}h sleep`:'—'}</strong><span>Energy {r.energy??'—'}/5 · Pain {r.pain}/5</span></div>)}{!rows.length&&<p className="text-xs text-zinc-600">No recovery history yet.</p>}</div></div>}

function ProgressionHint({block}:{block:ExerciseBlock}){
 const spec=PROGRESSIONS[block.id];
 if(!spec)return null;
 const rows=getLogs().filter(l=>l.exerciseId===block.id&&l.status==="complete").sort((a,b)=>a.date-b.date).slice(-2);
 if(rows.length<2)return null;
 const qualifying=rows.every(l=>meetsCurrentProgression(block.id,l));
 return <div className={`mt-3 rounded-xl border p-3 ${qualifying?"border-emerald-500/20 bg-emerald-500/5":"border-line bg-panel2"}`}>
   <div className="flex items-center justify-between gap-2"><span className="section-kicker">PROGRESSION</span><span className={`text-[8px] font-extrabold tracking-[.12em] ${qualifying?"text-emerald-300":"text-zinc-600"}`}>{qualifying?"CANDIDATE":"BUILDING"}</span></div>
   <div className="mt-1 text-[10px] leading-4 text-zinc-400">{qualifying?`Next candidate: ${spec.next}`:`Build ${spec.current} → ${spec.next}`}</div>
   <div className="mt-1 text-[8px] leading-4 text-zinc-600">{qualifying?"This is a coach decision, not an automatic change.":spec.rule}</div>
 </div>
}

function readinessStatus(r:Readiness){
 const energy=Number(r.energy), sleep=Number(r.sleepHours), pain=Math.max(Number(r.wristPain||0),Number(r.elbowPain||0));
 if(pain>=4)return {label:"PAIN REVIEW",tone:"text-rose-300",detail:"High pain signal. Keep the session conservative and review the movement if needed."};
 if((Number.isFinite(energy)&&energy<=2)||(Number.isFinite(sleep)&&sleep<6))return {label:"CAUTION",tone:"text-amber-300",detail:"Recovery is below baseline. Keep targets stable and avoid unnecessary progression."};
 if(Number.isFinite(energy)||Number.isFinite(sleep))return {label:"READY",tone:"text-emerald-300",detail:"Recovery data supports the planned session."};
 return {label:"NOT RECORDED",tone:"text-zinc-500",detail:"No recovery check-in recorded for this session."};
}
function CoachVerdict({session}:{session:SessionSummary}){
 const strong=scoreSessionSignals(session); const label=strong.status; const tone=label==="PROGRESS"?"text-emerald-300":label==="HOLD"?"text-violet2":label==="RECOVERY"?"text-amber-300":"text-zinc-400";
 return <section className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">COACH VERDICT</div><div className={`mt-1 text-lg font-extrabold ${tone}`}>{label}</div><p className="mt-2 text-[10px] leading-5 text-zinc-400">{strong.detail}</p></div><span className="tag">POST-SESSION</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{strong.reasons.map((x:string)=><div key={x} className="rounded-xl border border-line bg-panel p-3 text-[9px] leading-4 text-zinc-500">{x}</div>)}</div></section>
}
function scoreSessionSignals(session:SessionSummary){
 const logs=session.logs.filter(l=>l.status!=="skipped"), reasons:string[]=[];
 const fatigues=logs.map(l=>Number(l.result.fatigue)).filter(Number.isFinite), avgFat=fatigues.length?fatigues.reduce((a,b)=>a+b,0)/fatigues.length:null;
 const emoms=logs.filter(l=>l.kind==="EMOM"&&l.result.emom?.length); const drops=emoms.map(l=>emomStats(l.result.emom||[]).drop);
 const targetHits=logs.filter(l=>{const reps=l.result.reps||[], emom=l.result.emom||[]; if(reps.length)return reps.every(x=>x>0); if(emom.length)return emom.length>=5; return true}).length;
 if(avgFat!==null&&avgFat>=4){reasons.push("Average fatigue was high; do not add volume yet."); return {status:"RECOVERY",detail:"Keep the next exposure conservative until fatigue returns to baseline.",reasons};}
 if(drops.some(d=>d>20)){reasons.push("At least one EMOM showed a meaningful drop-off."); reasons.push("Prioritize repeatable output over a higher opening minute."); return {status:"HOLD",detail:"The session produced useful work, but the next target should be consolidated before progressing.",reasons};}
 if(targetHits>=Math.max(1,Math.ceil(logs.length*.6))){reasons.push("Most completed blocks met the planned workload."); reasons.push("Use the progression proposals below as the only source of plan changes."); return {status:"PROGRESS",detail:"The session was completed with enough stable work to consider progression candidates.",reasons};}
 reasons.push("The session contains incomplete or mixed evidence."); reasons.push("Keep the next exposure close to the current prescription."); return {status:"HOLD",detail:"Not enough clean evidence to justify a bigger change.",reasons};
}
function PRMoments({session}:{session:SessionSummary}){
 const all=getSessions().filter(s=>s.id!==session.id); const moments:string[]=[];
 const previousBest=(id:string,kind:"reps"|"static"|"emom")=>{let best=0;for(const s of all){for(const l of s.logs){if(l.exerciseId!==id||l.status==="skipped")continue;const v=kind==="static"?Math.max(...(l.result.seconds||[0])):kind==="emom"?(l.result.emom||[]).reduce((a,b)=>a+b,0):Math.max(...(l.result.reps||[0]));best=Math.max(best,v)}}return best};
 for(const l of session.logs){if(l.status==="skipped")continue;const v=l.kind==="SKILL_STATIC"?Math.max(...(l.result.seconds||[0])):l.kind==="EMOM"?(l.result.emom||[]).reduce((a,b)=>a+b,0):Math.max(...(l.result.reps||[0]));if(v<=0)continue;const k=l.kind==="SKILL_STATIC"?"static":l.kind==="EMOM"?"emom":"reps";const prev=previousBest(l.exerciseId,k as any);if(v>prev)moments.push(`${l.exerciseName}: ${l.kind==="SKILL_STATIC"?`${v.toFixed(1)}s`:`${v} reps`}${prev?` · +${(v-prev).toFixed(k==="static"?1:0)}`:" · FIRST PR"}`)}
 if(!moments.length)return null;
 return <section className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="section-kicker text-emerald-300">TODAY'S WINS</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{moments.slice(0,4).map(x=><div key={x} className="rounded-xl border border-emerald-500/10 bg-panel p-3 text-[10px] font-bold text-zinc-300">{x}</div>)}</div></section>
}
function Today({day,setDay,start,draft,onResume}:{day:DayKey;setDay:(x:DayKey)=>void;start:()=>void;draft:any;onResume:()=>void}){
 const p=effectiveProgram(day),push=["Monday","Wednesday","Friday"].includes(day);
 const last=latestSession(day);
 return <div>
  <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
   <div><div className="eyebrow">TODAY</div><h1>{p.title}</h1><p className="sub">{p.subtitle}</p>{push&&<div className="mt-2 text-[10px] text-violet2">PUSH GOALS · 100 PUSH-UPS / 50 DIPS</div>}</div>
   <button className="primary-cta w-full md:w-auto" onClick={draft?onResume:start}>{draft?"RESUME WORKOUT":"START WORKOUT"}</button>
  </div>
  <div className="my-7 grid grid-cols-7 gap-1">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} className={`rounded-lg border px-1 py-2 text-[9px] font-extrabold ${day===d?"border-transparent bg-violet-600 text-white":"border-line bg-panel text-zinc-600"}`}>{d.slice(0,3).toUpperCase()}</button>)}</div>
  <div className="mb-3 text-[9px] font-extrabold tracking-[.16em] text-zinc-600">SESSION</div>
  <div className="grid gap-2 md:grid-cols-2">
   <div className="session-row border-violet-500/15"><div className="session-index">00</div><div><span className="tag">WARM-UP</span><strong>{push?"Push / wrist / shoulder prep":"Pull / elbow / shoulder prep"}</strong><p>{p.warmup.map(x=>x.name).join(" • ")}</p></div></div>
   {p.blocks.map((b,i)=><div key={b.id} className="session-row"><div className="session-index">{String(i+1).padStart(2,"0")}</div><div><span className="tag">{LABEL[b.kind]}</span><strong>{currentVariantFor(b.id,b.name)}</strong><p>{b.detail}</p><ProgressionHint block={b}/></div></div>)}
  </div>
  <AthleteGoalCard />
  <div className="mt-4 grid gap-2 md:grid-cols-2">
    {last?<div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="section-kicker">LAST SESSION</div><div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-400"><span>{Math.round(last.durationSec/60)} min</span><span>{last.totalReps} reps</span><span>{last.emomReps} EMOM</span></div></div>:<div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">FIRST SESSION</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">Your performance history will appear here after the first completed session.</p></div>}
    <div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">TODAY'S FOCUS</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">Follow the prescribed variant first. Progression candidates are reviewed from logged performance after the session.</p>{draft&&<div className="mt-2 text-[8px] font-bold tracking-[.12em] text-violet2">UNFINISHED SESSION AVAILABLE · RESUME WHERE YOU LEFT OFF</div>}</div>
  </div>
 </div>
}

function Field({label,value,set,placeholder}:{label:string;value:string;set:(x:string)=>void;placeholder:string}){return <label><span className="field-label">{label}</span><input className="w-full rounded-xl border border-line bg-panel2 p-3 outline-none" inputMode="decimal" value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/></label>}
function BandSelect({label,value,set,options}:{label:string;value:string;set:(x:string)=>void;options:string[]}){return <label><span className="field-label">{label}</span><select value={value} onChange={e=>set(e.target.value)}><option value="">None / no loop</option>{options.filter(x=>x!=="None").map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
function Select({label,value,set,options}:{label:string;value:string;set:(x:string)=>void;options:string[]}){return <label><span className="field-label">{label}</span><select className="w-full rounded-xl border border-line bg-panel2 p-3" value={value} onChange={e=>set(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></label>}

function TrendRow({name,values,unit}:{name:string;values:number[];unit:string}){
 const v=values.slice(-6),max=Math.max(...v,1);
 return <div className="rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between gap-3"><div><span className="field-label">{name}</span><div className="mt-1 text-sm font-extrabold">{v.length?v[v.length-1].toFixed(unit==="s"?1:0):"—"}<span className="ml-1 text-[9px] text-zinc-600">{unit}</span></div></div><span className="text-[9px] text-zinc-600">LAST {v.length}/6</span></div>{v.length>1&&<div className="mt-4 flex h-10 items-end gap-1">{v.map((x,i)=><div key={i} className="flex-1 rounded-sm bg-violet-500/30" style={{height:`${Math.max(10,Math.round((x/max)*100))}%`}}/> )}</div>}{v.length>1&&<div className="mt-2 text-[8px] text-zinc-600">{v[0].toFixed(unit==="s"?1:0)} → {v[v.length-1].toFixed(unit==="s"?1:0)} {unit}</div>}</div>
}
function trendValues(id:string,kind:"static"|"reps"|"emom"){
 return getSessions().flatMap(s=>s.logs.filter(l=>l.exerciseId===id&&!l.skipped).map(l=>kind==="static"?Math.max(...(l.result.seconds||[0])):kind==="reps"?(l.result.reps||[]).reduce((a,b)=>a+b,0):(l.result.emom||[]).reduce((a,b)=>a+b,0))).filter(x=>x>0);
}
function Progress({refresh}:{refresh:number}){
 const ss=getSessions(),logs=getLogs(),weights=ss.map(s=>s.readiness?.weightKg).filter((x):x is number=>typeof x==="number");
 const touch=trendValues("touch","static"),fl=trendValues("flpu","reps"),oap=trendValues("oap","reps"),pushBest=goalTrend("push-up"),dipBest=goalTrend("dips");
 const [selected,setSelected]=useState<string|null>(null);
 const prs=buildPrVault();
 const milestones=buildMilestones();
 return <div>
  <div className="eyebrow">PROGRESS</div><h1>Performance</h1><p className="sub">Your current level, your bests, and the next useful milestone.</p>
  <div className="mt-6 grid grid-cols-3 gap-2"><Metric label="SESSIONS" value={ss.length}/><Metric label="BLOCKS" value={logs.length}/><Metric label="EMOM" value={logs.filter(x=>x.kind==="EMOM").length}/></div>
  <div className="mt-4 grid gap-2 md:grid-cols-4"><SmallMetric label="WEIGHT NOW" value={weights.length?`${weights[weights.length-1]!.toFixed(1)} kg`:"—"}/><SmallMetric label="FRONT TOUCH" value={bestStatic("touch")}/><SmallMetric label="FL PULL-UP" value={bestReps("flpu")}/><SmallMetric label="OAP" value={bestReps("oap")}/></div>
  <div className="mt-8"><div className="section-kicker">KEY TRENDS</div><div className="mt-3 grid gap-2 md:grid-cols-2"><TrendRow name="FRONT TOUCH" values={touch} unit="s"/><TrendRow name="FL PULL-UP" values={fl} unit="reps"/><TrendRow name="OAP" values={oap} unit="reps"/><TrendRow name="PUSH-UP BEST SET" values={pushBest} unit="reps"/><TrendRow name="DIPS BEST SET" values={dipBest} unit="reps"/></div></div>
  <div className="mt-8"><div className="flex items-end justify-between"><div><div className="section-kicker">PR VAULT</div><p className="mt-1 text-[10px] text-zinc-600">Best recorded performance, not today's target.</p></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{prs.map(pr=><button key={pr.id} className="rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-violet-500/40" onClick={()=>setSelected(pr.id)}>
      <div className="flex items-start justify-between gap-3"><div><span className="field-label">{pr.category}</span><div className="mt-1 text-sm font-extrabold">{pr.name}</div></div><span className="text-[9px] text-zinc-600">{pr.date?new Date(pr.date).toLocaleDateString():"—"}</span></div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{pr.value}</div><div className="mt-1 text-[9px] text-zinc-600">{pr.context}</div>
    </button>)}{!prs.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">Your PR vault will fill automatically as you log sessions.</div>}</div>
  </div>
  <div className="mt-8"><div className="section-kicker">NEXT MILESTONES</div><div className="mt-3 grid gap-2 md:grid-cols-2">{milestones.map(m=><div key={m.id} className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><span className="field-label">{m.status}</span><div className="mt-1 text-sm font-extrabold">{m.name}</div></div><span className="text-[9px] font-bold text-violet2">{m.progress}</span></div><p className="mt-3 text-[10px] leading-5 text-zinc-500">{m.detail}</p></div>)}{!milestones.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">Complete a few sessions to unlock milestones.</div>}</div></div>
  <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between"><div><div className="section-kicker">EXERCISE HISTORY</div><p className="mt-1 text-[10px] text-zinc-600">Tap a movement to inspect recent performance.</p></div><span className="text-[9px] text-zinc-600">{uniqueExerciseIds().length} MOVEMENTS</span></div><div className="mt-3 grid gap-2">{uniqueExerciseIds().slice(0,12).map(id=><button key={id} onClick={()=>setSelected(id)} className="history-card"><div><b>{exerciseNameFor(id)}</b><span>{exerciseCategoryFor(id)}</span></div><span>{latestCompact(id)}</span></button>)}{!logs.length&&<p className="mt-3 text-xs text-muted">No sessions yet.</p>}</div></div>
  <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">RECENT SESSIONS</div>{ss.slice(0,8).map(s=><div key={s.id} className="history-row"><span>{new Date(s.date).toLocaleDateString()}</span><strong>{s.day} · {Math.round(s.durationSec/60)}m</strong><span>{s.totalReps} reps</span></div>)}{!ss.length&&<p className="mt-3 text-xs text-muted">No sessions yet.</p>}</div>
  {selected&&<ExerciseHistoryModal id={selected} onClose={()=>setSelected(null)}/>}
 </div>
}
function buildPrVault(){
 const logs=getLogs().filter(l=>l.status!=="skipped"),out:any[]=[];
 const push=(id:string,category:string,kind:"static"|"reps"|"emom")=>{const rows=logs.filter(l=>l.exerciseId===id);let best:number|undefined,date=0,context="";rows.forEach(l=>{const vals=kind==="static"?(l.result.seconds||[]):kind==="reps"?(l.result.reps||[]):(l.result.emom||[]);const v=kind==="static"?Math.max(...vals,0):kind==="emom"?vals.reduce((a,b)=>a+b,0):Math.max(...vals,0);if(v>(best??-1)){best=v;date=l.date;context=kind==="emom"?`${vals.length} minutes`:`${vals.length} sets`}});if(best!==undefined&&best>0)out.push({id,category,name:exerciseNameFor(id),value:`${best}${kind==="static"?"s":" reps"}`,date,context});};
 push("touch","SKILL","static"); push("flpu","SKILL","reps"); push("oap","SKILL","reps"); push("dips","WORK CAPACITY","emom"); push("pullup","WORK CAPACITY","emom"); push("close-chin","WORK CAPACITY","emom");
 return out;
}
function buildMilestones(){
 const out:any[]=[]; const touch=trendValues("touch","static"); if(touch.length) {const best=Math.max(...touch),target=8;out.push({id:"touch",status:best>=target?"TARGET REACHED":"BUILDING",name:"Front Touch",progress:`${best.toFixed(1)} / ${target}s`,detail:best>=target?"Minimum target reached. Next step is to consolidate clean 8s holds before progressing.":`You are ${(target-best).toFixed(1)}s away from the 8s target.`});}
 const pLogs=getLogs().filter(l=>l.exerciseId==="pike"&&l.status==="complete"); if(pLogs.length){const last=pLogs[pLogs.length-1],vals=last.result.reps||[],best=vals.length?Math.min(...vals):0;out.push({id:"pike",status:meetsCurrentProgression("pike",last)?"PROGRESSION READY":"BUILDING",name:"Pike Push-up",progress:`${vals.join(" / ")}`,detail:meetsCurrentProgression("pike",last)?"Current session meets the programmed performance criterion.":"Keep building until all prescribed sets meet the target."});}
 return out;
}
function uniqueExerciseIds(){return [...new Set(getLogs().filter(l=>l.status!=="skipped").map(l=>l.exerciseId))];}
function exerciseNameFor(id:string){const found=getLogs().filter(l=>l.exerciseId===id).sort((a,b)=>b.date-a.date)[0];return found?.exerciseName||id;}
function exerciseCategoryFor(id:string){const found=getLogs().filter(l=>l.exerciseId===id).sort((a,b)=>b.date-a.date)[0];return found?LABEL[found.kind]:"MOVEMENT";}
function latestCompact(id:string){const l=getLogs().filter(x=>x.exerciseId===id&&x.status!=="skipped").sort((a,b)=>b.date-a.date)[0];if(!l)return "—";if(l.kind==="EMOM")return `${(l.result.emom||[]).reduce((a,b)=>a+b,0)} reps`;if(l.result.seconds?.length)return `${Math.max(...l.result.seconds).toFixed(1)}s`;return `${(l.result.reps||[]).join("/")}`;}
function ExerciseHistoryModal({id,onClose}:{id:string;onClose:()=>void}){const rows=getLogs().filter(l=>l.exerciseId===id&&l.status!=="skipped").sort((a,b)=>b.date-a.date).slice(0,12);return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur"><div className="mx-auto max-w-2xl px-4 py-8 pb-28"><div className="flex items-start justify-between gap-3"><div><div className="eyebrow">EXERCISE HISTORY</div><h2 className="mt-2 text-3xl font-extrabold">{exerciseNameFor(id)}</h2><p className="sub">Most recent performance, target context, and how the movement is moving.</p></div><button className="secondary-cta" onClick={onClose}>CLOSE</button></div><div className="mt-5 grid gap-2">{rows.map(l=><div key={l.id} className="rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><span className="field-label">{new Date(l.date).toLocaleDateString()}</span><span className="text-[9px] text-zinc-600">{l.status.toUpperCase()}</span></div><div className="mt-2 text-sm font-bold">{l.kind==="EMOM"?`EMOM ${(l.result.emom||[]).join(" / ")}`:l.result.seconds?.length?`HOLD ${(l.result.seconds||[]).map(x=>x.toFixed(1)).join(" / ")}s`:`SETS ${(l.result.reps||[]).join(" / ")}`}</div><div className="mt-2 text-[9px] text-zinc-600">{l.result.band&&l.result.band!=="None"?`LOOP ${l.result.band} · `:""}{l.result.rir!==undefined?`RIR ${l.result.rir} · `:""}{l.result.fatigue!==undefined?`FATIGUE ${l.result.fatigue}/5`:""}{l.result.note?` · ${l.result.note}`:""}</div></div>)}{!rows.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">No history for this movement.</div>}</div></div></div>}
function bestStatic(id:string){const vals=getLogs().filter(l=>l.exerciseId===id).flatMap(l=>l.result.seconds||[]);return vals.length?`${Math.max(...vals).toFixed(1)}s`:"—"}
function bestReps(id:string){const vals=getLogs().filter(l=>l.exerciseId===id).flatMap(l=>l.result.reps||[]);return vals.length?`${Math.max(...vals)} reps`:"—"}
function SmallMetric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-line bg-panel p-4"><span className="text-[9px] text-zinc-600">{label}</span><b className="mt-2 block text-sm">{value}</b></div>}
function Metric({label,value}:{label:string;value:number|string}){return <div className="rounded-2xl border border-line bg-panel p-4"><span className="text-[9px] text-zinc-600">{label}</span><b className="mt-2 block text-2xl">{value}</b></div>}


function goalLogs(goal:"push-up"|"dips"){
 const logs=getLogs().filter(l=>l.status==="complete"&&l.kind==="PERFORMANCE");
 if(goal==="push-up") return logs.filter(l=>/(^|\s)Push-up(\s|$)|Push-up Long Set/.test(l.exerciseName) && !/Pike|Diamond|Close-Grip|Archer|Pseudo/.test(l.exerciseName));
 return logs.filter(l=>l.exerciseName==="Dips"||l.exerciseName==="Dips Long Set");
}
function goalTrend(goal:"push-up"|"dips"){
 return goalLogs(goal).sort((a,b)=>a.date-b.date).map(l=>Math.max(...(l.result.reps||[0])));
}
function GoalProgressCard({goal,target,label}:{goal:"push-up"|"dips";target:number;label:string}){
 const vals=goalTrend(goal),best=vals.length?Math.max(...vals):0,last=vals.slice(-3),prev=vals.slice(-6,-3);
 const lastAvg=last.length?last.reduce((a,b)=>a+b,0)/last.length:0;
 const prevAvg=prev.length?prev.reduce((a,b)=>a+b,0)/prev.length:0;
 const delta=prev.length&&prevAvg?((lastAvg-prevAvg)/prevAvg)*100:null;
 const pct=Math.min(100,(best/target)*100);
 const status=best>=target?"TARGET REACHED":delta!==null&&delta>3?"PROGRESSING":delta!==null&&delta<-8?"CHECK FATIGUE":"BUILDING";
 return <div className="rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-start justify-between gap-3"><div><div className="field-label">{label}</div><div className="mt-1 text-2xl font-extrabold">{best||"—"} <span className="text-xs font-bold text-zinc-600">/ {target}</span></div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${status==="TARGET REACHED"?"text-emerald-400":status==="PROGRESSING"?"text-violet2":status==="CHECK FATIGUE"?"text-amber-300":"text-zinc-500"}`}>{status}</span></div>
   <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width:`${pct}%`}}/></div>
   <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]"><div><span className="field-label">BEST</span><b className="mt-1 block text-white">{best||"—"}</b></div><div><span className="field-label">LAST</span><b className="mt-1 block text-white">{last.length?last[last.length-1]:"—"}</b></div><div><span className="field-label">TREND</span><b className="mt-1 block text-white">{delta===null?"—":`${delta>=0?"+":""}${delta.toFixed(0)}%`}</b></div></div>
   <p className="mt-3 text-[9px] leading-4 text-zinc-600">{best>=target?"Goal reached. Maintain it periodically while keeping most training submaximal.":status==="CHECK FATIGUE"?"Recent performance is down versus the preceding exposures. Do not add volume until recovery and technique are back on track.":"Use the long-set day to move the best set upward gradually; use EMOM/volume days to build capacity without testing max every session."}</p>
 </div>
}
function PushGoalDashboard(){
 return <div className="mt-6 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
   <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">COACH GOALS</div><p className="mt-1 text-[9px] text-zinc-500">The two outcomes currently driving the Push program.</p></div><span className="tag">100 / 50</span></div>
   <div className="mt-3 grid gap-2 md:grid-cols-2"><GoalProgressCard goal="push-up" target={100} label="STANDARD PUSH-UP · BEST SINGLE SET"/><GoalProgressCard goal="dips" target={50} label="DIPS · BEST SINGLE SET"/></div>
 </div>
}

function WeeklyReview({sessions}:{sessions:SessionSummary[]}){
 const reps=sessions.reduce((a,b)=>a+b.totalReps,0),emom=sessions.reduce((a,b)=>a+b.emomReps,0),duration=sessions.reduce((a,b)=>a+b.durationSec,0); const fatigue=sessions.flatMap(s=>s.logs.map(l=>Number(l.result.fatigue))).filter(Number.isFinite); const avgFat=fatigue.length?fatigue.reduce((a,b)=>a+b,0)/fatigue.length:null; const readiness=sessions.map(s=>readinessStatus(s.readiness||{}).label); const ready=readiness.filter(x=>x==="READY").length;
 return <section className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">WEEKLY REVIEW</div><p className="mt-1 text-[9px] text-zinc-600">The smallest set of signals that tells you whether the week is trending well.</p></div><span className="tag">{sessions.length}/6 SESSIONS</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="TIME" value={formatClock(duration) as any}/><Metric label="REPS" value={reps}/><Metric label="EMOM" value={emom}/><Metric label="READY DAYS" value={ready}/></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">FATIGUE</span><div className="mt-1 text-sm font-extrabold">{avgFat!==null?`${avgFat.toFixed(1)} / 5`:`—`}</div><p className="mt-1 text-[8px] text-zinc-600">Average logged fatigue across the week.</p></div><div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">COACH TAKEAWAY</span><div className="mt-1 text-sm font-extrabold">{sessions.length>=4&&avgFat!==null&&avgFat<3.5?"Stable training week":"Build evidence before adding more volume."}</div><p className="mt-1 text-[8px] text-zinc-600">Use progression proposals, not emotion, to edit the plan.</p></div></div></section>
}
function Reports({refresh}:{refresh:number}){
 const [offset,setOffset]=useState(0),[copied,setCopied]=useState(false),[selected,setSelected]=useState<string|null>(null),[showWeekly,setShowWeekly]=useState(false);
 const sessions=getSessions().sort((a,b)=>b.date-a.date),weekStart=Date.now()-7*86400000,weekSessions=sessions.filter(s=>s.date>=weekStart),weekReps=weekSessions.reduce((a,s)=>a+s.totalReps,0),weekEmom=weekSessions.reduce((a,s)=>a+s.emomReps,0),best=weekSessions.reduce((m,s)=>Math.max(m,s.bestSkillSeconds),0),report=makeWeeklyReport(offset);
 const copy=async()=>{try{await navigator.clipboard.writeText(report);setCopied(true);setTimeout(()=>setCopied(false),1200)}catch{}};
 return <div>
  <div className="eyebrow">PROGRESS</div><h1>Reports</h1>
  <PushGoalDashboard/>
  <div className="mt-5 grid grid-cols-3 gap-2"><Metric label="WORKOUTS" value={weekSessions.length}/><Metric label="REPS" value={weekReps}/><Metric label="EMOM" value={weekEmom}/></div>
  <div className="mt-2 rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><div><div className="field-label">BEST STATIC</div><div className="mt-1 text-xl font-extrabold">{best?`${best.toFixed(1)}s`:"—"}</div></div><div className="text-right"><div className="field-label">CURRENT WEEK</div><div className="mt-1 text-sm font-bold">{weekSessions.length} sessions</div></div></div></div>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">RECENT COMPLETED WORKOUTS</div><p className="mt-1 text-[9px] text-zinc-600">Open any session to review the full execution and coach report.</p></div><span className="tag">LAST {Math.min(7,sessions.length)}</span></div>
   <div className="mt-3 grid gap-2">{sessions.slice(0,7).map(s=><button key={s.id} onClick={()=>setSelected(s.id)} className={`history-card text-left ${selected===s.id?"selected":""}`}><div><b>{s.day}</b><span>{new Date(s.date).toLocaleDateString()}</span></div><span className="tabular-nums">{formatClock(s.durationSec)} · {s.totalReps} reps · {s.emomReps} EMOM</span></button>)}{!sessions.length&&<p className="mt-3 text-xs text-zinc-600">No completed sessions yet.</p>}</div>
  </div>
  <WeeklyReview sessions={weekSessions}/>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">TRAINING TIMELINE</div><div className="mt-3 grid gap-2">{sessions.slice(0,12).map(s=><div key={s.id} className="history-row"><span>{new Date(s.date).toLocaleDateString()}</span><strong>{s.day}</strong><span>{formatClock(s.durationSec)} · {s.totalReps} reps</span></div>)}{!sessions.length&&<p className="text-xs text-zinc-600">No timeline yet.</p>}</div></div>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between gap-3"><div><div className="section-kicker">COACH EXPORT</div><div className="mt-1 text-[9px] text-zinc-600">Weekly report for your coach.</div></div><button className="secondary-cta !py-2" onClick={()=>setShowWeekly(v=>!v)}>{showWeekly?"HIDE":"VIEW"}</button></div>{showWeekly&&<><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{[0,1,2,3,4].map(n=><button key={n} onClick={()=>setOffset(n)} className={`rounded-lg border px-3 py-2 text-[9px] font-bold whitespace-nowrap ${offset===n?"border-violet-500/40 bg-violet-500/10 text-violet2":"border-line bg-panel2 text-zinc-600"}`}>{n===0?"THIS WEEK":`WEEK -${n}`}</button>)}</div><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-panel2 p-3 font-sans text-[9px] leading-5 text-zinc-400">{report}</pre><div className="mt-3 grid grid-cols-2 gap-2"><button className="primary-cta" onClick={copy}>{copied?"COPIED":"COPY"}</button><button className="secondary-cta" onClick={()=>download(report,`weekly-coach-report-${offset}.txt`)}><Download size={14}/>EXPORT</button></div></>}</div>
  {selected&&<SessionDetail session={sessions.find(s=>s.id===selected)!} onClose={()=>setSelected(null)}/>}<CoachLinkCard onLinked={()=>{}}/><AthleteProfileEditor/><DataBackup/>
 </div>
}
function SessionDetail({session,onClose}:{session:SessionSummary;onClose:()=>void}){
 const [note,setNote]=useState(session.sessionNote||""); const report=makeSessionReport({...session,sessionNote:note});
 const save=()=>{const next={...session,sessionNote:note};replaceSession(next);onClose()};
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur"><div className="mx-auto max-w-2xl px-4 py-8"><div className="flex justify-between"><div><div className="eyebrow">COMPLETED SESSION</div><h2 className="mt-2 text-3xl font-extrabold">{session.day}</h2><p className="mt-1 text-[10px] text-zinc-600">{new Date(session.date).toLocaleString()}</p></div><button className="secondary-cta" onClick={onClose}>CLOSE</button></div><div className="mt-5 grid grid-cols-3 gap-2"><Metric label="TIME" value={formatClock(session.durationSec)}/><Metric label="REPS" value={session.totalReps}/><Metric label="EMOM" value={session.emomReps}/></div><div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">SESSION REPORT</div><pre className="mt-3 whitespace-pre-wrap font-sans text-[10px] leading-5 text-zinc-300">{report}</pre></div><div className="mt-4"><span className="field-label">SESSION NOTE</span><textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-1 min-h-[100px] w-full rounded-xl border border-line bg-panel2 p-3 text-xs" placeholder="Anything worth telling coach?"/></div><button className="primary-cta mt-3 w-full" onClick={save}>SAVE CHANGES</button></div></div>
}

function AthleteProfileEditor(){
 const defaults:AthleteCoachingProfile={athlete_id:"local",primaryGoal:"",secondaryGoals:[],prioritySkills:[],targetDate:"",notes:"",schedule_days:6,equipment:["Pull-up bar","Dip bars","Loop bands","Parallettes"],preferences:{}};
 const [profile,setProfile]=useState<AthleteCoachingProfile>(()=>getLocalAthleteProfile()||defaults);
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[editing,setEditing]=useState(false);
 useEffect(()=>{if(supabaseConfigured)fetchMyCoachingProfile().then(p=>{if(p){setProfile(p);saveLocalAthleteProfile(p)}}).catch(()=>{})},[]);
 const save=async()=>{setBusy(true);setMsg("");try{const payload={...profile,secondaryGoals:profile.secondaryGoals||[],prioritySkills:profile.prioritySkills||[],equipment:profile.equipment||[]};if(supabaseConfigured){const saved=await saveMyCoachingProfile(payload);setProfile(saved);saveLocalAthleteProfile(saved)}else saveLocalAthleteProfile(payload);setEditing(false);setMsg("PROFILE SAVED");}catch(e:any){setMsg(e?.message||"PROFILE SAVE FAILED")}finally{setBusy(false)}};
 const sessions=getSessions().slice().sort((a,b)=>b.date-a.date);
 const latest=sessions[0];
 const cutoff14=Date.now()-14*86400000;
 const last14=sessions.filter(s=>s.date>=cutoff14);
 const currentWeight=latest?.readiness?.weightKg;
 const recentPain=latest?Math.max(latest.readiness?.wristPain||0,latest.readiness?.elbowPain||0):undefined;
 const bestStatic=(()=>{const vals=getLogs().flatMap(l=>l.result.seconds||[]);return vals.length?Math.max(...vals):undefined})();
 const bestRepSet=(()=>{const vals=getLogs().flatMap(l=>l.result.reps||[]);return vals.length?Math.max(...vals):undefined})();
 const lastDecision=getCoachDecisions().slice().sort((a,b)=>b.date-a.date)[0];
 const target=profile.targetDate?new Date(profile.targetDate+"T12:00:00").toLocaleDateString():"No deadline set";
 return <div className="mt-8 rounded-2xl border border-line bg-panel p-4">
  <div className="flex items-start justify-between gap-3"><div><div className="section-kicker">ATHLETE SNAPSHOT</div><p className="mt-1 max-w-xl text-[9px] leading-4 text-zinc-600">Your actual training context — goals, current state, setup and recent performance. Edit only when something changes.</p></div><button className="secondary-cta !py-2" onClick={()=>setEditing(v=>!v)}>{editing?"CLOSE":"EDIT"}</button></div>

  <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
   <div className="field-label">CURRENT FOCUS</div>
   <div className="mt-1 text-xl font-extrabold">{profile.primaryGoal||"Performance development"}</div>
   <div className="mt-1 text-[9px] text-zinc-500">Target: {target}</div>
   <div className="mt-3 flex flex-wrap gap-2">{(profile.prioritySkills||[]).slice(0,6).map(x=><span key={x} className="chip">{x}</span>)}{!(profile.prioritySkills||[]).length&&<span className="text-[9px] text-zinc-600">No priority skills set</span>}</div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">TRAINING RHYTHM</span><div className="mt-1 text-lg font-extrabold">{profile.schedule_days??6} days / week</div><div className="mt-1 text-[8px] text-zinc-600">{last14.length} completed in the last 14 days</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">CURRENT WEIGHT</span><div className="mt-1 text-lg font-extrabold">{typeof currentWeight==="number"?`${currentWeight.toFixed(1)} kg`:"—"}</div><div className="mt-1 text-[8px] text-zinc-600">Latest readiness check-in</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">RECENT STATUS</span><div className="mt-1 text-sm font-extrabold">{latest?.readiness?.sleepHours?`${latest.readiness.sleepHours.toFixed(1)}h sleep`:`No readiness`}</div><div className="mt-1 text-[8px] text-zinc-600">Energy {latest?.readiness?.energy??"—"}/5 · Pain {recentPain??"—"}/5</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">PERFORMANCE SNAPSHOT</span><div className="mt-1 text-sm font-extrabold">{bestStatic!==undefined?`Best hold ${bestStatic.toFixed(1)}s`:`Best reps ${bestRepSet??"—"}`}</div><div className="mt-1 text-[8px] text-zinc-600">Across logged sessions</div></div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">TRAINING SETUP</span><div className="mt-2 flex flex-wrap gap-2">{(profile.equipment||[]).map(x=><span key={x} className="chip">{x}</span>)}{!(profile.equipment||[]).length&&<span className="text-[9px] text-zinc-600">No equipment set</span>}</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">LAST COACH SIGNAL</span><div className="mt-1 text-[10px] font-bold">{lastDecision?.title||"No coaching decision recorded yet"}</div><div className="mt-1 text-[8px] leading-4 text-zinc-600">{lastDecision?.detail||"Complete a few sessions and the coach loop will have more context."}</div></div>
  </div>

  {profile.notes&&<div className="mt-3 rounded-xl border border-violet-500/10 bg-violet-500/5 p-3"><span className="field-label">COACH CONTEXT</span><div className="mt-1 text-[9px] leading-4 text-zinc-400">{profile.notes}</div></div>}

  {editing&&<div className="mt-4 border-t border-line pt-4"><div className="section-kicker">EDIT COACHING CONTEXT</div><div className="mt-3 grid gap-2 md:grid-cols-2">
   <label><span className="field-label">PRIMARY GOAL</span><input value={profile.primaryGoal||""} onChange={e=>setProfile({...profile,primaryGoal:e.target.value})} placeholder="Full Front Lever"/></label>
   <label><span className="field-label">TARGET DATE</span><input type="date" value={profile.targetDate||""} onChange={e=>setProfile({...profile,targetDate:e.target.value})}/></label>
   <label><span className="field-label">PRIORITY SKILLS</span><input value={(profile.prioritySkills||[]).join(", ")} onChange={e=>setProfile({...profile,prioritySkills:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="OAP, Front Lever, Planche"/></label>
   <label><span className="field-label">SECONDARY GOALS</span><input value={(profile.secondaryGoals||[]).join(", ")} onChange={e=>setProfile({...profile,secondaryGoals:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Strength, endurance"/></label>
   <label><span className="field-label">TRAINING DAYS</span><input inputMode="numeric" value={String(profile.schedule_days??6)} onChange={e=>setProfile({...profile,schedule_days:Math.max(1,Math.min(7,Number(e.target.value)||0))})}/></label>
   <label><span className="field-label">EQUIPMENT</span><input value={(profile.equipment||[]).join(", ")} onChange={e=>setProfile({...profile,equipment:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Pull-up bar, Dip bars, Loop bands"/></label>
   <label className="md:col-span-2"><span className="field-label">COACH CONTEXT</span><textarea value={profile.notes||""} onChange={e=>setProfile({...profile,notes:e.target.value})} className="min-h-20 w-full" placeholder="Important constraints, preferences, recurring limitations, anything your coach should remember..."/></label>
  </div><div className="mt-3 flex items-center justify-between"><span className="text-[9px] text-zinc-600">{msg}</span><button className="primary-cta" disabled={busy} onClick={save}>{busy?"SAVING…":"SAVE PROFILE"}</button></div></div>}
 </div>
}

function DataBackup(){
 const [msg,setMsg]=useState("");
 const backup=()=>download(exportBackup(),`calisthenics-coach-backup-${new Date().toISOString().slice(0,10)}.json`);
 const restore=(file:File)=>{const fr=new FileReader();fr.onload=()=>{try{importBackup(String(fr.result));setMsg("RESTORED — reload the app to apply.");}catch(e){setMsg("Invalid backup file.")}};fr.readAsText(file)};
 const syncNow=async()=>{setMsg("SYNCING…");try{const r=await syncLocalSessions(getSessions());setMsg(`SYNCED · ${r.uploaded} uploaded · ${r.pulled} pulled · ${r.remote} remote sessions`)}catch(e:any){setMsg(e?.message||"SYNC FAILED")}};
 return <div className="mt-8 border-t border-line pt-6"><div className="section-kicker">DATA</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><button className="secondary-cta" onClick={backup}><Download size={14}/>EXPORT BACKUP</button><label className="secondary-cta cursor-pointer"><Upload size={14}/>IMPORT BACKUP<input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0]&&restore(e.target.files[0])}/></label>{supabaseConfigured&&<button className="secondary-cta" onClick={syncNow}><RefreshCw size={14}/>SYNC NOW</button>}</div>{msg&&<p className="mt-2 text-[10px] text-zinc-500">{msg}</p>}</div>
}


function exerciseCatalogForUi(block:ExerciseBlock){return EXERCISE_CATALOG.find(x=>x.id===String(block.catalogExerciseId||block.id).split("__")[0])||EXERCISE_CATALOG.find(x=>x.name===block.name);}
function ExercisePurpose({block,catalog}:{block:ExerciseBlock;catalog?:ExerciseCatalogItem}){const goal=catalog?.skill||catalog?.category||LABEL[block.kind];const next=catalog?.difficulty?`Difficulty ${catalog.difficulty}/5`:"";return <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">WHY THIS EXERCISE</div><div className="mt-1 text-sm font-extrabold">{goal}</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">{catalog?.detail||block.detail}</p><div className="mt-2 flex flex-wrap gap-2 text-[8px] font-bold tracking-[.1em] text-violet2"><span>{next}</span><span>{block.target}</span><span>{block.rest}s REST</span></div></div>}


function ReadinessGate({readiness,onSave,onSkip}:{readiness:Readiness;onSave:(r:Readiness)=>void;onSkip:()=>void}){
 const [energy,setEnergy]=useState(readiness.energy?String(readiness.energy):""); const [sleep,setSleep]=useState(readiness.sleepHours?String(readiness.sleepHours):""); const [pain,setPain]=useState(Math.max(readiness.wristPain||0,readiness.elbowPain||0)?String(Math.max(readiness.wristPain||0,readiness.elbowPain||0)):"0"); const [weight,setWeight]=useState(readiness.weightKg?String(readiness.weightKg):"");
 const status=readinessStatus({energy:energy?Number(energy):undefined,sleepHours:sleep?sleep?Number(sleep):undefined:undefined,wristPain:pain?Number(pain):0,elbowPain:0,weightKg:weight?Number(weight):undefined});
 const save=()=>onSave({energy:energy?Number(energy):undefined,sleepHours:sleep?Number(sleep):undefined,wristPain:pain?Number(pain):0,elbowPain:0,weightKg:weight?Number(weight):undefined});
 return <div className="flex flex-1 items-center justify-center py-8"><div className="w-full max-w-lg rounded-3xl border border-line bg-panel p-5"><div className="eyebrow">READINESS CHECK-IN</div><h2 className="mt-2 text-3xl font-extrabold">Before you train</h2><p className="mt-2 text-xs leading-5 text-zinc-500">A 10-second check-in gives the Coach context. It never changes the plan automatically.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label><span className="field-label">ENERGY</span><select value={energy} onChange={e=>setEnergy(e.target.value)}><option value="">—</option>{[1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label><label><span className="field-label">SLEEP (H)</span><input inputMode="decimal" value={sleep} onChange={e=>setSleep(e.target.value)} placeholder="7.5"/></label><label><span className="field-label">PAIN</span><select value={pain} onChange={e=>setPain(e.target.value)}>{[0,1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label><label><span className="field-label">BODYWEIGHT</span><input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="80"/></label></div><div className="mt-4 rounded-2xl border border-line bg-panel2 p-4"><div className="flex items-center justify-between"><span className="field-label">TODAY</span><strong className={status.tone}>{status.label}</strong></div><p className="mt-2 text-[10px] leading-5 text-zinc-500">{status.detail}</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={onSkip}>SKIP</button><button className="primary-cta" onClick={save}>START SESSION</button></div></div></div>
}
function WorkoutPlayer({state,setState,refresh}:{state:any;setState:(x:any)=>void;refresh:()=>void}){
 useWakeLock(true);
 const [active,setActive]=useState(state),[showReadiness,setShowReadiness]=useState(!state.readiness||Object.keys(state.readiness||{}).length===0),[final,setFinal]=useState<SessionSummary|null>(null),[sound,setSound]=useState(getSetting("sound",true)),[vibration,setVibration]=useState(getSetting("vibration",true)),[exitAsk,setExitAsk]=useState(false),[skipAsk,setSkipAsk]=useState(false),[exerciseStarted,setExerciseStarted]=useState(false),[coachLinked,setCoachLinked]=useState(false),[transitionNext,setTransitionNext]=useState<number|null>(null),[sessionElapsed,setSessionElapsed]=useState(()=>Math.max(0,Math.floor((Date.now()-state.started)/1000)));
 useEffect(()=>{fetchMyCoach().then(c=>setCoachLinked(Boolean(c))).catch(()=>setCoachLinked(false))},[]);
 const advanceLock=useRef(false);
 useEffect(()=>setExerciseStarted(false),[active.index,transitionNext]);
 useEffect(()=>{saveDraft(active)},[active]);
 useEffect(()=>{
   const tick=()=>setSessionElapsed(Math.max(0,Math.floor((Date.now()-active.started)/1000)));
   tick();
   const id=window.setInterval(tick,1000);
   return()=>window.clearInterval(id);
 },[active.started]);
 const ep=effectiveProgram(active.day as DayKey),block:ExerciseBlock|undefined=active.index>=0?ep.blocks[active.index]:undefined,total=ep.blocks.length;
 const next=(l:WorkoutLog)=>{
   if(advanceLock.current)return;
   advanceLock.current=true;
   const logs=[...active.logs.filter((x:WorkoutLog)=>x.exerciseId!==l.exerciseId),l];
   if(active.index===total-1){
     appendLogs(logs);const s=buildSession(active,logs);saveSession(s);clearDraft();setFinal(s);
     uploadWorkoutSession(s).catch(err=>console.warn("Cloud sync failed; local session preserved.",err));
   }else{
     const nextIndex=active.index+1;
     setActive((a:any)=>({...a,index:nextIndex,logs}));
     setTransitionNext(nextIndex);
   }
   window.setTimeout(()=>{advanceLock.current=false},300);
 };
 const finishTransition=()=>{
   if(transitionNext===null)return;
   const nextIndex=transitionNext;
   setTransitionNext(null);
   setActive((a:any)=>({...a,index:nextIndex}));
 };
 const confirmSkip=()=>{if(!block)return;setSkipAsk(false);next({id:crypto.randomUUID(),date:Date.now(),day:active.day,exerciseId:block.id,exerciseName:block.name,kind:block.kind,status:"skipped",result:{note:"Skipped"}})};
 const back=()=>{if(transitionNext!==null){const previous=Math.max(-1,transitionNext-1);setTransitionNext(null);setActive((a:any)=>({...a,index:previous}));return}setActive((a:any)=>({...a,index:Math.max(-1,a.index-1)}))};
 const tick=()=>{if(vibration)beep()};
 if(final)return <Summary session={final} close={()=>setState(null)} onSave={s=>setFinal(s)}/>;
 if(showReadiness&&active.index<0)return <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-ink text-white"><div className="mx-auto flex w-full max-w-4xl flex-1 px-4"><ReadinessGate readiness={active.readiness||{}} onSave={r=>{setActive((a:any)=>({...a,readiness:r}));setShowReadiness(false);}} onSkip={()=>setShowReadiness(false)}/></div></div>;
 const progress=active.index<0?0:Math.min(100,((active.index+1)/total)*100);
 return <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-ink text-white">
  <div className="shrink-0 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
   <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
    <button className="flex min-h-10 min-w-10 items-center justify-start text-zinc-400" onClick={back} aria-label="Go back"><ArrowLeft size={18}/></button>
    <div className="flex items-center gap-3 text-center">
      <div className="text-[11px] font-bold tabular-nums tracking-[.04em] text-zinc-300" aria-label={`Session time ${formatClock(sessionElapsed)}`}>{formatClock(sessionElapsed)}</div>
      <div className="hidden text-[7px] font-bold tracking-[.16em] text-zinc-700 sm:block">SESSION</div>
      <div className="text-[9px] tracking-[.14em] text-zinc-600">{active.index<0?"WARM-UP":transitionNext!==null?"RECOVERY":`${active.index+1}/${total}`}</div>
    </div>
    <div className="flex items-center gap-2"><button className="flex min-h-10 items-center gap-1 text-[8px] font-bold tracking-[.08em] text-zinc-600" onClick={()=>{setSound(v=>{setSetting("sound",!v);return !v});initAudio()}} aria-label={sound?"Mute sounds":"Enable sounds"}>{sound?<Volume2 size={13}/>:<VolumeX size={13}/>}</button><button className="text-[8px] font-bold tracking-[.08em] text-zinc-600" onClick={()=>{setVibration(v=>{setSetting("vibration",!v);return !v})}}>{vibration?"HAPTIC":"SILENT"}</button><button className="min-h-10 min-w-10 text-right text-[9px] font-bold tracking-[.1em] text-zinc-500" onClick={()=>setExitAsk(true)}>EXIT</button></div>
   </div><div className="h-0.5 bg-zinc-900"><div className="h-full bg-violet-500 transition-all" style={{width:`${progress}%`}}/></div>
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-6 pb-28 sm:py-7 sm:pb-32">
   {active.index<0?<WarmupPlayer steps={ep.warmup} sound={sound} vibration={vibration} onDone={()=>setActive((a:any)=>({...a,index:0}))}/>:transitionNext!==null?<TransitionRecovery seconds={180} sound={sound} vibration={vibration} nextLabel={ep.blocks[transitionNext]?.name||"next exercise"} onDone={finishTransition}/>:<><div className="tag">{LABEL[block!.kind]}</div><h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">{currentVariantFor(block!.id,block!.name)}</h2><BlockPlayer key={block!.id} block={block!} day={active.day} vibration={vibration} sound={sound} existing={active.logs.find((x:WorkoutLog)=>x.exerciseId===block!.id)} onComplete={next} onTick={tick} onStarted={()=>setExerciseStarted(true)} onProgress={(partial)=>setActive((a:any)=>({...a,logs:[...a.logs.filter((x:WorkoutLog)=>x.exerciseId!==block!.id),partial]}))}/></>}
  </div></div>
  {active.index>=0&&transitionNext===null&&!exerciseStarted&&<div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+12px)]"><div className="mx-auto flex max-w-4xl justify-center px-4"><button onClick={()=>setSkipAsk(true)} className="pointer-events-auto rounded-full border border-line bg-ink/95 px-4 py-2 text-[9px] font-bold tracking-[.12em] text-zinc-500 shadow-xl backdrop-blur-xl">SKIP EXERCISE</button></div></div>}
  {exitAsk&&<div className="fixed inset-0 z-[70] flex items-end bg-black/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"><div className="mx-auto w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5"><div className="eyebrow">LEAVE WORKOUT?</div><h2 className="mt-2 text-2xl font-extrabold">This session is unfinished.</h2><p className="mt-2 text-xs text-muted">Resume it later, keep training, or discard the draft.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><button className="secondary-cta" onClick={()=>setExitAsk(false)}>KEEP TRAINING</button><button className="secondary-cta" onClick={()=>{saveDraft(active);setState(null)}}>SAVE DRAFT & EXIT</button><button className="danger-cta" onClick={()=>{clearDraft();setState(null)}}>DISCARD</button></div></div></div>}
  {skipAsk&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5"><div className="eyebrow">SKIP</div><h2 className="mt-2 text-xl font-extrabold">Skip this exercise?</h2><p className="mt-2 text-xs text-muted">It will be recorded as skipped and the workout will continue after the 3-minute transition recovery.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setSkipAsk(false)}>CANCEL</button><button className="primary-cta" onClick={confirmSkip}>SKIP</button></div></div></div>}
 </div>
}

function TransitionRecovery({seconds,nextLabel,onDone,sound=true,vibration=true}:{seconds:number;nextLabel:string;onDone:()=>void;sound?:boolean;vibration?:boolean}){
 return <Rest seconds={seconds} sound={sound} vibration={vibration} label="TRANSITION RECOVERY" nextLabel={nextLabel} onSkip={onDone} onDone={onDone}/>;
}

function buildSession(a:any,logs:WorkoutLog[]):SessionSummary{
 return{id:String(a.started),date:Date.now(),day:a.day,durationSec:Math.round((Date.now()-a.started)/1000),readiness:a.readiness,logs,totalReps:logs.reduce((s,l)=>s+(l.result.reps?.reduce((x,y)=>x+y,0)||0),0),emomReps:logs.reduce((s,l)=>s+(l.result.emom?.reduce((x,y)=>x+y,0)||0),0),bestSkillSeconds:logs.filter((l:WorkoutLog)=>l.kind==="SKILL_STATIC").reduce((m,l)=>Math.max(m,Math.max(...(l.result.seconds||[0]))),0)};
}

function meetsCurrentProgression(blockId:string, log:WorkoutLog):boolean{
  if(log.status!=="complete") return false;
  const reps=log.result.reps||[];
  const emom=log.result.emom||[];
  const rir=log.result.rir;
  const total=emom.reduce((a,b)=>a+b,0);
  const drop=emom.length?emomStats(emom).drop:100;
  switch(blockId){
    case "pike": return reps.length>=3 && reps.slice(0,3).every(x=>x>=10) && (rir===undefined || rir>=1);
    case "diamond": return reps.length>=3 && reps.slice(0,3).every(x=>x>=15) && (rir===undefined || rir>=1);
    case "archer-push": return reps.length>=6 && reps.slice(0,6).every(x=>x>=8);
    case "archer-pull": return reps.length>=6 && reps.slice(0,6).every(x=>x>=8);
    case "oap": {
      const sides=log.result.sides||[];
      const right=reps.filter((_,i)=>sides[i]==="R").filter(x=>x>=2).length;
      const left=reps.filter((_,i)=>sides[i]==="L").filter(x=>x>=2).length;
      return reps.length>=6 && right>=2 && left>=2;
    }
    case "high-pull": return reps.length>=4 && reps.slice(0,4).every(x=>x>=5);
    
    case "oap-band": return reps.length>=6 && reps.slice(0,6).every(x=>x>=5) && (rir===undefined || rir>=1);
    case "flpu": return reps.length>=5 && reps.slice(0,5).every(x=>x>=4);
    case "flpu-band": return reps.length>=3 && reps.slice(0,3).every(x=>x>=6);
    case "touch": {
      const vals=log.result.seconds||[];
      const clean=((log.result.note||'').match(/qualities ([^;]+)/)?.[1]||'').split('/').filter(Boolean);
      return vals.length>=3 && vals.slice(0,3).every(x=>x>=8) && (!clean.length || clean.slice(0,3).every(q=>q==='Clean'));
    }
    case "touch-band": return (log.result.seconds||[]).length>=3 && (log.result.seconds||[]).slice(0,3).every(x=>x>=8);
    case "curl-a": case "curl-b": case "curl-c": return reps.length>=3 && reps.slice(0,3).every(x=>x>=30);
    case "lat-a": case "lat-b": case "lat-c": return reps.length>=3 && reps.slice(0,3).every(x=>x>=25) && (rir===undefined || rir>=1);
    case "tri-a": case "tri-b": case "tri-c": return reps.length>=3 && reps.slice(0,3).every(x=>x>=30);
    case "bulgarian": return reps.length>=4 && reps.slice(0,4).every(x=>x>=10);
    case "pistol": return reps.length>=3 && reps.slice(0,3).every(x=>x>=10);
    case "sl-rdl": return reps.length>=3 && reps.slice(0,3).every(x=>x>=12);
    case "calf": return reps.length>=3 && reps.slice(0,3).every(x=>x>=20);
    case "band-legcurl": return reps.length>=3 && reps.slice(0,3).every(x=>x>=20);
    case "jump-lunge": return reps.length>=3 && reps.slice(0,3).every(x=>x>=8);
    case "broad-jump": return reps.length>=4 && reps.slice(0,4).every(x=>x>=3);
    case "cmj": return reps.length>=4 && reps.slice(0,4).every(x=>x>=3);
    case "dips": case "deep": case "pullup": case "close-chin": case "close-pull":
      return emom.length>=10 && ((blockId==="dips" && Math.min(...emom)>=30) || (blockId==="pullup" && Math.min(...emom)>=12) || (blockId==="close-chin" && Math.min(...emom)>=10) || (blockId==="close-pull" && Math.min(...emom)>=9) || (blockId==="deep" && Math.max(...emom)>=12)) && drop<15;
    default: return false;
  }
}

function logVariantName(log:WorkoutLog){return log.variantName||log.exerciseName;}
function currentVariantLogs(block:ExerciseBlock){
  const current=currentVariantFor(block.id,block.name);
  return getLogs().filter(x=>x.exerciseId===block.id&&!x.skipped&&logVariantName(x)===current).sort((a,b)=>a.date-b.date);
}
function progressionCount(blockId:string, block:ExerciseBlock){
  const logs=currentVariantLogs(block);
  const current=logs[logs.length-1];
  const previous=logs[logs.length-2];
  const now=current?meetsCurrentProgression(blockId,current):false;
  const before=previous?meetsCurrentProgression(blockId,previous):false;
  if(now&&before)return {state:"READY",label:"READY FOR COACH REVIEW",detail:"Criterion reached in 2 consecutive sessions."};
  if(now)return {state:"1/2",label:"1/2 QUALIFYING SESSIONS",detail:"Repeat this standard once more before changing the variant."};
  return {state:"HOLD",label:"KEEP CURRENT VARIANT",detail:"Keep progressing inside the current prescription."};
}

function currentVariantFor(exerciseId:string, fallback:string){
 const o=getProgramOverride(exerciseId); if(o?.name)return o.name;
 const v=getVariant(exerciseId);
 return v?.variantName||fallback;
}
function nextLadderVariant(exerciseId:string, currentName:string){
 const key=exerciseId==="pike-feet"?"pike":exerciseId;
 const ladder=PROGRESSION_LADDERS[key];
 if(!ladder)return null;
 const idx=ladder.findIndex(x=>x.name===currentName);
 return ladder[Math.min(ladder.length-1,idx+1)]||ladder[0];
}
function PromotionPanel({block,coachLinked=false}:{block:ExerciseBlock;coachLinked?:boolean}){
 const spec=PROGRESSIONS[block.id];
 if(!spec || coachLinked)return null;
 const currentName=currentVariantFor(block.id,spec.current);
 const ladder=PROGRESSION_LADDERS[block.id];
 const currentIndex=ladder?Math.max(0,ladder.findIndex(x=>x.name===currentName)):0;
 const next=ladder?ladder[Math.min(ladder.length-1,currentIndex+1)]:{id:block.id+"-next",name:spec.next};
 const logs=currentVariantLogs(block);
 const nowOk=logs.length?meetsCurrentProgression(block.id,logs[logs.length-1]!):false;
 const prevOk=logs.length>1?meetsCurrentProgression(block.id,logs[logs.length-2]!):false;
 const ready=nowOk&&prevOk;
 const status=ready?"READY":nowOk?"1/2":"HOLD";
 const promote=()=>{
   const updatedAt=Date.now();
   setVariant(block.id,{exerciseId:block.id,variantId:next.id,variantName:next.name,step:currentIndex+1,status:"promoted",updatedAt,lastCoachAction:"promote"});
   setProgramOverride(block.id,{exerciseId:block.id,name:next.name,updatedAt});
   saveCoachDecision({type:"progression",exerciseId:block.id,title:`Progression promoted — ${next.name}`,detail:`Next session will use ${next.name}`,from:currentName,to:next.name});
   syncProgramLayer().catch(err=>console.warn("Progression sync deferred.",err));
 };
 const hold=()=>{
   setVariant(block.id,{exerciseId:block.id,variantId:currentName,variantName:currentName,step:currentIndex,status:"held",updatedAt:Date.now(),lastCoachAction:"hold"});
   saveCoachDecision({type:"progression",exerciseId:block.id,title:`Progression held — ${currentName}`,detail:"Keep the current variant for the next session.",from:currentName,to:currentName});
   syncProgramLayer().catch(err=>console.warn("Progression sync deferred.",err));
 };
 return <div className="my-3 rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-start justify-between gap-3">
     <div><span className="field-label">CURRENT VARIANT</span><div className="mt-1 text-sm font-bold">{currentName}</div></div>
     <div className={`text-right text-[9px] font-extrabold tracking-[.12em] ${status==="READY"?"text-emerald-400":status==="1/2"?"text-violet2":"text-zinc-500"}`}>{status==="READY"?"READY FOR COACH":status==="1/2"?"1/2 QUALIFYING":"BUILDING"}</div>
   </div>
   <div className="mt-4 rounded-xl border border-violet-500/10 bg-violet-500/5 p-3"><div className="field-label">NEXT VARIANT</div><div className="mt-1 text-sm font-bold text-violet2">{next.name}</div><div className="mt-2 text-[10px] text-zinc-500"><span className="font-bold text-zinc-300">PROMOTE WHEN:</span> {spec.rule}</div></div>
   {ready&&<div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={hold}>KEEP CURRENT</button><button className="primary-cta" onClick={promote}>PROMOTE</button></div>}
   {status==="1/2"&&<div className="mt-3 text-[9px] text-zinc-600">One qualifying session recorded. Repeat it once more before promoting.</div>}
 </div>
}
function defaultBandFor(block:ExerciseBlock):Band{
  if(block.defaultBand) return block.defaultBand;
  if(block.bandOptions?.includes("None") && block.bandOptions.length===1) return "None";
  return block.bandOptions?.find(b=>b!=="None") || "None";
}

function BlockPlayer({block,day,onComplete,onTick,vibration,sound,onStarted,existing,onProgress}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onTick?:()=>void;vibration:boolean;sound:boolean;onStarted:()=>void;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void}){
 if(block.kind==="SKILL_STATIC"||block.previousMode==="seconds")return <StaticSkill block={block} day={day} onComplete={onComplete} onStarted={onStarted} sound={sound} vibration={vibration} existing={existing} onProgress={onProgress}/>;
 if(block.kind==="EMOM")return <Emom block={block} day={day} onComplete={onComplete} onStarted={onStarted} sound={sound} vibration={vibration} existing={existing} onProgress={onProgress}/>;
 if(block.id==="oap"||block.id==="oap-band"||block.id==="archer-pull"||block.id==="archer-push")return <SideSetBlock block={block} day={day} onComplete={onComplete} onStarted={onStarted} sound={sound} vibration={vibration} existing={existing} onProgress={onProgress}/>;
 return <SetBlock block={block} day={day} onComplete={onComplete} onStarted={onStarted} sound={sound} vibration={vibration} existing={existing} onProgress={onProgress}/>;
}

function WarmupPlayer({steps,sound,vibration,onDone}:{steps:any[];sound:boolean;vibration:boolean;onDone:()=>void}){
 const [i,setI]=useState(0),s=steps[i],duration=s?.timerSec??0,endAtRef=useRef(Date.now()+duration*1000),now=useNow(Boolean(s?.timerSec));
 const timer=s?.timerSec?Math.max(0,Math.ceil((endAtRef.current-now)/1000)):null;
 useEffect(()=>{endAtRef.current=Date.now()+(s?.timerSec??0)*1000},[s?.id]);
 useEffect(()=>{if(timer===0&&s?.timerSec)feedback("complete",sound,vibration)},[timer,s?.timerSec,sound,vibration]);
 if(!steps.length)return <div className="flex flex-1 flex-col justify-center"><div className="eyebrow">WARM-UP</div><h2 className="mt-2 text-3xl font-extrabold">No warm-up scheduled.</h2><button className="primary-cta mt-6 w-full" onClick={onDone}>START FIRST EXERCISE</button></div>;
 const next=()=>setI(v=>Math.min(steps.length-1,v+1));
 return <div className="flex flex-1 flex-col">
  <div className="eyebrow">WARM-UP</div><h2 className="mt-2 text-4xl font-extrabold">Prime the joints.</h2>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-5"><div className="flex items-center justify-between"><div className="text-[9px] text-zinc-600">STEP {i+1}/{steps.length}</div><span className="text-[8px] font-bold tracking-[.12em] text-violet2">PREP</span></div><strong className="mt-2 block">{s.name}</strong><p className="mt-1 text-[10px] text-muted">{s.dose}</p>{timer!==null&&<div className="mt-6 text-center text-5xl font-extrabold tracking-tight">{formatClock(timer)}</div>}</div>
  <div className="mt-6 grid grid-cols-2 gap-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-4 sm:mt-auto sm:pt-8"><button className="secondary-cta" onClick={()=>setI(Math.max(0,i-1))} disabled={i===0}>BACK</button>{i<steps.length-1?<button className="primary-cta" onClick={next}>NEXT</button>:<button className="primary-cta" onClick={onDone}>START FIRST EXERCISE</button>}</div>
  <button className="mt-3 min-h-10 w-full rounded-xl border border-line bg-transparent px-4 py-2 text-[9px] font-bold tracking-[.12em] text-zinc-500 transition hover:text-zinc-300" onClick={onDone}>SKIP WARM-UP</button>
 </div>
}
function Rest({seconds,onSkip,onDone,sound=true,vibration=true,label="RECOVERY",nextLabel}:{seconds:number;onSkip:()=>void;onDone:()=>void;sound?:boolean;vibration?:boolean;label?:string;nextLabel?:string}){
 const end=useRef(Date.now()+Math.max(0,seconds)*1000),done=useRef(false),lastCountdown=useRef<number|null>(null),now=useNow(true),sec=Math.ceil(Math.max(0,(end.current-now)/1000));
 const total=Math.max(1,seconds),progress=Math.min(1,Math.max(0,sec/total)),radius=96,circ=2*Math.PI*radius;
 useEffect(()=>{
   if(sec>=1&&sec<=3&&lastCountdown.current!==sec){
     lastCountdown.current=sec;
     feedback("countdown",sound,vibration);
   }
   if(sec===0&&!done.current){done.current=true;feedback("start",sound,vibration);onDone()}
 },[sec,sound,vibration,onDone]);
 return <div className="flex flex-1 flex-col items-center justify-center py-8">
   <div className="text-center"><div className="field-label">{label}</div>{nextLabel&&<div className="mt-2 text-sm font-bold text-zinc-300">NEXT · {nextLabel}</div>}</div>
   <div className="relative mt-8 h-[232px] w-[232px]">
     <svg className="h-full w-full -rotate-90" viewBox="0 0 232 232" aria-hidden="true"><circle cx="116" cy="116" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-900"/><circle cx="116" cy="116" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-violet-400 transition-[stroke-dashoffset] duration-200" strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}/></svg>
     <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-6xl font-extrabold tracking-tighter tabular-nums">{formatClock(sec)}</div><div className="mt-2 text-[9px] font-bold tracking-[.16em] text-zinc-600">{label}</div></div>
   </div>
   <button onClick={onSkip} className="mt-8 min-h-10 rounded-xl border border-line px-5 text-[9px] font-bold tracking-[.12em] text-zinc-500">SKIP {label}</button>
 </div>
}

function range(target:string){const n=target.match(/\d+(?:\.\d+)?/g)?.map(Number)||[];return{min:n[0]||1,max:n[1]??n[0]??1}}
function TargetPanel({block}:{block:ExerciseBlock}){
 const r=range(block.target),[target,setLocal]=useState(getTarget(block.id,r.max)??r.max);
 const save=(v:number)=>{const x=Math.max(r.min,Math.min(r.max,v));setLocal(x);setTarget(block.id,x)};
 return <div className="rounded-2xl border border-line bg-panel p-4"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">COACH RANGE</span><div className="mt-1 text-sm font-bold">{block.target}</div></div><div className="text-right"><span className="field-label">TODAY</span><div className="mt-1 flex items-center justify-end gap-2"><button className="mini-btn" disabled={target<=r.min} onClick={()=>save(target-1)}><Minus size={14}/></button><b className="w-8 text-center">{target}</b><button className="mini-btn" disabled={target>=r.max} onClick={()=>save(target+1)}><Plus size={14}/></button></div></div></div></div>
}
function SetBlock({block,day,onComplete,onStarted,existing,onProgress,sound,vibration}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void;sound:boolean;vibration:boolean}){
 const r=range(block.target),[reps,setReps]=useState<number[]>(()=>existing?.result.reps||[]),[input,setInput]=useState(""),[rest,setRest]=useState(false),[band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue?String(existing.result.fatigue):"3"),[editing,setEditing]=useState<number|null>(null),[editValue,setEditValue]=useState("");
 const variantName=currentVariantFor(block.id,block.name),target=getTarget(block.id,r.max)??r.max,prev=latestLog(day,block.id,existing?.date,variantName),last=prev?.result.reps?.[reps.length],max=block.sets||1,complete=reps.length>=max;
 const persist=(next:number[])=>onProgress({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"incomplete",result:{reps:next,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`Today target ${target}/set`}});
 const saveSet=()=>{const n=Number(input);if(!Number.isFinite(n)||n<0||complete||rest)return;const next=[...reps,n];setReps(next);setInput("");setRest(true);onStarted();persist(next)};
 const finish=(status:BlockStatus)=>onComplete({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status,result:{reps,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`Today target ${target}/set`}});
 const diff=last!==undefined&&input!==""?Number(input)-last:null;
 return <div className="flex flex-1 flex-col pt-5"><TargetPanel block={block}/><div className="mt-6 text-center"><div className="text-[9px] tracking-[.15em] text-zinc-600">SET {Math.min(reps.length+1,max)} / {max}</div><span className="field-label mt-3">REPS</span><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={complete} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label="Reps completed this set" className="counter-input" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={complete}/><button className="counter-btn" disabled={complete} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div>{last!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">LAST {last} reps{diff!==null&&<span className={`ml-2 ${diff>=0?"text-emerald-400":"text-rose-300"}`}>{diff>=0?`+${diff}`:`${diff}`}</span>}</div>}</div><div className="mt-6 grid gap-2 sm:grid-cols-2">{!complete&&!rest&&<button className="primary-cta sm:col-span-2" onClick={saveSet}>SAVE SET</button>}{complete&&!rest&&<button className="primary-cta sm:col-span-2" onClick={()=>finish("complete")}>NEXT EXERCISE</button>}{complete&&rest&&<button className="secondary-cta sm:col-span-2" disabled>REST BEFORE NEXT EXERCISE</button>}{reps.length>0&&!complete&&<button className="secondary-cta sm:col-span-2" onClick={()=>finish("incomplete")}>SAVE INCOMPLETE</button>}</div>{rest&&<Rest seconds={block.rest} sound={sound} vibration={vibration} onSkip={()=>setRest(false)} onDone={()=>setRest(false)}/>}<div className="mt-4 flex flex-wrap justify-center gap-2">{reps.map((r,i)=><button className="chip" key={i} title="Tap to edit this set" onClick={()=>{setEditing(i);setEditValue(String(r))}}>SET {i+1}: {r}</button>)}</div>{editing!==null&&<div className="mt-3 rounded-xl border border-line bg-panel p-3"><span className="field-label">EDIT SET {editing+1}</span><div className="mt-1 flex items-center gap-2"><button className="counter-btn" onClick={()=>setEditValue(String(Math.max(0,Number(editValue||0)-1)))}><Minus size={16}/></button><input className="counter-input flex-1" inputMode="numeric" value={editValue} onChange={e=>setEditValue(e.target.value.replace(/\D/g,""))}/><button className="counter-btn" onClick={()=>setEditValue(String(Number(editValue||0)+1))}><Plus size={16}/></button></div><div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setEditing(null)}>CANCEL</button><button className="primary-cta" onClick={()=>{const n=Number(editValue);if(Number.isFinite(n)&&n>=0){const next=reps.map((x,j)=>j===editing?n:x);setReps(next);persist(next)}setEditing(null)}}>SAVE EDIT</button></div></div>}<div className="mt-auto grid grid-cols-3 gap-2 pb-4 pt-8">{block.bandOptions&&<label><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<label><span className="field-label">RIR</span><select value={rir} onChange={e=>setRir(e.target.value)}><option value="">—</option>{[0,1,2,3].map(x=><option key={x}>{x}</option>)}</select></label><label><span className="field-label">FATIGUE</span><select value={fatigue} onChange={e=>setFatigue(e.target.value)}>{[1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label></div></div>
}

function SideSetBlock({block,day,onComplete,onStarted,existing,onProgress,sound,vibration}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void;sound:boolean;vibration:boolean}){
 const rounds=block.sets||1,totalSides=block.id==="oap"?rounds:rounds*2,totalRounds=block.id==="oap"?Math.ceil(rounds/2):rounds,[side,setSide]=useState<"R"|"L">(()=>existing?.result.sides?.[existing.result.sides.length-1]==="R"?"L":"R"),[reps,setReps]=useState<number[]>(()=>existing?.result.reps||[]),[sides,setSides]=useState<("R"|"L")[]>(()=>existing?.result.sides||[]),[input,setInput]=useState(""),[band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue?String(existing.result.fatigue):"3"),[rest,setRest]=useState(false);
 const variantName=currentVariantFor(block.id,block.name),prev=latestLog(day,block.id,existing?.date,variantName),pr=prev?.result.reps||[],ps=prev?.result.sides||[],complete=reps.length>=totalSides,currentIndex=reps.length,round=Math.floor(currentIndex/2)+1;
 const persist=(nextReps:number[],nextSides:("R"|"L")[])=>onProgress({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"incomplete",result:{reps:nextReps,sides:nextSides,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue)}});
 const save=()=>{const n=Number(input);if(!Number.isFinite(n)||n<0||complete||rest)return;const savedSide=side,nextReps=[...reps,n],nextSides=[...sides,savedSide];setReps(nextReps);setSides(nextSides);setInput("");onStarted();persist(nextReps,nextSides);if(savedSide==="R")setSide("L");else{setSide("R");setRest(true)}};
 const finish=(status:BlockStatus)=>onComplete({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status,result:{reps,sides,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue)}});
 const r=range(block.target);
 return <div className="flex flex-1 flex-col pt-5"><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-4"><div><span className="field-label">SIDE</span><div className="mt-1 text-2xl font-extrabold">{side==="R"?"RIGHT":"LEFT"}</div><div className="mt-1 text-[10px] text-muted">ROUND {Math.min(round,totalRounds)} / {totalRounds}</div></div><div className="text-right"><span className="field-label">TARGET / SIDE</span><div className="mt-1 text-sm font-extrabold">{r.min===r.max?r.min:`${r.min}–${r.max}`} reps</div></div></div></div><div className="mt-6 text-center"><div className="text-[9px] tracking-[.15em] text-zinc-600">SIDE {Math.min(reps.length+1,totalSides)} / {totalSides}</div><span className="field-label mt-3">REPS</span><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={complete} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label={`Reps completed ${side==="R"?"right":"left"}`} className="counter-input" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={complete}/><button className="counter-btn" disabled={complete} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div>{pr[currentIndex]!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">LAST {ps[currentIndex]==="R"?"RIGHT":"LEFT"}: <b className="text-white">{pr[currentIndex]}</b></div>}</div>{!complete&&!rest&&<button className="primary-cta mt-6" onClick={save}>SAVE {side==="R"?"RIGHT":"LEFT"}</button>}{complete&&!rest&&<button className="primary-cta mt-2" onClick={()=>finish("complete")}>NEXT EXERCISE</button>}{complete&&rest&&<button className="secondary-cta mt-2" disabled>REST BEFORE NEXT EXERCISE</button>}{reps.length>0&&!complete&&<button className="secondary-cta mt-2" onClick={()=>finish("incomplete")}>SAVE INCOMPLETE</button>}{rest&&<Rest seconds={block.rest} sound={sound} vibration={vibration} onSkip={()=>setRest(false)} onDone={()=>setRest(false)}/>}<div className="mt-5 flex flex-wrap justify-center gap-2">{reps.map((r,i)=><button className="chip" key={i} onClick={()=>{setReps(v=>v.filter((_,j)=>j!==i));setSides(v=>v.filter((_,j)=>j!==i))}}>{sides[i]} {i+1}: {r}</button>)}</div><div className="mt-auto grid grid-cols-3 gap-2 pb-4 pt-8">{block.bandOptions&&<label><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<label><span className="field-label">RIR</span><select value={rir} onChange={e=>setRir(e.target.value)}><option value="">—</option>{[0,1,2,3].map(x=><option key={x}>{x}</option>)}</select></label><label><span className="field-label">FATIGUE</span><select value={fatigue} onChange={e=>setFatigue(e.target.value)}>{[1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label></div></div>
}

function Emom({block,day,onComplete,onStarted,sound,vibration,existing,onProgress}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;sound:boolean;vibration:boolean;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void}){
 const variantName=currentVariantFor(block.id,block.name),[minutes,setMinutesLocal]=useState(()=>getEmomDuration(block.id,block.minutes||10)),r=range(block.target),[vals,setVals]=useState<number[]>(()=>existing?.result.emom||[]),[input,setInput]=useState(""),[phase,setPhase]=useState<"ready"|"running"|"input"|"complete">(()=>existing?.result.emom?.length?"input":"ready"),[minute,setMinute]=useState((existing?.result.emom?.length||0)+1),[endAt,setEndAt]=useState(0),now=useNow(phase==="running"),[logged,setLogged]=useState(false),[target,setTargetLocal]=useState(getTarget(block.id,r.max)??r.max),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue?String(existing.result.fatigue):"3"),[editing,setEditing]=useState<number|null>(null),[editValue,setEditValue]=useState("");
 const remaining=Math.max(0,endAt?endAt-now:0),sec=Math.ceil(remaining/1000),prev=latestLog(day,block.id,existing?.date,variantName)?.result.emom||[],last=prev[minute-1],lastCountdown=useRef<number|null>(null);
 const persist=(nextVals:number[])=>onProgress({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"incomplete",result:{emom:nextVals,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`${minutes}-min EMOM · today target ${target}/min`}});
 useEffect(()=>{
   if(phase!=="running")return;
   if(sec>=1&&sec<=3&&lastCountdown.current!==sec){
     lastCountdown.current=sec;
     feedback("countdown",sound,vibration);
   }
   if(remaining>0)return;
   lastCountdown.current=null;
   feedback("start",sound,vibration);
   if(!logged){setPhase("input");return}
   if(minute>=minutes){setPhase("complete");return}
   setMinute(m=>m+1);setLogged(false);setInput("");setEndAt(Date.now()+60000)
 },[phase,remaining,sec,logged,minute,minutes,sound,vibration]);
 const start=()=>{initAudio();lastCountdown.current=null;setMinute(1);setVals([]);setLogged(false);setInput("");setEndAt(Date.now()+60000);setPhase("running");feedback("start",sound,vibration)};
 const saveMinute=()=>{if(logged)return;const n=Number(input);if(!Number.isFinite(n)||n<0)return;const next=[...vals,n];setVals(next);persist(next);setLogged(true);onStarted();setInput("");if(phase==="input"){if(minute>=minutes)setPhase("complete");else{setMinute(m=>m+1);setLogged(false);setInput("");lastCountdown.current=null;setEndAt(Date.now()+60000);setPhase("running");feedback("start",sound,vibration)}}};
 const finish=(status:BlockStatus="complete")=>{setTarget(block.id,target);onComplete({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status,result:{emom:vals,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`${minutes}-min EMOM · today target ${target}/min`}})};
 const adjust=(d:number)=>setTargetLocal(Math.max(r.min,Math.min(r.max,target+d)));
 const adjustMinutes=(d:number)=>{const next=Math.max(5,Math.min(15,minutes+d));setMinutesLocal(next);setEmomDuration(block.id,next);};
 const diff=last!==undefined&&input!==""?Number(input)-last:null,canFinish=phase==="complete"&&vals.length>=minutes;
 return <div className="flex flex-1 flex-col pt-4"><div className="text-center"><div className="text-[9px] tracking-[.16em] text-zinc-600">MINUTE {Math.min(minute,minutes)} / {minutes}</div><div className="mt-2 text-7xl font-extrabold">{phase==="ready"?"01:00":phase==="running"?formatClock(sec):phase==="input"?"ENTER":"DONE"}</div><div className="mt-4 rounded-2xl border border-line bg-panel p-4 text-left"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">COACH RANGE / MIN</span><div className="font-bold">{block.target}</div></div><div className="text-right"><span className="field-label">TODAY</span><div className="mt-1 flex justify-end gap-2"><button className="mini-btn" disabled={target<=r.min} onClick={()=>adjust(-1)}><Minus size={14}/></button><b>{target}</b><button className="mini-btn" disabled={target>=r.max} onClick={()=>adjust(1)}><Plus size={14}/></button></div></div></div><div className="mt-4 border-t border-line pt-3"><div className="flex items-center justify-between"><span className="field-label">DURATION</span><span className="text-[9px] text-zinc-600">Recommended {block.minutes||10} min</span></div><div className="mt-2 flex items-center justify-between gap-2"><button className="mini-btn" disabled={minutes<=5||phase!=="ready"} onClick={()=>adjustMinutes(-1)}><Minus size={14}/></button><div className="text-center"><div className="text-2xl font-extrabold">{minutes} min</div><div className="text-[8px] text-zinc-600">5–15 min · before start</div></div><button className="mini-btn" disabled={minutes>=15||phase!=="ready"} onClick={()=>adjustMinutes(1)}><Plus size={14}/></button></div></div></div>{last!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">LAST M{minute}: <b className="text-white">{last}</b>{diff!==null&&<span className={`ml-2 ${diff>=0?"text-emerald-400":"text-rose-300"}`}>{diff>=0?`+${diff} vs last`:`${diff} vs last`}</span>}</div>}</div>{(phase==="running"||phase==="input")&&<div className="mt-7 rounded-2xl border border-line bg-panel p-4"><div className="field-label">REPS THIS MINUTE</div><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={logged} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label="Reps this minute" className="counter-input w-36" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={logged}/><button className="counter-btn" disabled={logged} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div><button className="primary-cta mt-2 w-full" disabled={logged||input===""} onClick={saveMinute}>{logged?`M${minute} SAVED`:`SAVE M${minute}`}</button></div>}{phase==="ready"&&<button className="primary-cta mt-7 w-full" onClick={start}><Play size={15}/>START {minutes}-MIN EMOM</button>}{canFinish&&<button className="primary-cta mt-5 w-full" onClick={()=>finish("complete")}>SAVE & NEXT</button>}{vals.length>0&&phase!=="complete"&&<button className="secondary-cta mt-2 w-full" onClick={()=>finish("incomplete")}>SAVE INCOMPLETE</button>}<div className="mt-5 flex flex-wrap justify-center gap-2">{vals.map((v,i)=><button className="chip" key={i} title="Tap to edit this minute" onClick={()=>{setEditing(i);setEditValue(String(v))}}>M{i+1}: {v}</button>)}</div>{editing!==null&&<div className="mt-3 rounded-xl border border-line bg-panel p-3"><span className="field-label">EDIT MINUTE {editing+1}</span><div className="mt-1 flex items-center gap-2"><button className="counter-btn" onClick={()=>setEditValue(String(Math.max(0,Number(editValue||0)-1)))}><Minus size={16}/></button><input className="counter-input flex-1" inputMode="numeric" value={editValue} onChange={e=>setEditValue(e.target.value.replace(/\D/g,""))}/><button className="counter-btn" onClick={()=>setEditValue(String(Number(editValue||0)+1))}><Plus size={16}/></button></div><div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setEditing(null)}>CANCEL</button><button className="primary-cta" onClick={()=>{const n=Number(editValue);if(n>=0){const next=vals.map((x,j)=>j===editing?n:x);setVals(next);persist(next)}setEditing(null)}}>SAVE EDIT</button></div></div>}{vals.length>0&&<div className="mt-4 rounded-xl border border-line bg-panel p-3 text-center text-[10px] text-muted">TOTAL <b className="text-white">{emomStats(vals).total}</b> · AVG <b className="text-white">{emomStats(vals).avg.toFixed(1)}</b> · DROP-OFF <b className="text-white">{emomStats(vals).drop.toFixed(0)}%</b></div>}<div className="mt-auto grid grid-cols-2 gap-2 pb-4 pt-8"><label><span className="field-label">RIR</span><select value={rir} onChange={e=>setRir(e.target.value)}><option value="">—</option>{[0,1,2,3].map(x=><option key={x}>{x}</option>)}</select></label><label><span className="field-label">FATIGUE</span><select value={fatigue} onChange={e=>setFatigue(e.target.value)}>{[1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label></div></div>
}

function isoRange(target:string){
  const n=target.match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
  return {min:n[0]||1,max:n[1]||n[0]||n[0]||1};
}
function classifyIso(seconds:number,min:number,max:number){
  if(seconds < Math.max(0,min-0.3)) return "BELOW";
  if(seconds < min) return "NEAR";
  if(seconds >= max) return "MAX";
  return "VALID";
}
function StaticSkill({block,day,onComplete,onStarted,sound,vibration,existing,onProgress}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;sound:boolean;vibration:boolean;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void}){
 const r=isoRange(block.target),[phase,setPhase]=useState<"ready"|"count"|"hold"|"stopped">("ready"),[countdownEnd,setCountdownEnd]=useState(0),[started,setStarted]=useState(0),now=useNow(phase==="count"||phase==="hold"),[vals,setVals]=useState<number[]>(()=>existing?.result.seconds||[]),[qualities,setQualities]=useState<string[]>(()=>{const q=((existing?.result.note||"").match(/qualities ([^;]+)/)?.[1]||"").split("/").filter(Boolean);return q.length?q:Array(existing?.result.seconds?.length||0).fill("Clean")})
 const variantName=currentVariantFor(block.id,block.name);
 const todayTarget=Math.max(r.min,Math.min(r.max,getTarget(block.id,r.max)??r.max));
 const lastSession=latestLog(day,block.id,existing?.date,variantName);
 const [band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue?String(existing.result.fatigue):"3"),[attemptQuality,setAttemptQuality]=useState("Clean"),[resting,setResting]=useState(false);
 const lastSeries=lastSession?.result.seconds?.[vals.length];
 const countdownRemaining=Math.max(0,countdownEnd?countdownEnd-now:0),count=Math.ceil(countdownRemaining/1000),elapsed=phase==="hold"?Math.min(r.max,Math.max(0,(now-started)/1000)):0,status=classifyIso(elapsed,r.min,r.max);
 const stopLock=useRef(false);
 useEffect(()=>{if(phase!=="count"||countdownRemaining>0)return;setStarted(Date.now());setPhase("hold");feedback("start",sound,vibration)},[phase,countdownRemaining,sound,vibration]);
 useEffect(()=>{if(phase!=="hold"||elapsed<r.max)return;stop()},[phase,elapsed,r.max]);
 const startCountdown=()=>{initAudio();stopLock.current=false;setCountdownEnd(Date.now()+5000);setPhase("count");onStarted()};
 const stop=()=>{if(stopLock.current||phase!=="hold")return;stopLock.current=true;const sec=Math.min(r.max,Number(elapsed.toFixed(1)));const next=[...vals,sec],nextQ=[...qualities,attemptQuality];setVals(next);setQualities(nextQ);setAttemptQuality("Clean");setPhase("stopped");if(sec>=r.max)feedback("complete",sound,vibration);else if(vibration){try{navigator.vibrate?.(50)}catch{}};onProgress({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"incomplete",result:{seconds:next,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`Coach range ${block.target}; qualities ${nextQ.join("/")}`}})};
 const finish=()=>onComplete({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"complete",result:{seconds:vals,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:`Coach range ${block.target}; qualities ${qualities.join("/")}`}});
 const allInRange=vals.length>=Math.max(1,block.sets||3)&&vals.every(v=>v>=r.min&&v<=r.max),allClean=qualities.length===vals.length&&qualities.every(q=>q==="Clean"),maxed=vals.length>0&&vals.length>=Math.max(1,block.sets||3)&&vals.every(v=>v>=r.max);
 return <div className="flex flex-1 flex-col items-center pt-2">
   <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">COACH RANGE</span><div className="mt-1 text-sm font-bold">{r.min}–{r.max}s</div></div><div className="text-right"><span className="field-label">TODAY TARGET</span><div className="mt-1 text-sm font-bold text-violet2">{todayTarget.toFixed(1)}s</div></div></div><div className="mt-3 border-t border-line pt-3 text-center text-[9px] tracking-[.12em] text-zinc-600">SET {Math.min(vals.length+1,block.sets||3)} / {block.sets||3}</div></div>
   <div className="mt-4 text-center text-[10px] text-zinc-500">{lastSeries!==undefined?<>LAST SET {vals.length+1} <b className="text-white">{lastSeries.toFixed(1)}s</b></>:"NO PREVIOUS SET DATA"}</div>
   <div className="mt-8 text-center text-[92px] font-extrabold tracking-tighter sm:text-[132px]">{phase==="count"?count:phase==="hold"?elapsed.toFixed(1):"00.0"}<span className="text-xl text-zinc-600">{phase==="hold"?"s":""}</span></div>
   <div className={`mt-2 text-[9px] font-extrabold tracking-[.16em] ${phase==="hold"?(status==="BELOW"?"text-rose-300":status==="NEAR"?"text-amber-300":status==="MAX"?"text-emerald-400":"text-violet2"):"text-zinc-600"}`}>{phase==="count"?"GET READY":phase==="hold"?(status==="BELOW"?"BELOW TARGET":status==="NEAR"?"NEAR TARGET":status==="MAX"?"TARGET HIT":"TARGET REACHED"):phase==="stopped"?"ATTEMPT SAVED":"READY"}</div>
   <div className="mt-6 w-full max-w-sm">{phase==="ready"&&<button className="primary-cta w-full" onClick={startCountdown}><Play size={15}/>START</button>}{phase==="count"&&<div className="text-center text-[10px] text-zinc-500">Get into position.</div>}{phase==="hold"&&<button className="danger-cta w-full" onClick={stop}>END SET</button>}{phase==="stopped"&&<div className="rounded-2xl border border-line bg-panel p-4"><div className="text-center"><div className="text-3xl font-extrabold">{vals[vals.length-1]?.toFixed(1)}s</div><div className="mt-1 text-[9px] text-zinc-500">{classifyIso(vals[vals.length-1]||0,r.min,r.max)}</div></div><div className="mt-4"><span className="field-label">QUALITY</span><div className="mt-2 grid grid-cols-3 gap-2">{["Clean","Shaky","Lost position"].map(q=><button key={q} onClick={()=>setAttemptQuality(q)} className={`rounded-xl border px-2 py-3 text-[9px] font-bold ${attemptQuality===q?"border-violet-400 bg-violet-500/10 text-violet2":"border-line bg-panel2 text-zinc-500"}`}>{q.toUpperCase()}</button>)}</div></div><div className="mt-4 grid grid-cols-2 gap-2">{vals.length<(block.sets||3)?<button className="secondary-cta" onClick={()=>{stopLock.current=false;setResting(true)}}>REST & NEXT</button>:<button className="secondary-cta" disabled>ALL LOGGED</button>}{vals.length>=(block.sets||3)?<button className="primary-cta" onClick={finish}>SAVE & NEXT</button>:<button className="secondary-cta" onClick={()=>onComplete({id:existing?.id||crypto.randomUUID(),date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantName,kind:block.kind,status:"incomplete",result:{seconds:vals,band,rir:rir?Number(rir):undefined,fatigue:Number(fatigue),note:"Incomplete static skill"}})}>SAVE INCOMPLETE</button>}</div></div>}</div>
   {resting&&<div className="w-full max-w-sm"><Rest seconds={block.rest||0} sound={sound} vibration={vibration} onSkip={()=>{stopLock.current=false;setResting(false);setAttemptQuality("Clean");startCountdown()}} onDone={()=>{stopLock.current=false;setResting(false);setAttemptQuality("Clean");startCountdown()}}/></div>}
   {vals.length>0&&<div className="mt-5 w-full max-w-sm rounded-xl border border-line bg-panel2 p-3 text-center"><div className="flex flex-wrap justify-center gap-2">{vals.map((v,i)=><span key={i} className="chip">{v.toFixed(1)}s</span>)}</div>{maxed&&allClean&&<div className="mt-3 text-[9px] font-bold text-emerald-400">PROGRESSION READY</div>}{allInRange&&!maxed&&allClean&&<div className="mt-3 text-[9px] font-bold text-violet2">TARGET COMPLETED</div>}</div>}
   <div className="mt-auto grid w-full max-w-sm grid-cols-3 gap-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-6">{block.bandOptions&&<label><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<label><span className="field-label">RIR</span><select value={rir} onChange={e=>setRir(e.target.value)}><option value="">—</option>{[0,1,2,3].map(x=><option key={x}>{x}</option>)}</select></label><label><span className="field-label">FATIGUE</span><select value={fatigue} onChange={e=>setFatigue(e.target.value)}>{[1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label></div>
 </div>
}

function parseTargetRange(target:string){const m=String(target||"").match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);if(!m)return null;return{min:Number(m[1]),max:Number(m[2])};}
function proposeTargetProgression(block:ExerciseBlock,log:WorkoutLog):Omit<CoachProposal,"id"|"date">|null{
 if(log.status!=="complete")return null;
 const range=parseTargetRange(block.target);if(!range)return null;
 const r=log.result||{};const rir=r.rir;const quality=String(r.note||"").match(/qualities\s+([^;]+)/i)?.[1]?.split("/").map(x=>x.trim().toLowerCase())||[];
 const clean=quality.length?quality.every(x=>x==="clean"):true;
 const reps=Array.isArray(r.reps)?r.reps.map(Number):[];
 const seconds=Array.isArray(r.seconds)?r.seconds.map(Number):[];
 const emom=Array.isArray(r.emom)?r.emom.map(Number):[];
 const enoughSets=Math.max(1,block.sets||3);
 if(seconds.length>=enoughSets&&seconds.slice(0,enoughSets).every(v=>v>=range.max)&&clean&&(rir===undefined||rir>=1)){
   const nextMin=Number((range.min+1).toFixed(1)),nextMax=Number((range.max+1).toFixed(1));
   return{type:"target",exerciseId:block.id,title:`Progress target — ${block.name}`,detail:`Every logged hold reached the top of the current range with clean quality.`,from:block.target,to:`${nextMin}–${nextMax}s`,reason:`Target ceiling reached across ${enoughSets} clean holds with sufficient RIR.` ,status:"pending",sessionId:log.id};
 }
 if(reps.length>=enoughSets&&reps.slice(0,enoughSets).every(v=>v>=range.max)&&clean&&(rir===undefined||rir>=1)){
   const step=range.max>=30?5:1;const nextMin=range.min+step,nextMax=range.max+step;
   return{type:"target",exerciseId:block.id,title:`Progress target — ${block.name}`,detail:`Every logged set reached the top of the current rep range with clean execution.`,from:block.target,to:`${nextMin}–${nextMax}`,reason:`Rep target ceiling reached across ${enoughSets} clean sets with sufficient RIR.`,status:"pending",sessionId:log.id};
 }
 if(emom.length>=Math.max(5,block.minutes||10)&&emom.every(v=>v>=range.max)&&emomStats(emom).drop<15){
   return{type:"target",exerciseId:block.id,title:`Progress target — ${block.name}`,detail:`Every EMOM minute reached the top of the current range with stable output.`,from:block.target,to:`${range.min+1}–${range.max+1}`,reason:`EMOM ceiling reached with <15% drop-off.`,status:"pending",sessionId:log.id};
 }
 return null;
}
function CoachProposalPanel({session}:{session:SessionSummary}){
 const [items,setItems]=useState<CoachProposal[]>(()=>getCoachProposals().filter(p=>p.sessionId===session.id));
 const [message,setMessage]=useState("");
 const blocks=effectiveProgram(session.day).blocks;
 useEffect(()=>{
   const current=getCoachProposals();
   for(const log of session.logs){
     const block=blocks.find(b=>b.id===log.exerciseId);
     if(!block||log.status!=="complete")continue;
     const targetProposal=proposeTargetProgression(block,log);
     if(targetProposal&&!current.some(p=>p.sessionId===targetProposal.sessionId&&p.exerciseId===targetProposal.exerciseId&&p.type===targetProposal.type&&p.to===targetProposal.to))saveCoachProposal(targetProposal);
     const currentName=currentVariantFor(block.id,PROGRESSIONS[block.id]?.current||block.name);
     const history=getLogs().filter(x=>x.exerciseId===block.id&&!x.skipped&&logVariantName(x)===currentName).sort((a,b)=>a.date-b.date);
     const now=history[history.length-1],prev=history[history.length-2];
     if(now?.id===log.id&&prev&&meetsCurrentProgression(block.id,now)&&meetsCurrentProgression(block.id,prev)){
       const next=nextLadderVariant(block.id,currentName);
       if(next&&next.name!==currentName&&!current.some(p=>p.sessionId===session.id&&p.exerciseId===block.id&&p.type==="variant"&&p.to===next.name)){
         saveCoachProposal({type:"variant",exerciseId:block.id,title:`Progression candidate — ${block.name}`,detail:`The progression standard was met in two consecutive qualifying exposures.`,from:currentName,to:next.name,reason:`Two consecutive qualifying sessions met the exercise-specific progression criteria.`,status:"pending",sessionId:session.id});
       }
     }
   }
   setItems(getCoachProposals().filter(p=>p.sessionId===session.id));
 },[session.id]);
 const apply=async(p:CoachProposal,accept:boolean)=>{
   if(!accept){updateCoachProposal(p.id,"rejected");saveCoachDecision({type:"coach",exerciseId:p.exerciseId,title:`Proposal rejected — ${p.title}`,detail:p.reason,from:p.from,to:p.to});setItems(getCoachProposals().filter(x=>x.sessionId===session.id));return}
   const block=blocks.find(b=>b.id===p.exerciseId);if(!block){setMessage("Exercise is no longer present in the active plan.");return}
   const previous=getProgramOverride(block.id)||null;
   if(p.type==="variant"){
     const ladder=PROGRESSION_LADDERS[block.id]||[];const index=Math.max(0,ladder.findIndex(x=>x.name===p.to));
     setVariant(block.id,{exerciseId:block.id,variantId:ladder[index]?.id||p.to,variantName:p.to,step:index,status:"promoted",updatedAt:Date.now(),lastCoachAction:"promote"});
   }
   setProgramOverride(block.id,{exerciseId:block.id,catalogExerciseId:block.catalogExerciseId,name:p.type==="variant"?p.to:block.name,kind:block.kind,target:p.type==="target"?p.to:block.target,sets:block.sets,rest:block.rest,minutes:block.minutes,bandOptions:block.bandOptions,defaultBand:block.defaultBand,updatedAt:Date.now(),previous});
   updateCoachProposal(p.id,"accepted");saveCoachDecision({type:p.type==="variant"?"progression":"program",exerciseId:p.exerciseId,title:`Proposal accepted — ${p.title}`,detail:`${p.reason} Applied to future sessions.`,from:p.from,to:p.to});await syncProgramLayer().catch(()=>undefined);setMessage(`${block.name}: ${p.from} → ${p.to}`);setItems(getCoachProposals().filter(x=>x.sessionId===session.id));
 };
 if(!items.length)return null;
 return <section className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">COACH PROPOSALS</div><p className="mt-1 text-[10px] leading-4 text-zinc-500">Approve a target progression or reject it. The workout stays unchanged until you accept.</p></div><span className="tag">HUMAN APPROVAL</span></div>{message&&<div className="mt-3 rounded-lg bg-emerald-500/10 p-2 text-[9px] text-emerald-300">{message}</div>}<div className="mt-4 space-y-2">{items.map(p=><div key={p.id} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-violet2">{p.type.toUpperCase()}</div><div className="mt-1 text-sm font-extrabold">{p.title}</div></div><span className="text-[8px] font-bold text-zinc-600">{p.status.toUpperCase()}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div><div className="field-label">CURRENT</div><div className="mt-1 text-sm font-bold">{p.from}</div></div><div><div className="field-label">PROPOSED</div><div className="mt-1 text-sm font-bold text-violet2">{p.to}</div></div></div><p className="mt-3 text-[9px] leading-4 text-zinc-500">{p.reason}</p>{p.status==="pending"&&<div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>void apply(p,false)}>REJECT</button><button className="primary-cta" onClick={()=>void apply(p,true)}>ACCEPT & UPDATE PLAN</button></div>}{p.status!=="pending"&&<div className="mt-3 text-[9px] font-bold text-zinc-500">DECISION RECORDED: {p.status.toUpperCase()}</div>}</div>)}</div></section>;
}

function Summary({session,close,onSave}:{session:SessionSummary;close:()=>void;onSave:(s:SessionSummary)=>void}){
 const [note,setNote]=useState(session.sessionNote||""),[saved,setSaved]=useState(false),[copiedSummary,setCopiedSummary]=useState(false),[mode,setMode]=useState<"summary"|"mobility">("summary"),[mobilityDone,setMobilityDone]=useState(false),[sessionFeel,setSessionFeel]=useState(""),[showDetails,setShowDetails]=useState(false);
 const coachNote=[sessionFeel?`SESSION FEEL: ${sessionFeel}`:"",note.trim()].filter(Boolean).join("\n");
 const handoff=makeCoachHandoff({...session,sessionNote:coachNote}),details=makeSessionReport({...session,sessionNote:coachNote});
 const saveFeedback=()=>{const next={...session,sessionNote:coachNote};replaceSession(next);uploadWorkoutSession(next).catch(err=>console.warn("Cloud sync deferred.",err));onSave(next);setSaved(true)};
 const copy=async()=>{try{await navigator.clipboard.writeText(handoff);setCopiedSummary(true);setTimeout(()=>setCopiedSummary(false),1400)}catch{}};
 const exportReport=()=>download(details,`coach-report-${session.day.toLowerCase()}.txt`);
 if(mode==="mobility")return <MobilityPlayer day={session.day} workoutSessionId={session.id} onDone={()=>{setMobilityDone(true);setMode("summary")}} onSkipAll={()=>{setMode("summary");setMobilityDone(true)}}/>;
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink text-white"><div className="mx-auto max-w-2xl px-4 py-8 pb-32">
  <div className="eyebrow">WORKOUT COMPLETE</div><h1>Session saved.</h1>
  <div className="mt-6 grid grid-cols-3 gap-2"><Metric label="TIME" value={Math.round(session.durationSec/60)}/><Metric label="REPS" value={session.totalReps}/><Metric label="EMOM" value={session.emomReps}/></div>
  <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">COACH HANDOFF</div><p className="mt-1 text-[10px] leading-4 text-zinc-500">The compact report is built for one thing: send it to your coach for the next adjustment.</p></div><span className="tag">READY</span></div><pre className="mt-4 max-h-[360px] overflow-y-auto whitespace-pre-wrap font-sans text-[10px] leading-5 text-zinc-300">{handoff}</pre><div className="mt-4 grid gap-2 sm:grid-cols-3"><button className="primary-cta" onClick={copy}>{copiedSummary?"COPIED":"COPY FOR COACH"}</button><button className="secondary-cta" onClick={()=>setShowDetails(v=>!v)}>{showDetails?"HIDE DETAILS":"FULL DETAILS"}</button><button className="secondary-cta" onClick={exportReport}><Download size={14}/>EXPORT TXT</button></div>{showDetails&&<div className="mt-4 rounded-xl border border-line bg-panel2 p-3"><pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-sans text-[9px] leading-5 text-zinc-400">{details}</pre></div>}</div>
  <PRMoments session={session}/>
  <CoachVerdict session={session}/>
  <CoachProposalPanel session={session}/>
  <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">FEEDBACK</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label><span className="field-label">SESSION FEEL</span><select value={sessionFeel} onChange={e=>setSessionFeel(e.target.value)}><option value="">—</option><option value="easy">Easy</option><option value="on_target">On target</option><option value="hard">Hard but controlled</option><option value="very_hard">Very hard</option></select></label><label><span className="field-label">NOTE</span><input value={note} onChange={e=>{setNote(e.target.value);setSaved(false)}} placeholder="Optional note"/></label></div><button className="primary-cta mt-3 w-full" onClick={saveFeedback}>{saved?"SAVED":"SAVE FEEDBACK"}</button></div>
  <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="section-kicker">MOBILITY</div>{mobilityDone?<div className="mt-2 text-[10px] text-emerald-300">Completed.</div>:<><p className="mt-2 text-[10px] text-zinc-500">Continue here — no need to leave the app or copy anything first.</p><div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>{const skipped:MobilitySession={id:crypto.randomUUID(),workoutSessionId:session.id,date:Date.now(),day:session.day,status:"skipped",durationSec:0,logs:[]};saveMobilitySession(skipped);uploadMobilitySession(skipped).catch(err=>console.warn("Mobility cloud sync failed; local session preserved.",err));setMobilityDone(true)}}>SKIP</button><button className="primary-cta" onClick={()=>setMode("mobility")}>START MOBILITY</button></div></>}</div>
  <button className="secondary-cta mt-4 w-full" onClick={close}>DONE</button>
 </div></div>
}

function MobilityPlayer({day,workoutSessionId,onDone,onSkipAll}:{day:DayKey;workoutSessionId:string;onDone:()=>void;onSkipAll:()=>void}){
 const steps=POST_WORKOUT_MOBILITY[day]||[];
 const [index,setIndex]=useState(0),[remaining,setRemaining]=useState(steps[0]?.durationSec||0),[reps,setReps]=useState(0),[logs,setLogs]=useState<MobilityLog[]>([]),[confirmSkipAll,setConfirmSkipAll]=useState(false),startedRef=useRef(Date.now()),endAtRef=useRef(Date.now()+(steps[0]?.durationSec||0)*1000),finishLock=useRef(false);
 const step:MobilityExercise|undefined=steps[index];
 const isStatic=step?.kind==="static";
 const resetStep=()=>{finishLock.current=false;const duration=Math.max(0,step?.durationSec||0);endAtRef.current=Date.now()+duration*1000;setRemaining(duration);setReps(0)};
 useEffect(()=>{resetStep()},[index]);
 useEffect(()=>{if(!step||!step.durationSec)return;const tick=()=>setRemaining(Math.max(0,Math.ceil((endAtRef.current-Date.now())/1000)));tick();const id=window.setInterval(tick,250);return()=>window.clearInterval(id)},[step,index]);
 useEffect(()=>{if(!step||remaining>0||finishLock.current)return;finishStep()},[remaining,step]);
 function finishStep(){
   if(!step||finishLock.current)return;
   finishLock.current=true;
   const log:MobilityLog={id:crypto.randomUUID(),exerciseId:step.id,exerciseName:step.name,kind:step.kind,status:"complete",durationSec:step.kind==="static"?step.durationSec:Math.max(0,Date.now()-(endAtRef.current-(step.durationSec||0)*1000))/1000,reps:step.kind==="dynamic"?reps:undefined};
   const nextLogs=[...logs,log];
   setLogs(nextLogs);
   if(index>=steps.length-1){finishSession(nextLogs);}else setIndex(i=>i+1);
 }
 function skipStep(){
   if(!step||finishLock.current)return;
   finishLock.current=true;
   const log:MobilityLog={id:crypto.randomUUID(),exerciseId:step.id,exerciseName:step.name,kind:step.kind,status:"skipped",skipped:true};
   const next=[...logs,log];setLogs(next);if(index>=steps.length-1)finishSession(next);else setIndex(i=>i+1);
 }
 function skipAll(){
   const now=Date.now();
   const session:MobilitySession={id:crypto.randomUUID(),workoutSessionId,date:now,day,status:"skipped",durationSec:Math.max(0,Math.round((now-startedRef.current)/1000)),logs:[...logs,...steps.slice(index).map(s=>({id:crypto.randomUUID(),exerciseId:s.id,exerciseName:s.name,kind:s.kind,status:"skipped" as const,skipped:true}))]};
   saveMobilitySession(session);uploadMobilitySession(session).catch(err=>console.warn("Mobility cloud sync failed; local session preserved.",err));
   setConfirmSkipAll(false);onSkipAll();
 }
 function finishSession(finalLogs:MobilityLog[]){
   const now=Date.now();
   const status:MobilitySession["status"]=finalLogs.every(x=>x.status==="complete")?"complete":finalLogs.every(x=>x.status==="skipped")?"skipped":"incomplete";
   const session:MobilitySession={id:crypto.randomUUID(),workoutSessionId,date:now,day,status,durationSec:Math.max(0,Math.round((now-startedRef.current)/1000)),logs:finalLogs};
   saveMobilitySession(session);uploadMobilitySession(session).catch(err=>console.warn("Mobility cloud sync failed; local session preserved.",err));onDone();
 }
 if(!step) return null;
 const nextName=steps[index+1]?.name;
 const targetReps=step.reps||0;
 return <div className="fixed inset-0 z-[60] flex min-h-[100dvh] flex-col bg-ink text-white">
   <div className="shrink-0 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4"><span className="text-[9px] tracking-[.14em] text-zinc-600">MOBILITY · {String(index+1).padStart(2,"0")}/{String(steps.length).padStart(2,"0")}</span><button className="min-h-10 px-2 text-[9px] font-bold tracking-[.1em] text-zinc-500" onClick={()=>setConfirmSkipAll(true)}>SKIP ALL</button></div></div>
   <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8 pb-28">
     <div className="eyebrow">POST-WORKOUT MOBILITY</div><h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{step.name}</h2><div className="mt-6 rounded-2xl border border-line bg-panel p-5"><div className="field-label">HOW TO EXECUTE</div><p className="mt-2 text-sm leading-6 text-zinc-300">{step.description}</p>{step.cue&&<div className="mt-4 rounded-xl bg-panel2 p-3 text-[10px] leading-5 text-zinc-500"><span className="font-bold text-zinc-300">CUE · </span>{step.cue}</div>}</div>
     <div className="mt-8 text-center">
       <div className="text-8xl font-extrabold tracking-tighter sm:text-[112px]">{formatClock(remaining)}</div>
       <div className="mt-2 text-[9px] font-bold tracking-[.15em] text-violet2">{isStatic?"HOLD · BREATHE · RELAX":"MOVE WITH CONTROL"}</div>
     </div>
     {!isStatic&&<div className="mx-auto mt-6 w-full max-w-sm rounded-2xl border border-line bg-panel p-4"><div className="field-label">REPS COMPLETED</div><div className="mt-2 flex items-center justify-center gap-3"><button className="counter-btn" onClick={()=>setReps(v=>Math.max(0,v-1))} aria-label="Decrease mobility reps"><Minus size={16}/></button><div className="w-20 text-center text-4xl font-extrabold">{reps}</div><button className="counter-btn" onClick={()=>setReps(v=>v+1)} aria-label="Increase mobility reps"><Plus size={16}/></button></div><div className="mt-2 text-center text-[8px] tracking-[.12em] text-zinc-600">TARGET {targetReps} REPS · TIMER CONTINUES</div></div>}
     <div className="mt-auto pt-10"><button className="primary-cta w-full" onClick={finishStep}>{isStatic?"FINISH EXERCISE NOW":`DONE · ${reps||targetReps} REPS`}</button><button className="mt-3 min-h-11 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-[9px] font-bold tracking-[.12em] text-zinc-500" onClick={skipStep}>SKIP EXERCISE</button><div className="mt-6 rounded-xl border border-line bg-panel2 p-3 text-center text-[9px] font-bold tracking-[.12em] text-zinc-500">{nextName?`NEXT EXERCISE · ${nextName.toUpperCase()}`:"FINAL EXERCISE · FINISH STRETCHING"}</div></div>
   </div></div>
   {confirmSkipAll&&<div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"><div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-panel p-5"><div className="eyebrow">SKIP MOBILITY</div><h3 className="mt-2 text-xl font-extrabold">Skip the whole routine?</h3><p className="mt-2 text-xs leading-5 text-muted">Your choice will still be logged, but the remaining exercises will not be performed.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setConfirmSkipAll(false)}>KEEP ROUTINE</button><button className="primary-cta" onClick={skipAll}>SKIP ALL</button></div></div></div>}
 </div>
}

function download(text:string,name:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)}

createRoot(document.getElementById("root")!).render(<App/>);
