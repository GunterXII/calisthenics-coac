
import {useEffect,useRef,useState,type FormEvent} from "react";
import {createRoot} from "react-dom/client";
import {ArrowLeft,Download,Minus,Play,Plus,Upload,LogOut,RefreshCw,ChevronUp,ChevronDown,Trash2,PlusCircle,History,MessageSquare,RotateCcw,Volume2,VolumeX,CalendarDays,ListChecks,BarChart3,Settings2,Timer,CheckCircle2} from "lucide-react";
import {BAND_OPTIONS,PROGRAM,PROGRESSIONS,getProgressionLadder} from "./program";
import {EXERCISE_CATALOG,type ExerciseCatalogItem} from "./exercises";
import {POST_WORKOUT_MOBILITY,type MobilityExercise} from "./mobility";
import {exerciseExposureKeyString} from "./types";
import {RIR_OPTIONS,FATIGUE_OPTIONS,rirLabel,fatigueLabel} from "./athleteEffort";
import type {Band,BlockKind,BlockStatus,DayKey,DayProgram,ExerciseBlock,SessionSummary,WorkoutLog,MobilitySession,MobilityLog,Readiness,PrescriptionSnapshot} from "./types";
import {supabaseConfigured, supabase} from "./lib/supabase";
import {getSession, signInWithPassword, signUpWithPassword, resetPassword, signOut, syncLocalSessions, uploadWorkoutSession, syncProgramLayer, uploadMobilitySession, syncMobilitySessions, fetchExerciseCatalog, fetchMyProfile, fetchCoachAthletes, fetchCoachAthleteProgram, fetchCoachAthleteSessions, fetchCoachAthleteAudit, fetchCoachNotes, createCoachNote, coachRecordDecision, fetchAthleteCoachingProfile, saveAthleteCoachingProfile, fetchMyCoachingProfile, saveMyCoachingProfile, fetchProgramLayer, coachAddProgramBlock, coachDeleteProgramBlock, coachReorderProgramDay, coachPromoteSkillRung, getMyCoachCode, saveCoachProgramBlock, resetCoachProgramBlock, linkMyAthleteAccountToCoach, fetchMyCoach, unlinkMyCoach, type UserProfile, type CoachAthlete, type AthleteCoachingProfile} from "./lib/backend";
import {buildSkillGraphViews, type SkillGraphView} from "./skillGraph";
import {trainingProfileForBlock} from "./trainingModel";
import {weeklyWorkload, analyzeRecoveryForBlocks, pretty, type RecoveryStatus} from "./workloadEngine";
import {validateProgramWeek, type ProgramValidationReport} from "./programValidation";
import {appendLogs,emomStats,exportBackup,formatClock,getDraft,getLogs,getSessions,getSetting,getTarget,getTodayTarget,setTodayTarget,getVariant,importBackup,latestLog,latestSession,makeSessionReport,makeWeeklyReport,replaceSession,saveMobilitySession,saveDraft,clearDraft,saveSession,setSetting,setTarget,setVariant,getProgramOverrides,getProgramOverride,setProgramOverride,restoreProgramOverride,clearProgramOverride,clearAllProgramOverrides,getPeriodizationCycleStart,getCoachDecisions,saveCoachDecision,makeCoachHandoff,getEmomDuration,setEmomDuration,getCoachProposals,saveCoachProposal,updateCoachProposal,acceptCoachProposalAtomically,getCoachExperiments,type CoachProposal} from "./storage";
import {analyzeSkillIntelligence,type SkillInsight} from "./skillIntelligence";
import {analyticsIntelligence,analyticsSummary,clearAnalytics,exportAnalytics,track,trackScreen} from "./analytics";
import {evaluateProgression,criteriaForBlock,variantMasteryCriteria,progressionStreak,qualityIsKnown,analyzeReadiness,nextTargetFromSpec,progressionSpecForBlock,decideExposure,isSamePrescription} from "./coachingEngine";
import {decideSessionExercises, type ExerciseCoachDecision} from "./coachEngineV2";
import {buildPeriodizedDay} from "./programBuilder";
import {buildAdaptivePeriodizedDay} from "./adaptiveProgramEngine";
import {runPostSessionCoachLoop, coachLoopPriority} from "./coachLoopEngine";
import {buildCoachContext} from "./coachAdvisorEngine";
import {runProductionCoachCycle} from "./productionCoachEngine";
import {defaultPeriodizationCycle, phaseForCycleWeek, resolveAdaptivePhase} from "./periodizationEngine";
import {analyzeAllGoals,type GoalPerformanceSnapshot} from "./goalAnalyticsEngine";
import {shouldRestAfterStandardSet,shouldRestAfterSideSet,totalSessionReps} from "./workoutEngine";
import {CoachPanel} from "./coachAiPanel";
import {createExperimentFromProposal, reviewActiveExperiments, experimentDecisionLabel, rollbackExperiment} from "./coachExperimentEngine";
import {dayLabel, phaseLabel, t} from "./i18n";
import {proposeDensityRestProgression} from "./methodAwareCoaching";
import {displayBlockDetail,coachNoteForBlock} from "./prescriptionText";
import {workoutFlowCopy, recommendedEndAction} from "./workoutFlow";
import {buildCoachWeeklyReport,formatCoachWeeklyReport} from "./coachWeeklyIntelligence";
import "./styles.css";

const DAYS:DayKey[]=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LABEL:Record<BlockKind,string>={HANDSTAND:"HANDSTAND",SKILL_STATIC:"SKILL",SKILL_REPS:"SKILL",VOLUME_SKILL:"SKILL VOLUME",PERFORMANCE:"PERFORMANCE",EMOM:"EMOM",ACCESSORY:"ACCESSORY",CORE:"CORE"};

// Presentation-only copy normalization. Stored prescriptions and engine values remain untouched.
function uiCopy(value:string|undefined){
  if(!value)return "";
  return value
    .replace(/\bV16 ACCUMULATION\b/g,"ACCUMULO")
    .replace(/\bV16\b/g,"")
    .replace(/Phase-priority exposure/gi,"Priorità della fase")
    .replace(/Coach: reduce volume/gi,"Coach: volume ridotto")
    .replace(/use the current progression rung/gi,"usa la progressione attuale")
    .replace(/controlled full ROM/gi,"ROM completo e controllato")
    .replace(/controlled depth/gi,"profondità controllata")
    .replace(/strict ROM/gi,"ROM rigoroso")
    .replace(/strict lockout/gi,"lockout rigoroso")
    .replace(/progress band when the top of the range is repeatable/gi,"progressione della loop quando il limite alto è ripetibile")
    .replace(/progress total reps without chasing failure/gi,"aumenta le reps totali senza inseguire il cedimento")
    .replace(/Week (\d+)\/(\d+)/gi,"Settimana $1/$2")
    .replace(/\s{2,}/g," ")
    .trim();
}

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
     <div className="eyebrow">ALLENAMENTO IN CORSO</div>
     <h2 className="mt-2 text-2xl font-extrabold">{p.title}</h2>
     <p className="mt-2 text-xs text-muted">Allenamento non terminato · {new Date(draft.startedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>
     <div className="mt-4 rounded-xl border border-line bg-panel2 p-3 text-[10px] text-zinc-400">
       Progresso · {Math.max(0,draft.index+1)} / {blockCount}
     </div>
     <div className="mt-5 grid grid-cols-2 gap-2">
       <button className="secondary-cta" onClick={onDiscard}>ELIMINA</button>
       <button className="primary-cta" onClick={onResume}>RIPRENDI</button>
     </div>
   </div>
 </div>
}

function cloneEffectiveBlock(day:DayKey,base:ExerciseBlock):ExerciseBlock{
 const o=getProgramOverride(base.id);
 return o?{...base,...o,kind:(o.kind as BlockKind)||base.kind,bandOptions:o.bandOptions as Band[]||base.bandOptions,defaultBand:(o.defaultBand as Band)||base.defaultBand}:base;
}
const PERIODIZATION_CYCLE=defaultPeriodizationCycle();
const PERIODIZATION_DAY_MS=7*86400000;
function currentAbsoluteWeek(now=Date.now()){
 const start=getPeriodizationCycleStart();
 const elapsed=Math.max(0,now-start);
 return ((Math.floor(elapsed/PERIODIZATION_DAY_MS)) % PERIODIZATION_CYCLE.totalWeeks) + 1;
}
function currentPhase(now=Date.now()){
 try{
   const raw=JSON.parse(localStorage.getItem('cc-v17-phase-override')||'null');
   return resolveAdaptivePhase(PERIODIZATION_CYCLE,getPeriodizationCycleStart(),raw,now);
 }catch{}
 return phaseForCycleWeek(PERIODIZATION_CYCLE,currentAbsoluteWeek(now));
}
function effectiveProgram(day:DayKey){
 const phase=currentPhase();
 const generated=buildAdaptivePeriodizedDay(phase,day,["oap","flpu","front_lever_touch","pushups","dips"],getSessions());
 return {...generated.program,blocks:generated.program.blocks.map(b=>cloneEffectiveBlock(day,b))};
}

function prescriptionSnapshot(block:ExerciseBlock, todayTarget?:number):PrescriptionSnapshot{
 const variant=getVariant(block.id);
 const override=getProgramOverride(block.id);
 const profile=trainingProfileForBlock(block);
 const variantId=override?.variantId||variant?.variantId||block.id;
 const variantName=currentVariantFor(block.id,block.name);
 return {
   version:1,
   exerciseId:block.id,
   variantId,
   variantName,
   name:block.name,
   kind:block.kind,
   targetRange:block.target,
   todayTarget,
   sets:block.sets,
   minutes:block.minutes,
   restSec:block.rest||0,
   bandOptions:block.bandOptions,
   defaultBand:block.defaultBand,
   progressionMode:profile.progressionMode,
   trainingMethod:block.trainingMethod,
   densityProtocol:block.densityProtocol,
   progressionSpecId:block.progressionSpecId,
   fatigueCost:profile.fatigueCost,
   muscleGroups:profile.muscleGroups,
   effectiveSetWeight:profile.effectiveSetWeight,
   gripDemand:profile.gripDemand,
   capturedAt:Date.now(),
 };
}

function effectiveTodayTarget(block:ExerciseBlock, rangeValue:{min:number;max:number}){
 if(block.trainingMethod==="DENSITY_5X70") return rangeValue.max;
 const overrideUpdatedAt=getProgramOverride(block.id)?.updatedAt||0;
 return getTodayTarget(block.id,rangeValue.max,rangeValue.min,rangeValue.max,overrideUpdatedAt);
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
function weeklyCoachChanges(day:DayKey){
 const now=new Date(); const weekStart=new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
 const ids=new Set(effectiveProgram(day).blocks.map(b=>b.id));
 return getCoachProposals()
   .filter(p=>p.status==="accepted" && p.date>=weekStart.getTime() && ids.has(p.exerciseId))
   .sort((a,b)=>b.date-a.date)
   .map(p=>({id:p.id,name:p.title||p.exerciseId,before:p.oldValue||p.from,after:p.newValue||p.to,reason:p.reason}))
   .slice(0,6);
}

function Plan({day,setDay,refresh,remoteCatalog}:{day:DayKey;setDay:(x:DayKey)=>void;refresh:number;remoteCatalog:ExerciseCatalogItem[]}){
 const p=effectiveProgram(day),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState(""),[undo,setUndo]=useState<(()=>void)|null>(null);
 const overrides=getProgramOverrides(),catalog=exerciseCatalog(remoteCatalog),[coachLinked,setCoachLinked]=useState(false);
 useEffect(()=>{fetchMyCoach().then(c=>setCoachLinked(Boolean(c))).catch(()=>setCoachLinked(false))},[refresh]);
 const showNotice=(msg:string,undoFn?:()=>void)=>{setEditing(null);setNotice(msg);setUndo(()=>undoFn||null);setTimeout(()=>setNotice(""),3500)};
 return <div className="plan-screen">
  <div className="eyebrow">PIANO</div>
  <div className="mt-2 flex items-end justify-between gap-4"><div><h1>Il tuo programma.</h1><p className="sub mt-2">{coachLinked?"Il Coach gestisce la progressione.":"Il piano completo della tua settimana."}</p></div>{!coachLinked&&<button className="secondary-cta shrink-0" onClick={()=>{const snapshot=getProgramOverrides();clearAllProgramOverrides();syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));showNotice("PROGRAMMA RIPRISTINATO AI DEFAULT",()=>{Object.values(snapshot).forEach((o:any)=>setProgramOverride(o.exerciseId,o));syncProgramLayer().catch(err=>console.warn("Program sync deferred.",err));})}}>RIPRISTINA</button>}</div>
  <div className="plan-week-nav mt-6"><div className="section-kicker">SETTIMANA</div><div className="mt-2 grid grid-cols-7 gap-1">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} aria-label={`Mostra ${dayLabel(d)}`} className={`day-pill ${day===d?"day-pill-active":""}`}><span>{d.slice(0,3).toUpperCase()}</span></button>)}</div></div>
  <div className="mt-5"><ProgramValidationCard refresh={refresh}/></div>
  <div className="plan-day-header mt-7"><div><div className="section-kicker">{p.title}</div><h2 className="mt-1 text-2xl font-extrabold tracking-tight">{uiCopy(p.subtitle)}</h2></div><div className="plan-count"><strong>{p.blocks.length}</strong><span>ESERCIZI</span></div></div>
  {notice&&<div className="mb-3 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] text-emerald-300"><span>{notice}</span>{undo&&<button className="text-[9px] font-bold tracking-[.1em] text-white underline" onClick={()=>{undo();setUndo(null);setNotice("MODIFICA ANNULLATA")}}>ANNULLA</button>}</div>}
  <div className="mt-3 grid gap-2">{p.blocks.map((b,i)=><div key={b.id} className={`plan-exercise-row rounded-2xl border border-line bg-panel p-4 ${overrides[b.id]?"is-customized":""}`}>
   <div className="flex items-start gap-3"><div className="plan-exercise-number">{String(i+1).padStart(2,"0")}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="tag">{LABEL[b.kind]}</span><strong className="mt-1 block text-[15px] leading-tight">{currentVariantFor(b.id,b.name)}</strong></div>{!coachLinked&&<button className="mini-btn shrink-0" aria-label={`Modifica ${b.name}`} onClick={()=>{track("program_edit_opened",{exerciseId:b.id,day});setNotice("");setEditing(b.id)}}>⋯</button>}</div>
    <div className="mt-3 flex flex-wrap gap-2"><span className="prescription-chip">{b.kind==="EMOM"?`${b.minutes||10} MIN`:b.sets?`${b.sets} × ${b.target}`:b.target}</span>{b.rest? <span className="prescription-chip">{b.rest}s REST</span>:null}{overrides[b.id]&&<span className="prescription-chip prescription-chip-accent">PERSONALIZZATO</span>}</div>
    {b.detail&&<p className="mt-2 text-[10px] leading-5 text-zinc-500">{displayBlockDetail(b,uiCopy)}</p>}{coachNoteForBlock(b,uiCopy)&&<div className="mt-2 text-[9px] font-bold tracking-[.06em] text-violet2"><span className="text-zinc-600">COACH · </span>{coachNoteForBlock(b,uiCopy)}</div>}
   </div></div>
   {editing===b.id&&<ProgramEditor block={b} catalog={catalog} onClose={()=>setEditing(null)} onSaved={(undoFn)=>showNotice("PROGRAMMA SALVATO · PROSSIMA SESSIONE AGGIORNATA",undoFn)}/>}</div>)}</div>
  <div className="mt-6 rounded-2xl border border-line bg-panel2 p-3 text-[9px] leading-5 text-zinc-600">Il piano mostra la prescrizione attuale. Le modifiche del Coach o le personalizzazioni future vengono evidenziate qui senza alterare la cronologia.</div>
 </div>;
}
function effectiveProgramMap(){return DAYS.reduce((acc,d)=>{acc[d]=effectiveProgram(d);return acc;},{} as Record<DayKey,DayProgram>)}

function ProgramValidationCard({refresh}:{refresh:number}){
 const report:ProgramValidationReport=validateProgramWeek(effectiveProgramMap());
 const [expanded,setExpanded]=useState(false);
 const scoreTone=report.severity==="OK"?"text-emerald-300":report.severity==="WATCH"?"text-amber-300":"text-rose-300";
 const signals=report.signals.slice(0,expanded?8:3);
 const severityLabel=report.severity==="OK"?"SETTIMANA OK":report.severity==="WATCH"?"DA MONITORARE":"ATTENZIONE";
 const signalSeverity=(severity:string)=>severity==="HIGH"?"ATTENZIONE":severity==="WATCH"?"DA MONITORARE":"OK";
 const signalTone=(severity:string)=>severity==="HIGH"?"text-rose-300":severity==="WATCH"?"text-amber-300":"text-emerald-300";
 const signalKind=(kind:string)=>({VOLUME:"VOLUME",SEQUENCING:"SEQUENZA",RECOVERY:"RECUPERO",OVERLAP:"SOVRAPPOSIZIONE",GRIP:"PRESA"}[kind]||kind);
 const signalTitle=(title:string)=>title.replace(/has a dense workload/gi,"ha un carico di lavoro elevato").replace(/stacks high-cost primary work/gi,"concentra lavoro principale ad alta richiesta").replace(/high demand/gi,"alta richiesta");
 return <section className="plan-health-card mb-5 rounded-3xl border border-line bg-panel p-4 sm:p-5">
  <div className="flex items-start justify-between gap-4">
   <div className="min-w-0">
    <div className="section-kicker">CONTROLLO DELLA SETTIMANA</div>
    <h2 className="mt-1 text-xl font-extrabold tracking-tight">La settimana è pronta?</h2>
    <p className="mt-2 max-w-xl text-[10px] leading-5 text-zinc-500">Il Coach controlla carico, recupero e sovrapposizione degli stimoli prima che tu inizi. Non è un voto da inseguire: serve a evidenziare dove prestare attenzione.</p>
   </div>
   <div className="plan-health-score shrink-0 text-right"><div className={`text-3xl font-black tabular-nums ${scoreTone}`}>{report.score}</div><div className={`mt-1 text-[8px] font-extrabold tracking-[.12em] ${scoreTone}`}>{severityLabel}</div></div>
  </div>
  <div className="mt-5 grid gap-2">
   {signals.length?signals.map((s,i)=><div key={`${s.kind}-${s.title}-${i}`} className="plan-health-row rounded-2xl border border-line bg-panel2 p-3">
    <div className="flex items-center justify-between gap-3"><span className={`text-[8px] font-extrabold tracking-[.12em] ${signalTone(s.severity)}`}>{signalSeverity(s.severity)}</span><span className="text-[8px] font-bold tracking-[.1em] text-zinc-600">{signalKind(s.kind)}</span></div>
    <div className="mt-1 text-[11px] font-extrabold text-zinc-200">{signalTitle(s.title)}</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">{s.detail}</p>
   </div>):<div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-3 text-[10px] text-emerald-300">Nessun punto critico rilevato. Puoi seguire il programma come previsto.</div>}
  </div>
  {report.signals.length>0&&<button className="secondary-cta mt-3 w-full" onClick={()=>{setExpanded(v=>!v);track("program_validation_toggled",{expanded:!expanded,signals:report.signals.length})}}>{expanded?"MOSTRA MENO":`MOSTRA TUTTI GLI AVVISI · ${report.signals.length}`}</button>}
  <div className="mt-3 rounded-2xl border border-line bg-ink/40 px-3 py-2 text-[8px] leading-4 text-zinc-600">Il controllo è informativo. Un avviso non modifica automaticamente il tuo programma.</div>
 </section>;
}
function CoachLinkCard({onLinked}:{onLinked:()=>void}){
 const [coach,setCoach]=useState<CoachAthlete|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 useEffect(()=>{fetchMyCoach().then(setCoach).catch(()=>setCoach(null))},[]);
 const link=async()=>{if(!code.trim())return;setBusy(true);setMsg('');try{await linkMyAthleteAccountToCoach(code);const next=await fetchMyCoach();if(!next)throw new Error('COACH LINK CREATED BUT COACH COULD NOT BE LOADED');setCoach(next);setMsg('COACH COLLEGATO — FUTURE PROGRAM CHANGES WILL SYNC HERE.');onLinked();}catch(e:any){setMsg(e?.message||'COACH LINK FAILED')}finally{setBusy(false)}};
 const unlink=async()=>{if(!coach)return;setBusy(true);setMsg('');try{await unlinkMyCoach(coach.id);setCoach(null);clearAllProgramOverrides();setMsg('COACH DISCONNECTED. YOUR LOCAL PROGRAM IS NOW ATHLETE-CONTROLLED.');}catch(e:any){setMsg(e?.message||'COACH DISCONNECT FAILED')}finally{setBusy(false)}};
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="section-kicker">COLLEGAMENTO COACH</div>{coach?<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-extrabold">{coach.display_name||'Il tuo Coach'}</div><div className="mt-1 text-[9px] text-zinc-600">COLLEGATO {new Date(coach.linked_at).toLocaleDateString()}</div></div><button className="secondary-cta" disabled={busy} onClick={unlink}>{busy?'IN CORSO…':'SCOLLEGA COACH'}</button></div>:<><p className="mt-2 text-[10px] leading-5 text-zinc-500">Chiedi al tuo Coach di inviarti il codice di 10 caratteri. Il collegamento non modifica la cronologia degli allenamenti.</p><div className="mt-3 flex gap-2"><input className="flex-1 rounded-xl border border-line bg-panel2 p-3 font-mono text-sm uppercase tracking-[.18em]" maxLength={10} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="CODICE COACH"/><button className="primary-cta" disabled={busy||code.length!==10} onClick={link}>{busy?'LINKING…':'LINK'}</button></div></>}{msg&&<div className={`mt-2 text-[9px] ${msg.includes('FAILED')?'text-rose-300':'text-emerald-300'}`}>{msg}</div>}</div>;
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
  <div className="flex items-center justify-between"><div className="field-label">EDIT PRESCRIPTION</div><button className="text-[9px] font-bold text-zinc-600" onClick={onClose}>CHIUDI</button></div>
  <label className="mt-3 block"><span className="field-label">ESERCIZIO / VARIANTE</span><select value={catalogId} onChange={e=>choose(e.target.value)}>{compatible.map(x=><option key={x.id} value={x.id}>{x.name}{x.difficulty?` · D${x.difficulty}`:""}</option>)}</select><span className="mt-1 block text-[8px] text-zinc-600">Movimenti compatibili per skill o schema di movimento.</span></label>
  {kind==="EMOM" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3"><span className="field-label">DURATA EMOM</span><div className="mt-2 flex items-center gap-2"><button className="mini-btn" disabled={Number(minutes)<=5} onClick={()=>setMinutesLocal(String(Math.max(5,(Number(minutes)||10)-1)))}><Minus size={14}/></button><input className="w-full rounded-xl border border-line bg-panel2 p-3 text-center font-extrabold outline-none" inputMode="numeric" value={minutes} onChange={e=>setMinutesLocal(e.target.value.replace(/\D/g,""))}/><button className="mini-btn" disabled={Number(minutes)>=15} onClick={()=>setMinutesLocal(String(Math.min(15,(Number(minutes)||10)+1)))}><Plus size={14}/></button></div><div className="mt-1 text-[8px] text-zinc-600">5–15 minutes · changes future sessions only</div></div><Field label="TARGET / MIN" value={target} set={setTargetLocal} placeholder="8–10"/></div> : <div className="mt-3 grid gap-2 sm:grid-cols-3"><Field label="SERIE" value={sets} set={setSets} placeholder="3"/><Field label="TARGET" value={target} set={setTargetLocal} placeholder="8–10"/><Field label="RECUPERO (S)" value={rest} set={setRestLocal} placeholder="90"/></div>}
  {kind==="EMOM"&&<div className="mt-2 text-[8px] text-zinc-600">Il recupero è automatico in ogni minuto; il recupero indicato non viene usato dal timer EMOM.</div>}
  {(currentCatalog?.bandOptions||block.bandOptions||[]).length>0&&<div className="mt-3"><BandSelect label="DEFAULT LOOP" value={band} set={setBand} options={(currentCatalog?.bandOptions||block.bandOptions||[]) as string[]}/></div>}
  <label className="mt-3 block"><span className="field-label">NOTA DEL COACH</span><input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Indicazione facoltativa"/></label>
  <div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={reset}>RIPRISTINA</button><button className="primary-cta" onClick={save}>SALVA MODIFICHE</button></div>
  <div className="mt-2 text-[8px] leading-4 text-zinc-600">Vale solo per le sessioni future. La cronologia resta invariata.</div>
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
 if(Number.isFinite(pain)&&pain>=4) decisions.push({level:"RED",title:"PAIN LOAD",detail:`Il dolore articolare riportato più di recente è ${pain}/5. Evita di aumentare l’intensità finché il quadro non viene revisionato.`,action:"REVIEW / DELOAD"});
 else if(Number.isFinite(pain)&&pain>=3) decisions.push({level:"YELLOW",title:"JOINT LOAD",detail:`Il dolore articolare riportato più di recente è ${pain}/5. Mantieni la prescrizione attuale e monitora la prossima sessione.`,action:"HOLD LOAD"});
 if(Number.isFinite(energy)&&energy<=2) decisions.push({level:"YELLOW",title:"LOW READINESS",detail:`L’energia è ${energy}/5. Una progressione intensa oggi non è giustificata dalla sola prontezza.`,action:"KEEP CURRENT"});
 if(Number.isFinite(sleep)&&sleep<6) decisions.push({level:"YELLOW",title:"SLEEP DEBT",detail:`Il sonno più recente è ${sleep}h. Non interpretare una sessione debole come una perdita di abilità.`,action:"KEEP / MONITOR"});
 const totals=ordered.map(s=>Number(s?.total_reps||0)).filter(Number.isFinite);
 if(totals.length>=3){
   const recent=totals.slice(0,3), older=totals.slice(3,6);
   const r=recent.reduce((a,b)=>a+b,0)/recent.length;
   const o=older.length?older.reduce((a,b)=>a+b,0)/older.length:0;
   if(o>0&&r<o*.8) decisions.push({level:"YELLOW",title:"VOLUME DROP",detail:`Il volume medio recente è ${Math.round(r)} reps rispetto a ${Math.round(o)} in precedenza.`,action:"REVIEW FATIGUE"});
   else if(o>0&&r>o*1.15) decisions.push({level:"GREEN",title:"VOLUME TREND",detail:`Il volume medio recente è ${Math.round(r)} reps rispetto a ${Math.round(o)} in precedenza.`,action:"PROGRESSOION CANDIDATE"});
 }
 const recentDays=new Set(ordered.slice(0,7).map(s=>String(s?.day||""))).size;
 if(ordered.length>=5) decisions.push({level:"GREEN",title:"ADHERENCE",detail:`${ordered.length} recent completed sessions are available for review across ${recentDays} training days.`,action:"DATA SUFFICIENT"});
 const blocks=program?.blocks||[];
 if(!decisions.length) decisions.push({level:"GREEN",title:"STABLE",detail:`Non emerge alcun segnale negativo importante dai dati più recenti disponibili.`,action:"KEEP PLAN"});
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
function CoachTimeline({sessions,program}:{sessions:any[];program:any}){const rows=coachTimelineRows(sessions,program);return <div className="mt-5 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">STORICO ATLETA</div><div className="mt-1 text-[9px] text-zinc-500">Ultime esposizioni, miglior risultato e direzione recente.</div></div><span className="tag">ULTIME 6</span></div>{!rows.length?<div className="mt-3 text-xs text-zinc-600">Non ci sono ancora abbastanza dati sugli esercizi.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">{rows.map((r:any)=><div key={r.id} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] text-zinc-600">{r.exposures} EXPOSURES</div><div className="mt-1 text-sm font-extrabold">{r.name}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${r.signal==="PROGRESSING"?"text-emerald-400":r.signal==="REGRESSING"?"text-amber-300":"text-violet2"}`}>{r.signal}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><div><div className="field-label">ULTIMO</div><div className="mt-1 text-sm font-bold">{r.latest.toFixed(r.unit==="s"?1:0)} <span className="text-[8px] text-zinc-600">{r.unit}</span></div></div><div><div className="field-label">MIGLIORE</div><div className="mt-1 text-sm font-bold">{r.best.toFixed(r.unit==="s"?1:0)} <span className="text-[8px] text-zinc-600">{r.unit}</span></div></div><div><div className="field-label">VARIAZIONE</div><div className="mt-1 text-sm font-bold">{r.exposures>1?`${r.delta>=0?"+":""}${r.delta.toFixed(0)}%`:"—"}</div></div></div></div>)}</div>}</div>}

function SkillIntelligencePanel({insights}:{insights:SkillInsight[]}){
 const color=(d:SkillInsight["decision"])=>d==="PROGRESS"?"text-emerald-400":d==="REGRESS"?"text-rose-400":d==="REVIEW"?"text-amber-300":d==="HOLD"?"text-violet2":"text-zinc-500";
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
  <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">INTELLIGENZA SKILL</div><div className="mt-1 text-[9px] text-zinc-500">Motore di progressione basato sui dati: qualificazioni consecutive, qualità, recupero e fatica.</div></div><span className="tag">MOTORE COACH</span></div>
  {!insights.length?<div className="mt-3 text-xs text-zinc-600">Non ci sono ancora abbastanza dati sulle skill.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">
   {insights.slice(0,10).map(x=><div key={x.id} className="rounded-xl border border-line bg-panel p-3">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{x.skill} · {x.dataQuality} DATA</div><div className="mt-1 text-sm font-extrabold">{x.name}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${color(x.decision)}`}>{x.decision}</span></div>
    <div className="mt-3 grid grid-cols-3 gap-2"><div><div className="field-label">ULTIMO</div><div className="mt-1 text-xs font-bold">{x.latest}</div></div><div><div className="field-label">MIGLIORE</div><div className="mt-1 text-xs font-bold">{x.best.toFixed(x.unit==="s"?1:0)} {x.unit}</div></div><div><div className="field-label">QUALIFY</div><div className="mt-1 text-xs font-bold">{x.qualifyingStreak}/2</div></div></div>
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
 const tone=(s:string)=>s==="PRONTO"?"text-emerald-400":s==="ATTUALE"?"text-violet2":s==="LOCKED"?"text-amber-300":"text-zinc-600";
 return <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
  <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">PERCORSO SKILL</div><div className="mt-1 text-[9px] text-zinc-500">Percorso meccanico + verifica sui dati. PRONTO significa che il livello attuale ha superato i criteri; la promozione richiede comunque la conferma del Coach.</div></div><span className="tag">PERCORSI</span></div>
  <div className="mt-3 grid gap-2 lg:grid-cols-2">{views.map(v=><div key={v.id} className="rounded-xl border border-line bg-panel p-3">
   <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-extrabold">{v.name}</div><div className="mt-1 text-[8px] text-zinc-600">{v.completion}% pathway mapped</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${tone(v.status)}`}>{v.status}</span></div>
   <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">{v.nodes.map((n,i)=><div key={n.id} className={`min-w-[92px] rounded-lg border px-2 py-2 ${i===v.currentIndex?"border-violet-500/40 bg-violet-500/10":"border-line bg-panel2"}`}><div className="text-[8px] font-bold">{i+1}. {n.name}</div><div className="mt-1 text-[7px] text-zinc-600">D{n.difficulty}</div></div>)}</div>
   <div className="mt-3 rounded-lg bg-panel2 p-2 text-[9px] leading-4 text-zinc-500">{v.note}</div>
   {v.next&&<div className="mt-2 flex items-center justify-between gap-2"><div><span className="text-[8px] font-bold tracking-[.1em] text-violet2">PROSSIMO LIVELLO</span><div className="text-[9px] font-bold">{v.next.name}</div></div>{v.status==="READY"&&<button className="primary-cta shrink-0 !py-2" onClick={()=>onPromote(v)}>REVISIONA PROMOZIONE</button>}</div>}
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
   ...insights.filter((x:any)=>x.decision==="PROGRESS"||x.decision==="REGRESS"||x.decision==="REVIEW").map((x:SkillInsight)=>({id:x.exerciseId,type:"SKILL",title:x.name,detail:`${x.why} · Confidenza ${x.confidence}% · ${x.exposures} esposizioni`,action:x.action,level:x.level}))
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
     <div><div className="section-kicker">CENTRO DECISIONI COACH</div><div className="mt-1 text-[9px] text-zinc-500">Controlla la raccomandazione, registra la decisione del Coach e conserva la motivazione.</div></div>
     <span className="tag">DECISIONE COACH</span>
   </div>{decisionError&&<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[9px] text-rose-300">{decisionError}</div>}
   {!rows.length?<div className="mt-3 text-xs text-zinc-600">Nessuna decisione da revisionare.</div>:<div className="mt-3 grid gap-2 lg:grid-cols-2">
    {rows.slice(0,8).map((r:any)=>{
      const status=resolved[r.id];
      return <div key={r.id} className="rounded-xl border border-line bg-panel p-3">
       <div className="flex items-start justify-between gap-2"><div><span className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{r.type}</span><div className="mt-1 text-[11px] font-extrabold">{r.title}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${r.level==="RED"?"text-rose-400":r.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{r.level}</span></div>
       <div className="mt-2 text-[9px] leading-4 text-zinc-500">{r.detail}</div>
       <div className="mt-2 rounded-lg bg-panel2 p-2 text-[8px] font-bold tracking-[.1em] text-violet2">RACCOMANDAZIONE · {r.action}</div>
       {status?<div className={`mt-2 rounded-lg p-2 text-[9px] font-bold ${status==="accepted"?"bg-emerald-500/10 text-emerald-300":"bg-rose-500/10 text-rose-300"}`}>{status.toUpperCase()} · DECISION RECORDED</div>:
       open===r.id?<div className="mt-3">
        <textarea value={reason[r.id]||""} onChange={e=>setReason(v=>({...v,[r.id]:e.target.value}))} className="min-h-16 w-full rounded-lg border border-line bg-panel2 p-2 text-[9px]" placeholder="Why are you accepting or rejecting this recommendation?"/>
        <div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>resolve(r,"rejected")}>RIFIUTA</button><button className="primary-cta" onClick={()=>resolve(r,"accepted")}>ACCETTA</button></div>
       </div>:<button className="secondary-cta mt-3 w-full" onClick={()=>setOpen(r.id)}>REVEDI DECISION</button>}
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
   <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">DASHBOARD PERFORMANCE ATLETA</div><div className="mt-1 text-[9px] text-zinc-500">Sintesi per il Coach: performance, costanza, recupero e carico.</div></div><span className="tag">ULTIME 6</span></div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">ESPOSIZIONI</div><div className="mt-1 text-xl font-extrabold">{logs.length}</div><div className="mt-1 text-[8px] text-zinc-600">esposizioni registrate</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">VOLUME</div><div className="mt-1 text-xl font-extrabold">{totalReps}</div><div className="mt-1 text-[8px] text-zinc-600">reps · last 6 sessions</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">READINESS</div><div className="mt-1 text-xl font-extrabold">{energy?energy.toFixed(1):"—"}<span className="text-[9px] text-zinc-600"> / 5</span></div><div className="mt-1 text-[8px] text-zinc-600">energia media · sonno {sleep?sleep.toFixed(1):"—"}h</div></div>
    <div className="rounded-xl border border-line bg-panel p-3"><div className="field-label">CARICO ARTICOLARE</div><div className="mt-1 text-xl font-extrabold">{pain||"—"}<span className="text-[9px] text-zinc-600"> / 5</span></div><div className="mt-1 text-[8px] text-zinc-600">massimo gomito/polso · ultime 6</div></div>
   </div>
   <div className="mt-3 grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border border-line bg-panel p-4"><div className="section-kicker">SKILL LEADERS</div><div className="mt-3 space-y-2">{best.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 p-2"><div><div className="text-[10px] font-bold">{r.name}</div><div className="text-[8px] text-zinc-600">{r.exposures} exposures · best {r.best.toFixed(r.unit==="s"?1:0)} {r.unit}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${status(r)}`}>{r.signal}</span></div>)}{!best.length&&<div className="text-xs text-zinc-600">Non ci sono ancora abbastanza dati sulla performance.</div>}</div></div>
    <div className="rounded-xl border border-line bg-panel p-4"><div className="section-kicker">STATO COACH</div><div className="mt-3 space-y-2">{decisions.slice(0,5).map((d:any,i:number)=><div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 p-2"><div><div className="text-[10px] font-bold">{d.title}</div><div className="text-[8px] text-zinc-600">{d.action}</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${d.level==="RED"?"text-rose-400":d.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{d.level}</span></div>)}{!decisions.length&&<div className="text-xs text-zinc-600">Nessun segnale attivo.</div>}</div></div>
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
 const addBlock=async(item:ExerciseCatalogItem)=>{const id=`${item.id}__${Date.now()}`;try{await coachAddProgramBlock({athleteId:selected,exerciseId:id,day,catalogExerciseId:item.id,name:item.name,kind:toUiKind(item),detail:item.detail||"",target:item.defaultTarget||"",sets:item.kind==="HOLD"?3:3,rest:item.restSec||90,bandOptions:item.equipment.includes("band")?BAND_OPTIONS.filter(x=>x!=="None"):undefined,sortOrder:effective.blocks.length,reason:"Coach added a prepared catalog exercise"});setShowAdd(false);await refreshAthlete();setSaved(`${item.name.toUpperCase()} ADDED TO ${day.toUpperCase()}`);}catch(e:any){setError(e?.message||"AGGIUNTA FALLITA")}};
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
 const saveProfile=async()=>{if(!selected||!profileDraft)return;setProfileSaving(true);setError("");try{const saved=await saveAthleteCoachingProfile(selected,profileDraft);setCoachingProfile(saved);setProfileDraft(saved);setSaved("PROFILO ATLETA SALVATO");setTimeout(()=>setSaved(""),2500);}catch(e:any){setError(e?.message||"PROFILE SAVE FAILED")}finally{setProfileSaving(false)}};
 const copyCoachCode=async()=>{if(!coachCode)return;try{await navigator.clipboard.writeText(coachCode);setSaved("COACH CODE COPIATO");setTimeout(()=>setSaved(""),1800)}catch{setError("COACH CODE COPY FAILED — COPY IT MANUALLY")}};
 const saveNote=async()=>{if(!noteBody.trim())return;try{await createCoachNote({athleteId:selected,title:noteTitle,body:noteBody,priority:notePriority,athleteVisible:noteVisible});setNoteTitle("");setNoteBody("");await refreshAthlete();setSaved("NOTE SAVED");}catch(e:any){setError(e?.message||"NOTE SAVE FAILED")}};
 if(loading&&!athletes.length)return <div className="py-20 text-center"><div className="eyebrow">COACH</div><div className="mt-3 text-sm font-bold">CARICAMENTO ATLETI…</div></div>;
 return <div>
   {promotion&&<div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm"><div className="mx-auto w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"><div className="eyebrow">REVISIONE PROMOZIONE COACH</div><h2 className="mt-2 text-2xl font-extrabold">{promotion.current?.name} → {promotion.next?.name}</h2><p className="mt-2 text-xs leading-5 text-zinc-500">I dati hanno qualificato il livello attuale. Questa azione modifica solo le sessioni future e lascia invariato lo storico.</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">ATTUALE</div><div className="mt-1 text-[10px] font-bold">{promotion.current?.name}</div></div><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">STATO</div><div className="mt-1 text-[10px] font-bold text-emerald-300">IDONEO</div></div><div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">PROSSIMO</div><div className="mt-1 text-[10px] font-bold">{promotion.next?.name}</div></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" disabled={promotionBusy} onClick={()=>setPromotion(null)}>ANNULLA</button><button className="primary-cta" disabled={promotionBusy} onClick={()=>promoteSkill(promotion)}>{promotionBusy?"PUBBLICAZIONE…":"PROMUOVI AL LIVELLO SUCCESSIVO"}</button></div></div></div>}
   <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="eyebrow">SPAZIO COACH</div><h1>Gestisci gli atleti.</h1><p className="sub">Un unico spazio per leggere i dati, prescrivere il lavoro e registrare le decisioni.</p></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 md:min-w-[220px]"><div className="flex items-center justify-between gap-4"><div className="field-label !mb-0">CODICE COACH</div><span className="text-[8px] font-bold tracking-[.12em] text-emerald-400">SOLO COLLEGAMENTO</span></div><div className="mt-1 flex items-center justify-between gap-3"><div className="font-mono text-lg font-extrabold tracking-[.18em]">{coachCode||"—"}</div><button className="secondary-cta !px-3 !py-2" disabled={!coachCode} onClick={copyCoachCode}>COPIA</button></div><div className="mt-2 text-[8px] leading-4 text-zinc-600">Share this code with an athlete. It does not grant access by itself.</div></div></div><div className="mt-4 sticky top-[70px] z-20 rounded-2xl border border-line bg-ink/95 p-2 backdrop-blur-xl"><div className="grid grid-cols-3 gap-1"><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-intelligence")?.scrollIntoView({behavior:"smooth",block:"start"})}>OVERVEDI</button><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-program")?.scrollIntoView({behavior:"smooth",block:"start"})}>PROGRAMMA</button><button className="secondary-cta !py-2" onClick={()=>document.getElementById("coach-history")?.scrollIntoView({behavior:"smooth",block:"start"})}>STORICO</button></div></div>
   {error&&<div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[10px] text-rose-300">{error}</div>}
   {!athletes.length?<div className="mt-6 grid gap-3 md:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-line bg-panel p-5"><div className="section-kicker">I TUOI ATLETI</div><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Nessun atleta collegato.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-zinc-500">Condividi il tuo codice Coach di 10 caratteri. Dopo il collegamento, i dati di allenamento appariranno qui automaticamente.</p><div className="mt-5 rounded-xl border border-line bg-panel2 p-4"><div className="field-label">PROSSIMO PASSO</div><div className="mt-2 text-sm font-bold">Attendi il primo collegamento atleta.</div><div className="mt-1 text-[9px] leading-4 text-zinc-600">Il Coach non deve creare gli atleti manualmente.</div></div></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="section-kicker">COACHING LOOP</div><div className="mt-3 grid gap-2 text-[10px] font-bold"><div className="rounded-xl bg-panel2 p-3">01 · L’ATLETA SI ALLENA</div><div className="rounded-xl bg-panel2 p-3">02 · I DATI SI SINCRONIZZANO</div><div className="rounded-xl bg-panel2 p-3">03 · IL COACH REVISIONA</div><div className="rounded-xl bg-panel2 p-3">04 · IL COACH PUBBLICA</div></div></div></div>:<div className="mt-6 grid gap-3 md:grid-cols-[240px_1fr]">
    <div className="rounded-2xl border border-line bg-panel p-3"><div className="field-label">ATLETI</div><div className="mt-2 grid gap-1">{athletes.map(a=><button key={a.id} onClick={()=>{setSelected(a.id);setEditing(null)}} className={`rounded-xl border px-3 py-3 text-left ${selected===a.id?"border-violet-500/40 bg-violet-500/10":"border-line bg-panel2"}`}><div className="text-xs font-bold">{a.display_name||"Athlete"}</div><div className="mt-1 text-[8px] text-zinc-600">{a.height_cm?`${a.height_cm} cm`:"Height —"} · {a.weight_kg?`${a.weight_kg} kg`:"Weight —"}</div></button>)}</div></div>
    <div className="min-w-0">
      {athlete&&<div className="grid gap-2 sm:grid-cols-4"><SmallMetric label="ATLETA" value={athlete.display_name||"Athlete"}/><SmallMetric label="SESSIONS" value={String(sessions.length)}/><SmallMetric label="PROGRAM" value={program?.program?`v${program.program.version}`:"DEFAULT"}/><SmallMetric label="FLAGS" value={String(flags.length)}/></div>}
      {athlete&&<div className="mt-3 grid gap-2 md:grid-cols-3"><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">READINESS</div><div className="mt-2 text-sm font-extrabold">{latestReadiness.energy!==undefined?`${latestReadiness.energy}/5 energy`:"Nessun recupero registrato"}</div><div className="mt-1 text-[9px] text-zinc-600">{latestReadiness.sleepHours!==undefined?`${latestReadiness.sleepHours}h sleep`:"Sonno non registrato"}</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">FLAGS</div><div className="mt-2 text-sm font-extrabold">{flags.length?flags.join(" · "):"NESSUN AVVISO ATTIVO"}</div><div className="mt-1 text-[9px] text-zinc-600">Solo segnali da revisionare.</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">ULTIMA NOTA</div><div className="mt-2 text-sm font-extrabold line-clamp-2">{sessions[0]?.session_note||"Nessuna nota di sessione."}</div></div></div>}
      <div id="coach-intelligence" className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">INTELLIGENZA COACH</div><div className="mt-1 text-[9px] text-zinc-500">Decision support from readiness, pain, recent volume and adherence. The Coach never changes the plan automatically.</div></div><span className="tag">REVISIONE MANUALE</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{decisions.map((d,i)=><div key={i} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-2"><div className="text-[10px] font-extrabold">{d.title}</div><span className={`text-[8px] font-extrabold tracking-[.12em] ${d.level==="RED"?"text-rose-400":d.level==="YELLOW"?"text-amber-300":"text-emerald-400"}`}>{d.level}</span></div><div className="mt-2 text-[9px] leading-4 text-zinc-500">{d.detail}</div><div className="mt-2 text-[8px] font-bold tracking-[.12em] text-violet2">{d.action}</div></div>)}</div></div>
      <CoachTimeline sessions={sessions} program={program}/>
      <CoachDecisionCenter athleteId={selected} insights={insights} decisions={decisions} onRecorded={refreshAthlete}/>
      <CoachPerformanceDashboard sessions={sessions} program={program} decisions={decisions}/>
      <SkillIntelligencePanel insights={insights}/>
      <SkillGraphPanel catalog={remoteCatalog.length?remoteCatalog:EXERCISE_CATALOG} blocks={effective.blocks} insights={insights} onPromote={setPromotion}/>
      <div className="mt-5 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between"><div><div className="section-kicker">REVISIONE PROGRESSOIONE</div><div className="mt-1 text-[9px] text-zinc-600">Dati dalle esposizioni reali. Il motore non promuove mai automaticamente.</div></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{insights.map((x:SkillInsight)=><div key={x.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-zinc-600">{x.skill} · {x.exposures} EXPOSURES</div><div className="mt-1 text-sm font-bold">{x.name}</div></div><span className="text-[8px] font-extrabold tracking-[.12em] text-violet2">{x.decision}</span></div><div className="mt-2 text-[9px] text-zinc-500">{x.action} · {x.qualifyingStreak}/2 consecutive qualifying</div></div>)}{!insights.length&&<div className="text-xs text-zinc-600">Not enough logged data yet.</div>}</div></div>
      <div className="mt-4 flex gap-1 overflow-x-auto pb-1">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} className={`rounded-lg border px-3 py-2 text-[9px] font-bold whitespace-nowrap ${day===d?"border-violet-500/40 bg-violet-500/10 text-violet2":"border-line bg-panel text-zinc-600"}`}>{d.slice(0,3).toUpperCase()}</button>)}</div>
      <div className="mt-3 rounded-2xl border border-line bg-panel"><div className="border-b border-line p-4 flex items-center justify-between gap-3"><div><div className="section-kicker">{effective.title}</div><div className="mt-1 text-[10px] text-zinc-500">{effective.subtitle}</div></div><button className="secondary-cta" onClick={()=>setShowAdd(v=>!v)}><PlusCircle size={14}/> ADD EXERCISE</button></div>{showAdd&&<div className="border-b border-line p-4"><div className="field-label">CATALOG PICKER</div><div className="mt-2 grid max-h-64 gap-1 overflow-y-auto">{catalog.filter(x=>!effective.blocks.some(b=>b.id.startsWith(x.id+"__"))&&(!program?.blocks||!program.blocks.some((b:any)=>b.day===day && b.override_payload?.catalogExerciseId===x.id))).slice(0,80).map(x=><button key={x.id} onClick={()=>addBlock(remoteCatalog.find(r=>r.id===x.id)||EXERCISE_CATALOG.find(r=>r.id===x.id)!)} className="rounded-xl border border-line bg-panel2 p-3 text-left"><div className="text-xs font-bold">{x.name}</div><div className="mt-1 text-[8px] text-zinc-600">{x.skill||x.category} · D{x.difficulty||"—"} · {x.defaultTarget||"custom target"}</div></button>)}</div></div>}
      {effective.blocks.map((b:ExerciseBlock,i:number)=>{const remote=remoteById.get(b.id);return <div key={b.id} className="border-b border-line p-4 last:border-b-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="tag">{LABEL[b.kind]}</span><strong className="mt-1 block">{b.name}</strong><p className="mt-1 text-[10px] text-zinc-500">{b.sets?`${b.sets} sets · `:""}{b.target}{b.rest?` · ${b.rest}s rest`:""}</p>{remote&&<span className="mt-2 inline-block text-[8px] font-bold tracking-[.12em] text-violet2">GESTITO DAL COACH</span>}</div><div className="flex items-center gap-1"><button className="mini-btn" disabled={i===0} onClick={()=>move(i,-1)} title="Move up"><ChevronUp size={14}/></button><button className="mini-btn" disabled={i===effective.blocks.length-1} onClick={()=>move(i,1)} title="Move down"><ChevronDown size={14}/></button><button className="secondary-cta" onClick={()=>setEditing(b.id)}>MODIFICA</button><button className="mini-btn" onClick={()=>remove(b)} title="Remove"><Trash2 size={14}/></button></div></div>{editing===b.id&&<CoachProgramEditor athleteId={selected} day={day} block={b} remoteBlock={remote} sortOrder={i} catalog={catalog} onClose={()=>setEditing(null)} onSaved={async msg=>{setEditing(null);setSaved(msg);await refreshAthlete();setTimeout(()=>setSaved(""),3000)}}/>}</div>})}</div>
      {saved&&<div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] text-emerald-300">{saved}</div>}
      <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">NOTE COACH</div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]"><input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="Title"/><select value={notePriority} onChange={e=>setNotePriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div><textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-panel2 p-3 text-xs" placeholder="What should the athlete know?"/><div className="mt-2 flex items-center justify-between gap-3"><label className="text-[9px] text-zinc-500"><input type="checkbox" checked={noteVisible} onChange={e=>setNoteVisible(e.target.checked)} className="mr-2"/>Visible to athlete</label><button className="primary-cta" onClick={saveNote} disabled={!noteBody.trim()}>SAVE NOTE</button></div><div className="mt-4 grid gap-2">{notes.slice(0,6).map((n:any)=><div key={n.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold">{n.title}</div><div className="mt-1 text-[9px] text-zinc-500">{n.priority?.toUpperCase()} · {n.athlete_visible?"ATHLETE VISIBLE":"PRIVATE"}</div></div><span className="text-[8px] text-zinc-600">{new Date(n.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-[10px] leading-5 text-zinc-400">{n.body}</p></div>)}{!notes.length&&<div className="text-xs text-zinc-600">No coach notes yet.</div>}</div></div>
      <div id="coach-history" className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">STORICO PROGRAMMA</div><div className="mt-3 max-h-80 overflow-y-auto">{audit.slice(0,20).map((a:any)=><div key={a.id} className="history-row"><span>{new Date(a.created_at).toLocaleDateString()}</span><strong>{a.action?.toUpperCase()} · {a.entity_type}</strong><span className="text-right text-muted">{a.reason||"—"}</span></div>)}{!audit.length&&<p className="text-xs text-zinc-600">Nessuna cronologia del programma.</p>}</div></div><div className="rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">SESSIONI RECENTI</div>{sessions.slice(0,8).map((s:any)=><div key={s.id} className="history-row"><span>{s.completed_at?new Date(s.completed_at).toLocaleDateString('it-IT'):"—"}</span><strong>{dayLabel(s.day)}</strong><span className="text-right text-muted">{Math.round(Number(s.duration_sec||0)/60)} min · {Number(s.total_reps||0)} reps</span></div>)}{!sessions.length&&<p className="mt-3 text-xs text-zinc-600">Nessuna sessione completata.</p>}</div></div>
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
 const save=async()=>{setBusy(true);setError("");try{const selectedCatalog=catalog.find(x=>x.id===catalogId);const bands=(selectedCatalog?.bandOptions||block.bandOptions||[]).filter(x=>x!=="None") as Band[];await saveCoachProgramBlock({athleteId,catalogExerciseId:catalogId,block:{id:block.id,day,name:name.trim()||block.name,kind,detail:detail.trim()||undefined,target:target.trim()||block.target,sets:Math.max(1,Number(sets)||1),rest:Math.max(0,Number(rest)||0),bandOptions:bands.length?bands:undefined,sortOrder}});onSaved("COACH CHANGE PUBLISHED — ATHLETE WILL SEE IT ON NEXT LOAD");}catch(e:any){setError(e?.message||"SALVATAGGIO COACH FALLITO")}finally{setBusy(false)}};
 const reset=async()=>{setBusy(true);setError("");try{await resetCoachProgramBlock(athleteId,block.id,day,block);onSaved("COACH OVERRIDE REMOVED — DEFAULT RESTORED")}catch(e:any){setError(e?.message||"COACH RESET FAILED")}finally{setBusy(false)}};
 return <div className="mt-4 rounded-xl border border-violet-500/15 bg-panel2 p-4"><div className="flex items-center justify-between"><div className="field-label">EDITOR COACH</div><button className="text-[9px] font-bold text-zinc-600" onClick={onClose}>CHIUDI</button></div>{error&&<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-[9px] text-rose-300">{error}</div>}<label className="mt-3 block"><span className="field-label">ESERCIZIO / VARIANTE</span><select value={catalogId} onChange={e=>choose(e.target.value)} disabled={busy}>{compatible.map(x=><option key={x.id} value={x.id}>{x.name}{x.difficulty?` · D${x.difficulty}`:""}</option>)}</select><span className="mt-1 block text-[8px] text-zinc-600">Compatible by skill or movement pattern. The catalog is the source of prepared alternatives.</span></label><div className="mt-3 grid grid-cols-3 gap-2"><Field label="SERIE" value={sets} set={setSets} placeholder="3"/><Field label="TARGET" value={target} set={setTargetLocal} placeholder="8–10"/><Field label="RECUPERO (S)" value={rest} set={setRestLocal} placeholder="90"/></div>{(currentCatalog?.bandOptions||block.bandOptions||[]).length>0&&<div className="mt-3"><BandSelect label="DEFAULT LOOP" value={band} set={setBand} options={(currentCatalog?.bandOptions||block.bandOptions||[]) as string[]}/></div>}<label className="mt-3 block"><span className="field-label">NOTA DEL COACH</span><input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Indicazione facoltativa" disabled={busy}/></label><div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" disabled={busy} onClick={reset}>RIPRISTINA PREDEFINITO</button><button className="primary-cta" disabled={busy} onClick={save}>{busy?"SAVING…":"PUBBLICA MODIFICA"}</button></div><div className="mt-2 text-[8px] leading-4 text-zinc-600">Only the future prescription changes. Workout history is immutable.</div></div>;
}

function App(){
 const [tab,setTab]=useState<"today"|"plan"|"reports"|"coach"|"settings">("today");
 const [day,setDay]=useState<DayKey>(DAYS[(new Date().getDay()+6)%7]);
 const [player,setPlayer]=useState<any>(null);
 const [draft,setDraft]=useState<any>(()=>getDraft());
 const [refresh,setRefresh]=useState(0);
 const [session,setSession]=useState<any>(null);
 const [profile,setProfile]=useState<UserProfile|null>(null);
 const [authReady,setAuthReady]=useState(!supabaseConfigured);
 const [syncing,setSyncing]=useState(false);
 const [exerciseCatalog,setExerciseCatalog]=useState<ExerciseCatalogItem[]>(EXERCISE_CATALOG);
 useEffect(()=>{trackScreen(tab)},[tab]);

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
 const start=()=>{track("workout_started",{day,source:"today"});track("readiness_opened",{day});clearDraft();setDraft(null);setPlayer({day,index:-1,logs:[],started:Date.now(),readiness:{}})};
 const resume=()=>{if(!draft)return;track("workout_resumed",{day:draft.day,progressIndex:draft.index});setPlayer(draft);setDraft(null)};
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
    {tab==="coach"&&<CoachPanel/>}
    {tab==="settings"&&<Settings/>}
  </main>
  <Nav tab={tab} setTab={setTab}/>
 </div>
}

function LoadingScreen(){return <div className="min-h-[100dvh] bg-ink text-white grid place-items-center"><div className="text-center"><div className="eyebrow">CALISTHENICS COACH</div><div className="mt-3 text-sm font-extrabold">RIPRISTINO SESSIONE</div></div></div>}

function AuthScreen({onSignedIn}:{onSignedIn:(s:any)=>void}){
 const [mode,setMode]=useState<"sign_in"|"sign_up"|"reset">("sign_in"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMsg("");try{
   if(mode==="reset"){
     const r=await resetPassword(email);
     if(r.error)throw r.error;
     setMsg("EMAIL DI RESET INVIATA. CONTROLLA LA POSTA.");
   }else{
     const r=mode==='sign_in'?await signInWithPassword(email.trim(),password):await signUpWithPassword(email.trim(),password);
     if(r.error) throw r.error;
     if(r.data.session) onSignedIn(r.data.session); else setMsg("ACCOUNT CREATO. CONFERMA L’EMAIL, POI ACCEDI.");
   }
 }catch(err:any){setMsg(err?.message||"AUTENTICAZIONE FALLITA")}finally{setBusy(false)}};
 const title=mode==="reset"?"Reimposta la password":mode==="sign_up"?"Crea il tuo account":"Il tuo allenamento, sincronizzato.";
 return <div className="min-h-[100dvh] bg-ink text-white px-4 pt-[calc(env(safe-area-inset-top)+16px)]"><div className="mx-auto max-w-sm pt-16">
   <div className="eyebrow">CALISTHENICS <span className="text-violet2">COACH</span></div><h1 className="mt-3 text-4xl font-extrabold tracking-tight">{title}</h1><p className="mt-3 text-xs leading-5 text-zinc-500">Un account per allenamenti, cronologia, progressi e sincronizzazione Coach.</p>
   <form onSubmit={submit} className="mt-8 rounded-2xl border border-line bg-panel p-4">
    {mode!=="reset"&&<div className="flex rounded-xl border border-line bg-panel2 p-1"><button type="button" className={`flex-1 rounded-lg py-2 text-[9px] font-bold ${mode==='sign_in'?'bg-violet-600 text-white':'text-zinc-600'}`} onClick={()=>{setMode('sign_in');setMsg('')}}>ACCEDI</button><button type="button" className={`flex-1 rounded-lg py-2 text-[9px] font-bold ${mode==='sign_up'?'bg-violet-600 text-white':'text-zinc-600'}`} onClick={()=>{setMode('sign_up');setMsg('')}}>CREA ACCOUNT</button></div>}
    <label className="mt-4 block"><span className="field-label">EMAIL</span><input className="mt-1 w-full rounded-xl border border-line bg-panel2 p-3 text-base sm:text-sm" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
    {mode!=="reset"&&<label className="mt-3 block"><span className="field-label">PASSWORD</span><input className="mt-1 w-full rounded-xl border border-line bg-panel2 p-3 text-base sm:text-sm" type="password" autoComplete={mode==='sign_in'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/></label>}
    {msg&&<div className="mt-3 rounded-xl border border-violet-500/15 bg-violet-500/5 p-3 text-[9px] leading-4 text-zinc-400">{msg}</div>}
    <button className="primary-cta mt-4 w-full" disabled={busy}>{busy?'ATTENDI…':mode==='reset'?'INVIA EMAIL DI RESET':mode==='sign_in'?'ACCEDI':'CREA ACCOUNT'}</button>
    <div className="mt-3 flex justify-center gap-3 text-[9px] text-zinc-600"><button type="button" className="underline" onClick={()=>{setMode(mode==='reset'?'sign_in':'reset');setMsg('')}}>{mode==='reset'?'BACK TO ACCEDI':'PASSWORD DIMENTICATA?'}</button></div>
   </form>
 </div></div>
}
function Header({email,syncing,onSignOut}:{email?:string;syncing?:boolean;onSignOut?:()=>void}){
 return <header className="sticky top-0 z-30 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
  <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16">
   <div className="text-[12px] font-extrabold tracking-[.14em]">CALISTHENICS <span className="text-violet2">COACH</span></div>
   <div className="flex items-center gap-3">
    <div className="text-right"><div className="text-[8px] font-bold tracking-[.14em] text-zinc-600">{syncing?t('syncing'):t('synced')}</div><div className="max-w-[160px] truncate text-[8px] text-zinc-700">{email||t('localMode')}</div></div>
    {onSignOut&&<button className="min-h-9 min-w-9 rounded-full border border-line bg-panel text-zinc-500" onClick={onSignOut} aria-label="Esci"><LogOut size={14}/></button>}
   </div>
  </div>
 </header>
}
function Nav({tab,setTab}:{tab:string;setTab:(x:any)=>void}){
 const items:[[string,string,any],[string,string,any],[string,string,any],[string,string,any],[string,string,any]]=[["today",t("today"),CalendarDays],["plan",t("plan"),ListChecks],["reports",t("reports"),BarChart3],["coach",t("coach"),MessageSquare],["settings",t("settings"),Settings2]];
 return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Primary navigation"><div className="mx-auto grid h-[72px] max-w-5xl grid-cols-5 px-1 sm:h-[76px]">{items.map(([id,l,Icon])=><button key={id} aria-label={l} aria-current={tab===id?"page":undefined} onClick={()=>{track("navigation_clicked",{destination:id});setTab(id)}} className={`nav-item ${tab===id?"nav-item-active":""}`}><Icon size={18}/><span>{l}</span></button>)}</div></nav>
}


const LOCAL_PROFILE_KEY="cc-athlete-coaching-profile";
function getLocalAthleteProfile():AthleteCoachingProfile|null{try{const x=JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY)||"null");return x&&typeof x==='object'?x:null}catch{return null}}
function saveLocalAthleteProfile(profile:AthleteCoachingProfile){localStorage.setItem(LOCAL_PROFILE_KEY,JSON.stringify({...profile,updated_at:new Date().toISOString()}));}

function AthleteGoalCard(){
 const [profile,setProfile]=useState<AthleteCoachingProfile|null>(()=>getLocalAthleteProfile());
 useEffect(()=>{if(supabaseConfigured){fetchMyCoachingProfile().then(p=>{if(p){setProfile(p);saveLocalAthleteProfile(p)}}).catch(()=>{})}},[]);
 if(!profile)return null;
 return <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="section-kicker">FOCUS ATTUALE DEL COACH</div><div className="mt-2 text-sm font-extrabold">{profile.primaryGoal||"Sviluppo della performance"}</div><div className="mt-2 flex flex-wrap gap-2 text-[8px] font-bold tracking-[.1em] text-violet2">{(profile.prioritySkills||[]).slice(0,4).map(x=><span key={x} className="chip">{x}</span>)}</div></div>
}
function RecoveryTrend(){const ss=getSessions().slice(-7);const rows=ss.map(s=>({date:new Date(s.date).toLocaleDateString('it-IT'),sleep:s.readiness.sleepHours,energy:s.readiness.energy,pain:Math.max(s.readiness.wristPain||0,s.readiness.elbowPain||0)}));return <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">RECUPERO — ULTIMI 7</div><div className="mt-3 grid gap-2">{rows.slice().reverse().map(r=><div key={r.date} className="history-row"><span>{r.date}</span><strong>{r.sleep?`${r.sleep.toFixed(1)}h sleep`:'—'}</strong><span>Energia {r.energy??'—'}/5 · Dolore {r.pain}/5</span></div>)}{!rows.length&&<p className="text-xs text-zinc-600">Nessuno storico del recupero.</p>}</div></div>}

function ProgressionHint({block}:{block:ExerciseBlock}){
 const spec=PROGRESSIONS[block.id];
 if(!spec)return null;
 const rows=getLogs().filter(l=>l.exerciseId===block.id&&l.status==="complete").sort((a,b)=>a.date-b.date).slice(-2);
 if(rows.length<2)return null;
 const qualifying=rows.every(l=>meetsCurrentProgression(block.id,l));
 return <div className={`mt-3 rounded-xl border p-3 ${qualifying?"border-emerald-500/20 bg-emerald-500/5":"border-line bg-panel2"}`}>
   <div className="flex items-center justify-between gap-2"><span className="section-kicker">PROGRESSIONE</span><span className={`text-[8px] font-extrabold tracking-[.12em] ${qualifying?"text-emerald-300":"text-zinc-600"}`}>{qualifying?"CANDIDATE":"BUILDING"}</span></div>
   <div className="mt-1 text-[10px] leading-4 text-zinc-400">{qualifying?`Next candidate: ${spec.next}`:`Build ${spec.current} → ${spec.next}`}</div>
   <div className="mt-1 text-[8px] leading-4 text-zinc-600">{qualifying?"Questa è una decisione del Coach, non una modifica automatica.":spec.rule}</div>
 </div>
}

function readinessStatus(r:Readiness){
 const energy=Number(r.energy), sleep=Number(r.sleepHours), pain=Math.max(Number(r.wristPain||0),Number(r.elbowPain||0));
 if(pain>=4)return {label:"CONTROLLO DOLORE",tone:"text-rose-300",detail:"Segnale di dolore elevato. Mantieni la sessione prudente e rivaluta il movimento se necessario."};
 if((Number.isFinite(energy)&&energy<=2)||(Number.isFinite(sleep)&&sleep<6))return {label:"ATTENZIONE",tone:"text-amber-300",detail:"Il recupero è sotto il tuo livello abituale. Mantieni stabili i target ed evita progressioni non necessarie."};
 if(Number.isFinite(energy)||Number.isFinite(sleep))return {label:"PRONTO",tone:"text-emerald-300",detail:"I dati di recupero supportano la sessione prevista."};
 return {label:"NOT RECORDED",tone:"text-zinc-500",detail:"No recovery check-in recorded for this session."};
}
function CoachVerdict({session}:{session:SessionSummary}){
 const strong=scoreSessionSignals(session); const label=strong.status; const tone=label==="PROGRESS"?"text-emerald-300":label==="HOLD"?"text-violet2":label==="RECOVERY"?"text-amber-300":"text-zinc-400";
 const history=getSessions();
 const blocks=PROGRAM[session.day]?.blocks||[];
 const recovery=analyzeRecoveryForBlocks(blocks,history,session.readiness);
 const decisions=decideSessionExercises(session,PROGRAM,history);
 const dTone=(d:ExerciseCoachDecision["decision"])=>d==="PROGRESS"?"text-emerald-300":d==="REGRESS"?"text-rose-300":d==="REDUCE_VOLUME"?"text-amber-300":d==="REVIEW"?"text-orange-300":"text-violet2";
 const muscleRows=Object.values(recovery.report.muscles).filter(x=>x.adjustedSets>0).sort((a,b)=>b.adjustedSets-a.adjustedSets).slice(0,6);
 const recTone=(status:RecoveryStatus)=>status==="FRESH"?"text-emerald-300":status==="RECOVERING"?"text-violet2":status==="FATIGUED"?"text-amber-300":"text-rose-300";
 return <section className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">VERDETTO COACH</div><div className={`mt-1 text-lg font-extrabold ${tone}`}>{label}</div><p className="mt-2 text-[10px] leading-5 text-zinc-400">{strong.detail}</p></div><span className="tag">POST-SESSION</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{strong.reasons.map((x:string)=><div key={x} className="rounded-xl border border-line bg-panel p-3 text-[9px] leading-4 text-zinc-500">{x}</div>)}</div>{decisions.length>0&&<div className="mt-4 rounded-xl border border-line bg-panel p-3"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">EXERCISE DECISIONS</div><div className="mt-1 text-[9px] text-zinc-600">Performance + same-prescription history + readiness + recovery.</div></div><span className="tag">COACH 2.0</span></div><div className="mt-3 grid gap-2">{decisions.slice(0,8).map(d=><div key={d.context.current.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-extrabold">{d.context.block.name}</div><div className="mt-1 text-[8px] text-zinc-600">{d.performanceBand} · {d.context.readinessStatus} · {d.context.comparableExposures} comparable</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${dTone(d.decision)}`}>{d.decision}</span></div><div className="mt-2 text-[9px] leading-4 text-zinc-500">{d.reasons[0]}</div>{d.progressionStreak>0&&<div className="mt-2 text-[8px] font-bold tracking-[.1em] text-violet2">QUALIFYING EXPOSURES · {d.progressionStreak}</div>}</div>)}</div></div>}<div className="mt-4 rounded-xl border border-line bg-panel p-3"><div className="flex items-center justify-between gap-3"><div><div className="section-kicker">WORKLOAD & RECOVERY</div><div className="mt-1 text-[9px] text-zinc-600">7-day planning heuristic · not a physiological measurement</div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${recTone(recovery.report.overallRecovery)}`}>{recovery.report.overallRecovery}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><div><div className="field-label">SERIE PESATE</div><div className="mt-1 text-sm font-extrabold">{recovery.report.totalAdjustedSets.toFixed(1)}</div></div><div><div className="field-label">CARICO DI FATICA</div><div className="mt-1 text-sm font-extrabold">{recovery.report.totalFatigueLoad.toFixed(1)}</div></div><div><div className="field-label">GRIP</div><div className="mt-1 text-sm font-extrabold">{recovery.report.grip.score.toFixed(1)}</div></div></div>{muscleRows.length>0&&<div className="mt-3 grid gap-2">{muscleRows.map(m=><div key={m.muscle} className="flex items-center justify-between rounded-lg bg-panel2 px-3 py-2"><span className="text-[9px] font-bold text-zinc-400">{pretty(m.muscle)}</span><span className="text-[9px] text-zinc-600">{m.adjustedSets.toFixed(1)} sets · {Math.round(recovery.report.recovery[m.muscle]?.recoveryPct||0)}% recovered</span></div>)}</div>}{recovery.flags.length>0&&<div className="mt-3 text-[9px] leading-4 text-amber-300">{recovery.flags.slice(0,3).join(" · ")}</div>}</div></section>
}
function scoreSessionSignals(session:SessionSummary){
 const logs=session.logs.filter(l=>l.status!=="skipped"), reasons:string[]=[];
 const fatigues=logs.map(l=>Number(l.result.fatigue)).filter(Number.isFinite), avgFat=fatigues.length?fatigues.reduce((a,b)=>a+b,0)/fatigues.length:null;
 const emoms=logs.filter(l=>l.kind==="EMOM"&&l.result.emom?.length); const drops=emoms.map(l=>emomStats(l.result.emom||[]).drop);
 const targetHits=logs.filter(l=>{const reps=l.result.reps||[], emom=l.result.emom||[]; if(reps.length)return reps.every(x=>x>0); if(emom.length)return emom.length>=5; return true}).length;
 if(avgFat!==null&&avgFat>=4){reasons.push("Average fatigue was high; do not add volume yet."); return {status:"RECOVERY",detail:"Keep the next exposure conservative until fatigue returns to baseline.",reasons};}
 if(drops.some(d=>d>20)){reasons.push("At least one EMOM showed a meaningful drop-off."); reasons.push("Prioritize repeatable output over a higher opening minute."); return {status:"HOLD",detail:"The session produced useful work, but the next target should be consolidated before progressing.",reasons};}
 if(targetHits>=Math.max(1,Math.ceil(logs.length*.6))){reasons.push("Most completed blocks met the planned workload."); reasons.push("Use the progression proposals below as the only source of plan changes."); return {status:"PROGRESSO",detail:"The session was completed with enough stable work to consider progression candidates.",reasons};}
 reasons.push("The session contains incomplete or mixed evidence."); reasons.push("Keep the next exposure close to the current prescription."); return {status:"HOLD",detail:"Not enough clean evidence to justify a bigger change.",reasons};
}
function PRMoments({session}:{session:SessionSummary}){
 const all=getSessions().filter(s=>s.id!==session.id); const moments:string[]=[];
 const previousBest=(id:string,variantId:string,kind:"reps"|"static"|"emom")=>{let best=0;for(const s of all){for(const l of s.logs){if(l.exerciseId!==id||l.status==="skipped"||String(l.variantId||l.exerciseId)!==String(variantId))continue;const v=kind==="static"?Math.max(...(l.result.seconds||[0])):kind==="emom"?(l.result.emom||[]).reduce((a,b)=>a+b,0):Math.max(...(l.result.reps||[0]));best=Math.max(best,v)}}return best};
 for(const l of session.logs){if(l.status==="skipped")continue;const v=l.kind==="SKILL_STATIC"?Math.max(...(l.result.seconds||[0])):l.kind==="EMOM"?(l.result.emom||[]).reduce((a,b)=>a+b,0):Math.max(...(l.result.reps||[0]));if(v<=0)continue;const k=l.kind==="SKILL_STATIC"?"static":l.kind==="EMOM"?"emom":"reps";const prev=previousBest(l.exerciseId,l.variantId||l.exerciseId,k as any);if(v>prev)moments.push(`${l.exerciseName}${l.variantName?` · ${l.variantName}`:""}: ${l.kind==="SKILL_STATIC"?`${v.toFixed(1)}s`:`${v} reps`}${prev?` · +${(v-prev).toFixed(k==="static"?1:0)}`:" · FIRST PR"}`)}
 if(!moments.length)return null;
 return <section className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="section-kicker text-emerald-300">TODAY'S WINS</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{moments.slice(0,4).map(x=><div key={x} className="rounded-xl border border-emerald-500/10 bg-panel p-3 text-[10px] font-bold text-zinc-300">{x}</div>)}</div></section>
}
function Today({day,setDay,start,draft,onResume}:{day:DayKey;setDay:(x:DayKey)=>void;start:()=>void;draft:any;onResume:()=>void}){
 const p=effectiveProgram(day),push=["Monday","Wednesday","Friday"].includes(day),last=latestSession(day);
 const phase=phaseLabel(currentPhase(Date.now()).type);
 return <div className="today-screen">
  <div className="today-hero">
   <div className="eyebrow">OGGI · {dayLabel(day).toUpperCase()}</div>
   <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><h1>{p.title}</h1><p className="sub mt-2">{uiCopy(p.subtitle)}</p>{push&&<div className="mt-3 text-[9px] font-extrabold tracking-[.12em] text-lime-300">100 PUSH-UPS · 50 DIPS</div>}</div>
    <button className="primary-cta w-full shrink-0 sm:w-auto sm:min-w-44" onClick={draft?onResume:start}>{draft?"RIPRENDI ALLENAMENTO":"INIZIA ALLENAMENTO"}</button>
   </div>
  </div>
  <div className="day-switcher" role="tablist" aria-label="Giorni della settimana">{DAYS.map(d=><button key={d} onClick={()=>setDay(d)} aria-selected={day===d} className={`day-pill ${day===d?"day-pill-active":""}`}><span>{d.slice(0,3).toUpperCase()}</span></button>)}</div>
  <div className="today-context rounded-2xl border border-line bg-panel2 p-4">
   <div className="flex items-center justify-between gap-3"><div><div className="section-kicker">FOCUS DI OGGI</div><div className="mt-1 text-sm font-extrabold">{p.blocks[0]?.name||p.title}</div></div><span className="phase-pill">{phase}</span></div>
   <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-bold tracking-[.06em] text-zinc-500"><span>{p.blocks.length} ESERCIZI</span><span>{p.blocks.reduce((n,b)=>n+(b.sets||0),0)} SERIE</span><span>{push?"PUSH PRIORITY":"SKILL + PERFORMANCE"}</span></div>
  </div>
  <div className="mt-7"><div className="section-kicker">SESSIONE</div><div className="mt-3 grid gap-2">
   <div className="session-row session-row-warmup"><div className="session-index">00</div><div><span className="tag">WARM-UP</span><strong>{push?"Push / wrist / shoulder prep":"Pull / elbow / shoulder prep"}</strong><p>{uiCopy(p.warmup.map(x=>x.name).join(" • "))}</p></div></div>
   {p.blocks.map((b,i)=><div key={b.id} className="session-row"><div className="session-index">{String(i+1).padStart(2,"0")}</div><div className="min-w-0"><div className="flex items-start justify-between gap-3"><div><span className="tag">{LABEL[b.kind]}</span><strong>{currentVariantFor(b.id,b.name)}</strong></div><span className="prescription-badge">{b.kind==="EMOM"?`${b.minutes||10} MIN`:`${b.sets||1} × ${b.target}`}</span></div><p>{displayBlockDetail(b,uiCopy)}</p>{coachNoteForBlock(b,uiCopy)&&<div className="mt-1 text-[9px] font-bold tracking-[.06em] text-violet2"><span className="text-zinc-600">COACH · </span>{coachNoteForBlock(b,uiCopy)}</div>}<ProgressionHint block={b}/></div></div>)}
  </div></div>
  <AthleteGoalCard />
  <div className="mt-5 grid gap-2 sm:grid-cols-2">{last?<div className="compact-stat-card"><div className="section-kicker">ULTIMA SESSIONE</div><div className="mt-2 flex items-baseline gap-4"><strong>{Math.round(last.durationSec/60)} min</strong><span>{last.totalReps} reps</span><span>{last.emomReps} EMOM</span></div></div>:<div className="compact-stat-card"><div className="section-kicker">PRIMA SESSIONE</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">Completa la prima seduta per iniziare a costruire la tua cronologia di performance.</p></div>}</div>
 </div>;
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
  <div className="eyebrow">PROGRESSO</div><h1>Performance</h1><p className="sub">Il tuo livello attuale, i tuoi migliori risultati e il prossimo traguardo utile.</p>
  <div className="mt-6 grid grid-cols-3 gap-2"><Metric label="SESSIONS" value={ss.length}/><Metric label="BLOCCHI" value={logs.length}/><Metric label="EMOM" value={logs.filter(x=>x.kind==="EMOM").length}/></div>
  <div className="mt-4 grid gap-2 md:grid-cols-4"><SmallMetric label="WEIGHT NOW" value={weights.length?`${weights[weights.length-1]!.toFixed(1)} kg`:"—"}/><SmallMetric label="FRONT TOUCH" value={bestStatic("touch")}/><SmallMetric label="FL PULL-UP" value={bestReps("flpu")}/><SmallMetric label="OAP" value={bestReps("oap")}/></div>
  <div className="mt-8"><div className="section-kicker">TREND PRINCIPALI</div><div className="mt-3 grid gap-2 md:grid-cols-2"><TrendRow name="FRONT TOUCH" values={touch} unit="s"/><TrendRow name="FL PULL-UP" values={fl} unit="reps"/><TrendRow name="OAP" values={oap} unit="reps"/><TrendRow name="PUSH-UP BEST SET" values={pushBest} unit="reps"/><TrendRow name="DIPS BEST SET" values={dipBest} unit="reps"/></div></div>
  <div className="mt-8"><div className="flex items-end justify-between"><div><div className="section-kicker">ARCHIVIO PR</div><p className="mt-1 text-[10px] text-zinc-600">Miglior performance registrata, non il target di oggi.</p></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{prs.map(pr=><button key={pr.id} className="rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-violet-500/40" onClick={()=>setSelected(pr.id)}>
      <div className="flex items-start justify-between gap-3"><div><span className="field-label">{pr.category}</span><div className="mt-1 text-sm font-extrabold">{pr.name}</div></div><span className="text-[9px] text-zinc-600">{pr.date?new Date(pr.date).toLocaleDateString():"—"}</span></div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{pr.value}</div><div className="mt-1 text-[9px] text-zinc-600">{pr.context}</div>
    </button>)}{!prs.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">I tuoi PR verranno aggiornati automaticamente quando registri le sessioni.</div>}</div>
  </div>
  <div className="mt-8"><div className="section-kicker">PROSSIMI TRAGUARDI</div><div className="mt-3 grid gap-2 md:grid-cols-2">{milestones.map(m=><div key={m.id} className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><span className="field-label">{m.status}</span><div className="mt-1 text-sm font-extrabold">{m.name}</div></div><span className="text-[9px] font-bold text-violet2">{m.progress}</span></div><p className="mt-3 text-[10px] leading-5 text-zinc-500">{m.detail}</p></div>)}{!milestones.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">Completa alcune sessioni per sbloccare i traguardi.</div>}</div></div>
  <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between"><div><div className="section-kicker">STORICO ESERCIZIO</div><p className="mt-1 text-[10px] text-zinc-600">Tocca un movimento per vedere la performance recente.</p></div><span className="text-[9px] text-zinc-600">{uniqueExerciseIds().length} MOVEMENTS</span></div><div className="mt-3 grid gap-2">{uniqueExerciseIds().slice(0,12).map(id=><button key={id} onClick={()=>setSelected(id)} className="history-card"><div><b>{exerciseNameFor(id)}</b><span>{exerciseCategoryFor(id)}</span></div><span>{latestCompact(id)}</span></button>)}{!logs.length&&<p className="mt-3 text-xs text-muted">Nessuna sessione ancora.</p>}</div></div>
  <div className="mt-8 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">SESSIONI RECENTI</div>{ss.slice(0,8).map(s=><div key={s.id} className="history-row"><span>{new Date(s.date).toLocaleDateString('it-IT')}</span><strong>{dayLabel(s.day)} · {Math.round(s.durationSec/60)}m</strong><span>{s.totalReps} reps</span></div>)}{!ss.length&&<p className="mt-3 text-xs text-muted">Nessuna sessione ancora.</p>}</div>
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
 const out:any[]=[]; const touch=trendValues("touch","static"); if(touch.length) {const best=Math.max(...touch),target=8;out.push({id:"touch",status:best>=target?"TARGET RAGGIUNTO":"BUILDING",name:"Front Touch",progress:`${best.toFixed(1)} / ${target}s`,detail:best>=target?"Minimum target reached. Next step is to consolidate clean 8s holds before progressing.":`You are ${(target-best).toFixed(1)}s away from the 8s target.`});}
 const pLogs=getLogs().filter(l=>l.exerciseId==="pike"&&l.status==="complete"); if(pLogs.length){const last=pLogs[pLogs.length-1],vals=last.result.reps||[],best=vals.length?Math.min(...vals):0;out.push({id:"pike",status:meetsCurrentProgression("pike",last)?"PROGRESSOIONE PRONTA":"BUILDING",name:"Pike Push-up",progress:`${vals.join(" / ")}`,detail:meetsCurrentProgression("pike",last)?"La sessione attuale soddisfa il criterio di performance programmato.":"Continua a costruire finché tutte le serie prescritte raggiungono il target."});}
 return out;
}
function uniqueExerciseIds(){return [...new Set(getLogs().filter(l=>l.status!=="skipped").map(l=>l.exerciseId))];}
function exerciseNameFor(id:string){const found=getLogs().filter(l=>l.exerciseId===id).sort((a,b)=>b.date-a.date)[0];return found?.exerciseName||id;}
function exerciseCategoryFor(id:string){const found=getLogs().filter(l=>l.exerciseId===id).sort((a,b)=>b.date-a.date)[0];return found?LABEL[found.kind]:"MOVEMENT";}
function latestCompact(id:string){const l=getLogs().filter(x=>x.exerciseId===id&&x.status!=="skipped").sort((a,b)=>b.date-a.date)[0];if(!l)return "—";if(l.kind==="EMOM")return `${(l.result.emom||[]).reduce((a,b)=>a+b,0)} reps`;if(l.result.seconds?.length)return `${Math.max(...l.result.seconds).toFixed(1)}s`;return `${(l.result.reps||[]).join("/")}`;}
function ExerciseHistoryModal({id,onClose}:{id:string;onClose:()=>void}){const rows=getLogs().filter(l=>l.exerciseId===id&&l.status!=="skipped").sort((a,b)=>b.date-a.date).slice(0,12);return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur"><div className="mx-auto max-w-2xl px-4 py-8 pb-28"><div className="flex items-start justify-between gap-3"><div><div className="eyebrow">STORICO ESERCIZIO</div><h2 className="mt-2 text-3xl font-extrabold">{exerciseNameFor(id)}</h2><p className="sub">Performance recente, target e direzione del movimento.</p></div><button className="secondary-cta" onClick={onClose}>CHIUDI</button></div><div className="mt-5 grid gap-2">{rows.map(l=><div key={l.id} className="rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><span className="field-label">{new Date(l.date).toLocaleDateString()}</span><span className="text-[9px] text-zinc-600">{l.status.toUpperCase()}</span></div><div className="mt-2 text-sm font-bold">{l.kind==="EMOM"?`EMOM ${(l.result.emom||[]).join(" / ")}`:l.result.seconds?.length?`HOLD ${(l.result.seconds||[]).map(x=>x.toFixed(1)).join(" / ")}s`:`SETS ${(l.result.reps||[]).join(" / ")}`}</div><div className="mt-2 text-[9px] text-zinc-600">{l.result.band&&l.result.band!=="None"?`LOOP ${l.result.band} · `:""}{l.result.rir!==undefined?`RIR ${l.result.rir} · `:""}{l.result.fatigue!==undefined?`FATIGUE ${l.result.fatigue}/5`:""}{l.result.note?` · ${l.result.note}`:""}</div></div>)}{!rows.length&&<div className="rounded-2xl border border-line bg-panel p-4 text-xs text-muted">Nessuna cronologia per questo movimento.</div>}</div></div></div>}
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
 const status=best>=target?"TARGET RAGGIUNTO":delta!==null&&delta>3?"PROGRESSING":delta!==null&&delta<-8?"CONTROLLA FATICA":"BUILDING";
 return <div className="rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-start justify-between gap-3"><div><div className="field-label">{label}</div><div className="mt-1 text-2xl font-extrabold">{best||"—"} <span className="text-xs font-bold text-zinc-600">/ {target}</span></div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${status==="TARGET RAGGIUNTO"?"text-emerald-400":status==="PROGRESSING"?"text-violet2":status==="CONTROLLA FATICA"?"text-amber-300":"text-zinc-500"}`}>{status}</span></div>
   <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width:`${pct}%`}}/></div>
   <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]"><div><span className="field-label">MIGLIORE</span><b className="mt-1 block text-white">{best||"—"}</b></div><div><span className="field-label">ULTIMO</span><b className="mt-1 block text-white">{last.length?last[last.length-1]:"—"}</b></div><div><span className="field-label">TREND</span><b className="mt-1 block text-white">{delta===null?"—":`${delta>=0?"+":""}${delta.toFixed(0)}%`}</b></div></div>
   <p className="mt-3 text-[9px] leading-4 text-zinc-600">{best>=target?"Obiettivo raggiunto. Mantienilo periodicamente, mantenendo la maggior parte dell’allenamento submassimale.":status==="CONTROLLA FATICA"?"La performance recente è calata rispetto alle esposizioni precedenti. Non aggiungere volume finché recupero e tecnica non sono tornati a posto.":"Usa il giorno long-set per aumentare gradualmente la serie migliore; usa i giorni EMOM/volume per costruire capacità senza testare il massimale a ogni sessione."}</p>
 </div>
}
function CoachGoalsDashboard(){
 const snapshots=analyzeAllGoals(getSessions());
 const phase=currentPhase();
 const phaseLabel=phase.type.replaceAll('_',' ');
 return <section className="mt-6 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
   <div className="flex items-end justify-between gap-3">
    <div><div className="section-kicker">OBIETTIVI COACH</div><p className="mt-1 text-[9px] text-zinc-500">Target di performance monitorati da esposizioni di qualità.</p></div>
    <span className="tag">{phaseLabel} · W{phase.week}/{phase.totalWeeks}</span>
   </div>
   <div className="mt-3 grid gap-2 md:grid-cols-2">{snapshots.map((g:GoalPerformanceSnapshot)=><GoalAnalyticsCard key={g.goal.id} snapshot={g}/>)}</div>
 </section>;
}
function GoalAnalyticsCard({snapshot:g}:{snapshot:GoalPerformanceSnapshot}){
 const value=g.best||0; const pct=Math.max(0,Math.min(100,g.progressPct));
 const status=g.status==='REALIZING'?'TARGET RAGGIUNTO':g.status==='PROGRESSING'?'PROGRESSING':g.status==='REGRESSING'?'CONTROLLA RECUPERO':g.status==='STALLED'?'STABLE':'BUILDING';
 const tone=status==='TARGET RAGGIUNTO'?'text-emerald-400':status==='PROGRESSING'?'text-violet2':status==='CONTROLLA RECUPERO'?'text-amber-300':'text-zinc-500';
 const unit=g.goal.unit==='seconds'?'s':'reps';
 return <div className="rounded-xl border border-line bg-panel p-3">
   <div className="flex items-start justify-between gap-3"><div><div className="field-label">{g.goal.label.toUpperCase()}</div><div className="mt-1 text-xl font-extrabold">{value||'—'} <span className="text-xs font-bold text-zinc-600">/ {g.target} {unit}</span></div></div><span className={`text-[8px] font-extrabold tracking-[.12em] ${tone}`}>{status}</span></div>
   <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width:`${pct}%`}}/></div>
   <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]"><div><span className="field-label">ULTIMO</span><b className="mt-1 block text-white">{g.current||'—'}</b></div><div><span className="field-label">TREND</span><b className="mt-1 block text-white">{g.trendPct===0?'—':`${g.trendPct>=0?'+':''}${g.trendPct.toFixed(0)}%`}</b></div><div><span className="field-label">DATI</span><b className="mt-1 block text-white">{g.exposures}</b></div></div>
   <p className="mt-3 text-[9px] leading-4 text-zinc-600">{g.interpretation}</p>
 </div>;
}
function WeeklyReview({sessions}:{sessions:SessionSummary[]}){
 const reps=sessions.reduce((a,b)=>a+b.totalReps,0),emom=sessions.reduce((a,b)=>a+b.emomReps,0),duration=sessions.reduce((a,b)=>a+b.durationSec,0); const fatigue=sessions.flatMap(s=>s.logs.map(l=>Number(l.result.fatigue))).filter(Number.isFinite); const avgFat=fatigue.length?fatigue.reduce((a,b)=>a+b,0)/fatigue.length:null; const readiness=sessions.map(s=>readinessStatus(s.readiness||{}).label); const ready=readiness.filter(x=>x==="PRONTO").length;
 return <section className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="flex items-end justify-between gap-3"><div><div className="section-kicker">RIEPILOGO SETTIMANALE</div><p className="mt-1 text-[9px] text-zinc-600">The smallest set of signals that tells you whether the week is trending well.</p></div><span className="tag">{sessions.length}/6 SESSIONS</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="TEMPO" value={formatClock(duration) as any}/><Metric label="RIPETIZIONI" value={reps}/><Metric label="EMOM" value={emom}/><Metric label="PRONTO DAYS" value={ready}/></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">FATIGUE</span><div className="mt-1 text-sm font-extrabold">{avgFat!==null?`${avgFat.toFixed(1)} / 5`:`—`}</div><p className="mt-1 text-[8px] text-zinc-600">Media della fatica registrata nella settimana.</p></div><div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">SINTESI COACH</span><div className="mt-1 text-sm font-extrabold">{sessions.length>=4&&avgFat!==null&&avgFat<3.5?"Settimana stabile":"Raccogli ancora dati prima di aumentare il volume."}</div><p className="mt-1 text-[8px] text-zinc-600">Usa le proposte del Coach, non la sensazione del momento, per cambiare il piano.</p></div></div></section>
}
function Reports({refresh}:{refresh:number}){
 const [offset,setOffset]=useState(0),[copied,setCopied]=useState(false),[selected,setSelected]=useState<string|null>(null),[showWeekly,setShowWeekly]=useState(false);
 const sessions=getSessions().sort((a,b)=>b.date-a.date),weekStart=Date.now()-7*86400000,weekSessions=sessions.filter(s=>s.date>=weekStart),weekReps=weekSessions.reduce((a,s)=>a+s.totalReps,0),weekEmom=weekSessions.reduce((a,s)=>a+s.emomReps,0),best=weekSessions.reduce((m,s)=>Math.max(m,s.bestSkillSeconds),0),weeklyIntelligence=buildCoachWeeklyReport(sessions,currentPhase(),Date.now()-offset*7*86400000),report=formatCoachWeeklyReport(weeklyIntelligence);
 const copy=async()=>{try{await navigator.clipboard.writeText(report);setCopied(true);setTimeout(()=>setCopied(false),1200)}catch{}};
 return <div>
  <div className="eyebrow">PROGRESSO</div><h1>Reports</h1>
  <CoachGoalsDashboard/>
  <div className="mt-5 grid grid-cols-3 gap-2"><Metric label="WORKOUTS" value={weekSessions.length}/><Metric label="RIPETIZIONI" value={weekReps}/><Metric label="EMOM" value={weekEmom}/></div>
  <div className="mt-2 rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><div><div className="field-label">BEST STATIC</div><div className="mt-1 text-xl font-extrabold">{best?`${best.toFixed(1)}s`:"—"}</div></div><div className="text-right"><div className="field-label">SETTIMANA ATTUALE</div><div className="mt-1 text-sm font-bold">{weekSessions.length} sessions</div></div></div></div>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4">
   <div className="flex items-end justify-between gap-3"><div><div className="section-kicker">RECENT COMPLETED WORKOUTS</div><p className="mt-1 text-[9px] text-zinc-600">Apri una sessione per rivedere esecuzione e report Coach.</p></div><span className="tag">LAST {Math.min(7,sessions.length)}</span></div>
   <div className="mt-3 grid gap-2">{sessions.slice(0,7).map(s=><button key={s.id} onClick={()=>{track("session_detail_opened",{day:s.day});setSelected(s.id)}} className={`history-card text-left ${selected===s.id?"selected":""}`}><div><b>{s.day}</b><span>{new Date(s.date).toLocaleDateString('it-IT')}</span></div><span className="tabular-nums">{formatClock(s.durationSec)} · {s.totalReps} reps · {s.emomReps} EMOM · <b>{scoreSessionSignals(s).status}</b></span></button>)}{!sessions.length&&<p className="mt-3 text-xs text-zinc-600">Nessuna sessione completata.</p>}</div>
  </div>
  <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">COACH WEEKLY INTELLIGENCE</div><div className="mt-1 text-lg font-extrabold">{weeklyIntelligence.headline}</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">{weeklyIntelligence.summary}</p></div><span className="tag">{weeklyIntelligence.adherencePct.toFixed(0)}% ADHERENCE</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{weeklyIntelligence.actions.slice(0,4).map((a,i)=><div key={i} className="rounded-xl border border-line bg-panel p-3"><div className="text-[8px] font-extrabold tracking-[.1em] text-violet2">{a.priority}</div><div className="mt-1 text-[10px] font-bold text-zinc-200">{a.title}</div><div className="mt-1 text-[9px] leading-4 text-zinc-600">{a.detail}</div></div>)}</div></div>
  <WeeklyReview sessions={weekSessions}/>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">TIMELINE ALLENAMENTO</div><div className="mt-3 grid gap-2">{sessions.slice(0,12).map(s=><div key={s.id} className="history-row"><span>{new Date(s.date).toLocaleDateString('it-IT')}</span><strong>{dayLabel(s.day)}</strong><span>{formatClock(s.durationSec)} · {s.totalReps} reps</span></div>)}{!sessions.length&&<p className="text-xs text-zinc-600">Nessuna attività ancora.</p>}</div></div>
  <div className="mt-6 rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between gap-3"><div><div className="section-kicker">ESPORTA COACH</div><div className="mt-1 text-[9px] text-zinc-600">Report settimanale per il Coach.</div></div><button className="secondary-cta !py-2" onClick={()=>setShowWeekly(v=>!v)}>{showWeekly?"NASCONDI":"VEDI"}</button></div>{showWeekly&&<><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{[0,1,2,3,4].map(n=><button key={n} onClick={()=>setOffset(n)} className={`rounded-lg border px-3 py-2 text-[9px] font-bold whitespace-nowrap ${offset===n?"border-violet-500/40 bg-violet-500/10 text-violet2":"border-line bg-panel2 text-zinc-600"}`}>{n===0?"QUESTA SETTIMANA":`WEEK -${n}`}</button>)}</div><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-panel2 p-3 font-sans text-[9px] leading-5 text-zinc-400">{report}</pre><div className="mt-3 grid grid-cols-2 gap-2"><button className="primary-cta" onClick={copy}>{copied?"COPIATO":"COPIA"}</button><button className="secondary-cta" onClick={()=>download(report,`weekly-coach-report-${offset}.txt`)}><Download size={14}/>ESPORTA</button></div></>}</div>
  {selected&&<SessionDetail session={sessions.find(s=>s.id===selected)!} onClose={()=>setSelected(null)}/>}
 </div>
}
function SessionDetail({session,onClose}:{session:SessionSummary;onClose:()=>void}){
 const [note,setNote]=useState(session.sessionNote||""); const report=makeSessionReport({...session,sessionNote:note});
 const save=()=>{const next={...session,sessionNote:note};replaceSession(next);onClose()};
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur"><div className="mx-auto max-w-2xl px-4 py-8"><div className="flex justify-between"><div><div className="eyebrow">DURATA COMPLETATA</div><h2 className="mt-2 text-3xl font-extrabold">{dayLabel(session.day)}</h2><p className="mt-1 text-[10px] text-zinc-600">{new Date(session.date).toLocaleString('it-IT')}</p></div><button className="secondary-cta" onClick={onClose}>CHIUDI</button></div><div className="mt-5 grid grid-cols-3 gap-2"><Metric label="TEMPO" value={formatClock(session.durationSec)}/><Metric label="RIPETIZIONI" value={session.totalReps}/><Metric label="EMOM" value={session.emomReps}/></div><div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">SESSION REPORT</div><pre className="mt-3 whitespace-pre-wrap font-sans text-[10px] leading-5 text-zinc-300">{report}</pre></div><div className="mt-4"><span className="field-label">NOTA SESSIONE</span><textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-1 min-h-[100px] w-full rounded-xl border border-line bg-panel2 p-3 text-xs" placeholder="Qualcosa da segnalare al Coach?"/></div><button className="primary-cta mt-3 w-full" onClick={save}>SALVA MODIFICHE</button></div></div>
}

function AnalyticsPanel(){
 const [days,setDays]=useState(30);
 const [summary,setSummary]=useState(()=>analyticsSummary());
 const [intel,setIntel]=useState(()=>analyticsIntelligence(30));
 const refresh=()=>{setSummary(analyticsSummary());setIntel(analyticsIntelligence(days));};
 const doExport=()=>download(exportAnalytics(),`calisthenics-coach-analytics-${new Date().toISOString().slice(0,10)}.json`);
 const clear=()=>{clearAnalytics();refresh();};
 const riskExercises=intel.exercises.filter(x=>x.frictionRate>25).slice(0,6);
 return <div className="mt-8 rounded-2xl border border-line bg-panel p-4">
  <div className="flex items-start justify-between gap-3"><div><div className="section-kicker">ANALISI UTILIZZO</div><p className="mt-1 text-[9px] leading-4 text-zinc-600">Dati anonimi di utilizzo locale. Servono a individuare attriti e abbandoni prima di modificare il prodotto.</p></div><span className="tag">{summary.totalEvents} EVENTI</span></div>
  <div className="mt-4 flex flex-wrap items-center gap-2"><span className="field-label">PERIODO</span>{[7,30,90].map(d=><button key={d} className={`mini-btn min-w-12 ${days===d?'!border-violet-500 !text-white':''}`} onClick={()=>{setDays(d);setTimeout(()=>setIntel(analyticsIntelligence(d)),0)}}>{d}D</button>)}<button className="secondary-cta !py-2 !px-3" onClick={()=>{refresh();track("analytics_view_refreshed",{windowDays:days})}}>AGGIORNA</button></div>
  <div className="mt-4 grid gap-2 sm:grid-cols-4">
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">COMPLETAMENTO ALLENAMENTO</span><div className="mt-1 text-lg font-extrabold">{intel.completion.rate.toFixed(0)}%</div><div className="mt-1 text-[8px] text-zinc-600">{intel.completion.completed}/{intel.completion.started} started</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">READINESS</span><div className="mt-1 text-lg font-extrabold">{intel.readiness.completionRate.toFixed(0)}%</div><div className="mt-1 text-[8px] text-zinc-600">registrati vs saltati</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">ACCETTAZIONE COACH</span><div className="mt-1 text-lg font-extrabold">{intel.coach.decisionRate.toFixed(0)}%</div><div className="mt-1 text-[8px] text-zinc-600">{intel.coach.accepted}/{intel.coach.accepted+intel.coach.rejected} decisions</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">TASSO BOZZE</span><div className="mt-1 text-lg font-extrabold">{intel.recovery.draftRate.toFixed(0)}%</div><div className="mt-1 text-[8px] text-zinc-600">allenamenti non terminati</div></div>
  </div>
  <div className="mt-4 grid gap-3 lg:grid-cols-2">
   <div className="rounded-xl border border-line bg-panel2 p-3"><div className="section-kicker">PERCORSO ALLENAMENTO</div><div className="mt-3 grid gap-2">{intel.funnel.map((x,i)=><div key={x.name}><div className="flex items-center justify-between text-[9px]"><span className="text-zinc-400">{x.name}</span><b>{x.count}{i>0?` · ${x.rate.toFixed(0)}% vs previous`:''}</b></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-violet-500" style={{width:`${Math.min(100,x.rate||0)}%`}}/></div></div>)}</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><div className="section-kicker">UTILIZZO FUNZIONI</div><div className="mt-3 grid gap-1">{intel.featureAdoption.slice(0,8).map(([name,count])=><div key={name} className="flex items-center justify-between text-[9px]"><span className="text-zinc-400">{name}</span><b>{count}</b></div>)}</div></div>
  </div>
  <div className="mt-3 grid gap-3 lg:grid-cols-2">
   <div className="rounded-xl border border-line bg-panel2 p-3"><div className="section-kicker">FRIZIONE ESERCIZI</div><p className="mt-1 text-[8px] text-zinc-600">Avviati → saltati/sostituiti. Un attrito alto indica che UX o scelta dell’esercizio meritano una revisione.</p>{riskExercises.length?<div className="mt-3 grid gap-2">{riskExercises.map(x=><div key={x.exerciseId} className="rounded-lg border border-line p-2"><div className="flex items-center justify-between text-[9px]"><b>{x.exerciseId}</b><span className="text-amber-300">{x.frictionRate.toFixed(0)}% friction</span></div><div className="mt-1 text-[8px] text-zinc-600">started {x.started} · complete {x.completed} · skipped {x.skipped} · substituted {x.substituted}</div></div>)}</div>:<div className="mt-3 text-[9px] text-zinc-600">Nessun esercizio ad alto attrito nel periodo.</div>}</div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><div className="section-kicker">SEGNALI DI RECUPERO / ABBANDONO</div><div className="mt-3 grid gap-1 text-[9px]"><div className="flex justify-between"><span className="text-zinc-400">Allenamenti ripresi</span><b>{intel.recovery.resumed}</b></div><div className="flex justify-between"><span className="text-zinc-400">Bozze salvate</span><b>{intel.recovery.draftSaved}</b></div><div className="flex justify-between"><span className="text-zinc-400">Allenamenti eliminati</span><b>{intel.recovery.discarded}</b></div><div className="flex justify-between"><span className="text-zinc-400">Timer saltati</span><b>{intel.timer.skips}</b></div><div className="flex justify-between"><span className="text-zinc-400">Modifiche al programma</span><b>{intel.program.edits}</b></div></div></div>
  </div>
  <div className="mt-3 rounded-xl border border-line bg-panel2 p-3"><div className="section-kicker">SCHERMATE PRINCIPALI</div><div className="mt-2 grid gap-1 sm:grid-cols-2">{intel.topScreens.map(([name,count])=><div key={name} className="flex items-center justify-between text-[9px]"><span className="text-zinc-400">{name}</span><b>{count}</b></div>)}</div></div>
  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><button className="secondary-cta" onClick={()=>{track("analytics_exported");doExport()}}>ESPORTA</button><button className="secondary-cta" onClick={()=>{clear();track("analytics_cleared")}}>SVUOTA</button><div className="flex items-center justify-center text-[8px] text-zinc-600">Periodo: {days} days</div></div>
 </div>
}
function Settings(){return <div><div className="eyebrow">{t("settings")}</div><h1>{t("settingsTitle")}</h1><p className="sub">{t("settingsSub")}</p><CoachLinkCard onLinked={()=>track("coach_linked")}/><AthleteProfileEditor/><DataBackup/><AnalyticsPanel/></div>}
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
  <div className="flex items-start justify-between gap-3"><div><div className="section-kicker">ATHLETE SNAPSHOT</div><p className="mt-1 max-w-xl text-[9px] leading-4 text-zinc-600">Il tuo contesto reale di allenamento — obiettivi, stato attuale, setup e performance recente. Modifica solo quando qualcosa cambia.</p></div><button className="secondary-cta !py-2" onClick={()=>setEditing(v=>!v)}>{editing?"CHIUDI":"MODIFICA"}</button></div>

  <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
   <div className="field-label">FOCUS ATTUALE</div>
   <div className="mt-1 text-xl font-extrabold">{profile.primaryGoal||"Sviluppo della performance"}</div>
   <div className="mt-1 text-[9px] text-zinc-500">Target: {target}</div>
   <div className="mt-3 flex flex-wrap gap-2">{(profile.prioritySkills||[]).slice(0,6).map(x=><span key={x} className="chip">{x}</span>)}{!(profile.prioritySkills||[]).length&&<span className="text-[9px] text-zinc-600">Nessuna skill prioritaria</span>}</div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">TRAINING RHYTHM</span><div className="mt-1 text-lg font-extrabold">{profile.schedule_days??6} giorni / settimana</div><div className="mt-1 text-[8px] text-zinc-600">{last14.length} completati negli ultimi 14 giorni</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">PESO ATTUALE</span><div className="mt-1 text-lg font-extrabold">{typeof currentWeight==="number"?`${currentWeight.toFixed(1)} kg`:"—"}</div><div className="mt-1 text-[8px] text-zinc-600">Ultimo check-in di recupero</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">RECENT STATUS</span><div className="mt-1 text-sm font-extrabold">{latest?.readiness?.sleepHours?`${latest.readiness.sleepHours.toFixed(1)}h sleep`:`No readiness`}</div><div className="mt-1 text-[8px] text-zinc-600">Energy {latest?.readiness?.energy??"—"}/5 · Pain {recentPain??"—"}/5</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">PERFORMANCE SNAPSHOT</span><div className="mt-1 text-sm font-extrabold">{bestStatic!==undefined?`Best hold ${bestStatic.toFixed(1)}s`:`Best reps ${bestRepSet??"—"}`}</div><div className="mt-1 text-[8px] text-zinc-600">Sulle sessioni registrate</div></div>
  </div>

  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">TRAINING SETUP</span><div className="mt-2 flex flex-wrap gap-2">{(profile.equipment||[]).map(x=><span key={x} className="chip">{x}</span>)}{!(profile.equipment||[]).length&&<span className="text-[9px] text-zinc-600">Nessuna attrezzatura impostata</span>}</div></div>
   <div className="rounded-xl border border-line bg-panel2 p-3"><span className="field-label">LAST COACH SIGNAL</span><div className="mt-1 text-[10px] font-bold">{lastDecision?.title||"No coaching decision recorded yet"}</div><div className="mt-1 text-[8px] leading-4 text-zinc-600">{lastDecision?.detail||"Complete a few sessions and the coach loop will have more context."}</div></div>
  </div>

  {profile.notes&&<div className="mt-3 rounded-xl border border-violet-500/10 bg-violet-500/5 p-3"><span className="field-label">COACH CONTEXT</span><div className="mt-1 text-[9px] leading-4 text-zinc-400">{profile.notes}</div></div>}

  {editing&&<div className="mt-4 border-t border-line pt-4"><div className="section-kicker">EDIT COACHING CONTEXT</div><div className="mt-3 grid gap-2 md:grid-cols-2">
   <label><span className="field-label">PRIMARY GOAL</span><input value={profile.primaryGoal||""} onChange={e=>setProfile({...profile,primaryGoal:e.target.value})} placeholder="Full Front Lever"/></label>
   <label><span className="field-label">TARGET DATE</span><input type="date" value={profile.targetDate||""} onChange={e=>setProfile({...profile,targetDate:e.target.value})}/></label>
   <label><span className="field-label">PRIORITY SKILLS</span><input value={(profile.prioritySkills||[]).join(", ")} onChange={e=>setProfile({...profile,prioritySkills:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="OAP, Front Lever Touch"/></label>
   <label><span className="field-label">SECONDARY GOALS</span><input value={(profile.secondaryGoals||[]).join(", ")} onChange={e=>setProfile({...profile,secondaryGoals:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Strength, endurance"/></label>
   <label><span className="field-label">TRAINING DAYS</span><input inputMode="numeric" value={String(profile.schedule_days??6)} onChange={e=>setProfile({...profile,schedule_days:Math.max(1,Math.min(7,Number(e.target.value)||0))})}/></label>
   <label><span className="field-label">ATTREZZATURA</span><input value={(profile.equipment||[]).join(", ")} onChange={e=>setProfile({...profile,equipment:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Pull-up bar, Dip bars, Loop bands"/></label>
   <label className="md:col-span-2"><span className="field-label">COACH CONTEXT</span><textarea value={profile.notes||""} onChange={e=>setProfile({...profile,notes:e.target.value})} className="min-h-20 w-full" placeholder="Important constraints, preferences, recurring limitations, anything your coach should remember..."/></label>
  </div><div className="mt-3 flex items-center justify-between"><span className="text-[9px] text-zinc-600">{msg}</span><button className="primary-cta" disabled={busy} onClick={save}>{busy?"SAVING…":"SAVE PROFILE"}</button></div></div>}
 </div>
}

function DataBackup(){
 const [msg,setMsg]=useState("");
 const backup=()=>download(exportBackup(),`calisthenics-coach-backup-${new Date().toISOString().slice(0,10)}.json`);
 const restore=(file:File)=>{const fr=new FileReader();fr.onload=()=>{try{importBackup(String(fr.result));setMsg("RIPRISTINATO — riapri l’app per applicare i dati.");}catch(e){setMsg("File di backup non valido.")}};fr.readAsText(file)};
 const syncNow=async()=>{setMsg("SINCRONIZZAZIONE…");try{const r=await syncLocalSessions(getSessions());setMsg(`SYNCED · ${r.uploaded} uploaded · ${r.pulled} pulled · ${r.remote} remote sessions`)}catch(e:any){setMsg(e?.message||"SINCRONIZZAZIONE FALLITA")}};
 return <div className="mt-8 border-t border-line pt-6"><div className="section-kicker">DATI</div><div className="mt-3 grid gap-2 sm:grid-cols-3"><button className="secondary-cta" onClick={backup}><Download size={14}/>ESPORTA BACKUP</button><label className="secondary-cta cursor-pointer"><Upload size={14}/>IMPORTA BACKUP<input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0]&&restore(e.target.files[0])}/></label>{supabaseConfigured&&<button className="secondary-cta" onClick={syncNow}><RefreshCw size={14}/>SINCRONIZZA ORA</button>}</div>{msg&&<p className="mt-2 text-[10px] text-zinc-500">{msg}</p>}</div>
}


function exerciseCatalogForUi(block:ExerciseBlock){return EXERCISE_CATALOG.find(x=>x.id===String(block.catalogExerciseId||block.id).split("__")[0])||EXERCISE_CATALOG.find(x=>x.name===block.name);}
function ExercisePurpose({block,catalog}:{block:ExerciseBlock;catalog?:ExerciseCatalogItem}){const goal=catalog?.skill||catalog?.category||LABEL[block.kind];const next=catalog?.difficulty?`Difficulty ${catalog.difficulty}/5`:"";return <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">PERCHÉ QUESTO ESERCIZIO</div><div className="mt-1 text-sm font-extrabold">{goal}</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">{catalog?.detail||block.detail}</p><div className="mt-2 flex flex-wrap gap-2 text-[8px] font-bold tracking-[.1em] text-violet2"><span>{next}</span><span>{block.target}</span><span>{block.rest}s REST</span></div></div>}


function ReadinessGate({readiness,onSave,onSkip}:{readiness:Readiness;onSave:(r:Readiness)=>void;onSkip:()=>void}){
 const [energy,setEnergy]=useState(readiness.energy?String(readiness.energy):"");
 const [sleep,setSleep]=useState(readiness.sleepHours?String(readiness.sleepHours):"");
 const [wrist,setWrist]=useState(String(readiness.wristPain??0));
 const [elbow,setElbow]=useState(String(readiness.elbowPain??0));
 const [weight,setWeight]=useState(readiness.weightKg?String(readiness.weightKg):"");
 const status=readinessStatus({energy:energy?Number(energy):undefined,sleepHours:sleep?Number(sleep):undefined,wristPain:Number(wrist),elbowPain:Number(elbow),weightKg:weight?Number(weight):undefined});
 const save=()=>onSave({energy:energy?Number(energy):undefined,sleepHours:sleep?Number(sleep):undefined,wristPain:Number(wrist),elbowPain:Number(elbow),weightKg:weight?Number(weight):undefined});
 return <div className="flex flex-1 items-center justify-center py-8"><div className="w-full max-w-lg rounded-3xl border border-line bg-panel p-5">
   <div className="eyebrow">CHECK PRE-ALLENAMENTO · 10 SEC</div><h2 className="mt-2 text-3xl font-extrabold">Come arrivi oggi?</h2>
   <p className="mt-2 text-xs leading-5 text-zinc-500">Non serve essere precisi: dai al Coach un segnale rapido su energia, sonno e articolazioni. Non cambia il piano da solo.</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <label><span className="field-label">ENERGIA</span><select value={energy} onChange={e=>setEnergy(e.target.value)}><option value="">—</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x}/5</option>)}</select></label>
    <label><span className="field-label">SONNO · ORE</span><input inputMode="decimal" value={sleep} onChange={e=>setSleep(e.target.value)} placeholder="7.5"/></label>
    <label><span className="field-label">POLSO · DOLORE</span><select value={wrist} onChange={e=>setWrist(e.target.value)}>{[0,1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label>
    <label><span className="field-label">GOMITO · DOLORE</span><select value={elbow} onChange={e=>setElbow(e.target.value)}>{[0,1,2,3,4,5].map(x=><option key={x}>{x}/5</option>)}</select></label>
    <label className="sm:col-span-2"><span className="field-label">PESO · OPZIONALE</span><input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="80"/></label>
   </div>
   <div className="mt-4 rounded-2xl border border-line bg-panel2 p-4"><div className="flex items-center justify-between"><span className="field-label">LETTURA DI OGGI</span><strong className={status.tone}>{status.label}</strong></div><p className="mt-2 text-[10px] leading-5 text-zinc-500">{status.detail}</p></div>
   <div className="mt-4 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={onSkip}>SALTA</button><button className="primary-cta" onClick={save}>INIZIA ALLENAMENTO</button></div>
 </div></div>;
}
function WorkoutPlayer({state,setState,refresh}:{state:any;setState:(x:any)=>void;refresh:()=>void}){
 useWakeLock(true);
 const [active,setActive]=useState(state),[showReadiness,setShowReadiness]=useState(!state.readiness||Object.keys(state.readiness||{}).length===0),[final,setFinal]=useState<SessionSummary|null>(null),[sound,setSound]=useState(getSetting("sound",true)),[vibration,setVibration]=useState(getSetting("vibration",true)),[exitAsk,setExitAsk]=useState(false),[skipAsk,setSkipAsk]=useState(false),[modifyAsk,setModifyAsk]=useState(false),[modification,setModification]=useState(""),[exerciseStarted,setExerciseStarted]=useState(false),[coachLinked,setCoachLinked]=useState(false),[transitionNext,setTransitionNext]=useState<number|null>(null),[sessionElapsed,setSessionElapsed]=useState(()=>Math.max(0,Math.floor((Date.now()-state.started)/1000)));
 useEffect(()=>{fetchMyCoach().then(c=>setCoachLinked(Boolean(c))).catch(()=>setCoachLinked(false))},[]);
 const advanceLock=useRef(false);
 const startedExerciseRef=useRef<string|null>(null);
 useEffect(()=>{setExerciseStarted(false);startedExerciseRef.current=null},[active.index,transitionNext]);
 useEffect(()=>{saveDraft(active)},[active]);
 useEffect(()=>{
   const tick=()=>setSessionElapsed(Math.max(0,Math.floor((Date.now()-active.started)/1000)));
   tick();
   const id=window.setInterval(tick,1000);
   return()=>window.clearInterval(id);
 },[active.started]);
 const ep=effectiveProgram(active.day as DayKey),block:ExerciseBlock|undefined=active.index>=0?ep.blocks[active.index]:undefined,total=ep.blocks.length;
 const flowCopy=workoutFlowCopy(active.day as DayKey,currentPhase(Date.now()),block,final||undefined);
 const next=(l:WorkoutLog)=>{
   if(advanceLock.current)return;
   advanceLock.current=true;
   if(l.status==="skipped") track("exercise_skipped",{day:active.day,exerciseId:l.exerciseId,kind:l.kind});
   else if(l.status==="modified") track("exercise_substituted",{day:active.day,exerciseId:l.exerciseId,kind:l.kind,hasModification:Boolean(l.modification)});
   else track("exercise_completed",{day:active.day,exerciseId:l.exerciseId,kind:l.kind});
   const logs=[...active.logs.filter((x:WorkoutLog)=>x.exerciseId!==l.exerciseId),l];
   if(active.index===total-1){
     appendLogs(logs);const s=buildSession({...active},logs);saveSession(s);clearDraft();track("workout_completed",{day:s.day});setFinal(s);
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
   track("transition_recovery_completed",{day:active.day,nextExerciseId:ep.blocks[transitionNext]?.id||"unknown",seconds:180});
   const nextIndex=transitionNext;
   setTransitionNext(null);
   setActive((a:any)=>({...a,index:nextIndex}));
 };
 const confirmSkip=()=>{if(!block)return;setSkipAsk(false);next({id:crypto.randomUUID(),sessionId:active.id,date:Date.now(),day:active.day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName:currentVariantFor(block.id,block.name),kind:block.kind,status:"skipped",prescription:prescriptionSnapshot(block),result:{note:"Skipped"}})};
 const confirmModify=()=>{if(!block)return;const text=modification.trim();if(!text)return;setModifyAsk(false);setModification("");next({id:crypto.randomUUID(),sessionId:active.id,date:Date.now(),day:active.day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName:currentVariantFor(block.id,block.name),kind:block.kind,status:"modified",modification:text,prescription:prescriptionSnapshot(block),result:{note:`Substituted: ${text}`}})};
 const back=()=>{if(transitionNext!==null){const previous=Math.max(-1,transitionNext-1);setTransitionNext(null);setActive((a:any)=>({...a,index:previous}));return}setActive((a:any)=>({...a,index:Math.max(-1,a.index-1)}))};
 const tick=()=>{if(vibration)beep()};
 if(final)return <Summary session={final} close={()=>setState(null)} onSave={s=>setFinal(s)}/>;
 if(showReadiness&&active.index<0)return <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-ink text-white"><div className="mx-auto flex w-full max-w-4xl flex-1 px-4"><ReadinessGate readiness={active.readiness||{}} onSave={r=>{track("readiness_submitted",{day:active.day,providedEnergy:r.energy!==undefined,providedSleep:r.sleepHours!==undefined});setActive((a:any)=>({...a,readiness:r}));setShowReadiness(false);}} onSkip={()=>{track("readiness_skipped",{day:active.day});setShowReadiness(false)}}/></div></div>;
 const progress=active.index<0?0:Math.min(100,((active.index+1)/total)*100);
 return <div className="workout-player-shell fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-ink text-white">
  <div className="workout-player-header shrink-0 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
   <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
    <button className="flex min-h-10 min-w-10 items-center justify-start text-zinc-400" onClick={back} aria-label="Indietro"><ArrowLeft size={18}/></button>
    <div className="flex items-center gap-3 text-center">
      <div className="text-[11px] font-bold tabular-nums tracking-[.04em] text-zinc-300" aria-label={`Session time ${formatClock(sessionElapsed)}`}>{formatClock(sessionElapsed)}</div>
      <div className="hidden text-[7px] font-bold tracking-[.16em] text-zinc-700 sm:block">TEMPO</div>
      <div className="text-[9px] tracking-[.14em] text-zinc-600">{active.index<0?"WARM-UP":transitionNext!==null?"RECOVERY":`${active.index+1}/${total}`}</div>
    </div>
    <div className="flex items-center gap-2"><button className="flex min-h-10 items-center gap-1 text-[8px] font-bold tracking-[.08em] text-zinc-600" onClick={()=>{setSound(v=>{setSetting("sound",!v);return !v});initAudio()}} aria-label={sound?"Mute sounds":"Enable sounds"}>{sound?<Volume2 size={13}/>:<VolumeX size={13}/>}</button><button className="text-[8px] font-bold tracking-[.08em] text-zinc-600" onClick={()=>{setVibration(v=>{setSetting("vibration",!v);return !v})}}>{vibration?"HAPTIC":"SILENT"}</button><button className="min-h-10 min-w-10 text-right text-[9px] font-bold tracking-[.1em] text-zinc-500" onClick={()=>{track("workout_exit_opened",{day:active.day,index:active.index});setExitAsk(true)}}>ESCI</button></div>
   </div><div className="h-0.5 bg-zinc-900"><div className="h-full bg-violet-500 transition-all" style={{width:`${progress}%`}}/></div>
  </div>
  <div className="workout-player-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="workout-player-content mx-auto flex min-h-full max-w-4xl flex-col px-4 py-5 pb-28 sm:py-7 sm:pb-32">
   {active.index<0?<WarmupPlayer steps={ep.warmup} sound={sound} vibration={vibration} onDone={()=>setActive((a:any)=>({...a,index:0}))}/>:transitionNext!==null?<TransitionRecovery seconds={180} sound={sound} vibration={vibration} nextLabel={ep.blocks[transitionNext]?.name||"prossimo esercizio"} onDone={finishTransition}/>:<><div className="workout-coach-note mb-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-3"><div className="flex items-center justify-between gap-3"><div><div className="section-kicker">{flowCopy.phase} · {flowCopy.day}</div><div className="mt-1 text-[12px] font-extrabold">{flowCopy.headline}</div></div><span className="tag">OGGI</span></div><p className="mt-2 text-[9px] leading-4 text-zinc-500">{displayBlockDetail(block!,uiCopy)}</p>{coachNoteForBlock(block!,uiCopy)&&<div className="mt-2 text-[9px] font-bold tracking-[.06em] text-violet2"><span className="text-zinc-600">COACH · </span>{coachNoteForBlock(block!,uiCopy)}</div>}</div><div className="workout-context"><div><span className="tag">{LABEL[block!.kind]}</span><div className="mt-1 text-[9px] font-bold tracking-[.12em] text-zinc-600">EXERCISE {active.index+1} OF {total}</div></div><div className="workout-context-progress"><div className="workout-context-progress-bar"><span style={{width:`${Math.round(((active.index+1)/total)*100)}%`}}/></div><span>{Math.round(((active.index+1)/total)*100)}%</span></div></div><h2 className="workout-exercise-title mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">{currentVariantFor(block!.id,block!.name)}</h2><div className="workout-rest-meta mt-2 flex items-center gap-2 text-[9px] text-zinc-600"><Timer size={12}/><span>{block!.kind==="EMOM"?`${block!.minutes||10} min EMOM`:`${block!.rest||0}s recupero tra le serie`}</span></div><BlockPlayer key={block!.id} block={block!} day={active.day} vibration={vibration} sound={sound} existing={active.logs.find((x:WorkoutLog)=>x.exerciseId===block!.id)} onComplete={next} onTick={tick} onStarted={()=>{setExerciseStarted(true);if(block&&startedExerciseRef.current!==block.id){startedExerciseRef.current=block.id;track("exercise_started",{day:active.day,exerciseId:block.id,kind:block.kind})}}} onProgress={(partial)=>setActive((a:any)=>({...a,logs:[...a.logs.filter((x:WorkoutLog)=>x.exerciseId!==block!.id),partial]}))}/></>}
  </div></div>
  {active.index>=0&&transitionNext===null&&!exerciseStarted&&<div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+12px)]"><div className="mx-auto flex max-w-4xl justify-center gap-2 px-4"><button onClick={()=>setModifyAsk(true)} className="pointer-events-auto rounded-full border border-violet-500/20 bg-ink/95 px-4 py-2 text-[9px] font-bold tracking-[.12em] text-violet-300 shadow-xl backdrop-blur-xl">SUBSTITUTE</button><button onClick={()=>setSkipAsk(true)} className="pointer-events-auto rounded-full border border-line bg-ink/95 px-4 py-2 text-[9px] font-bold tracking-[.12em] text-zinc-500 shadow-xl backdrop-blur-xl">SALTA ESERCIZIO</button></div></div>}
  {exitAsk&&<div className="workout-modal fixed inset-0 z-[70] flex items-end bg-black/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"><div className="mx-auto w-full max-w-xl rounded-t-3xl border border-line bg-panel p-5"><div className="eyebrow">ABBANDONARE L’ALLENAMENTO?</div><h2 className="mt-2 text-2xl font-extrabold">Questa sessione non è terminata.</h2><p className="mt-2 text-xs text-muted">Riprendila più tardi, continua ad allenarti oppure elimina la bozza.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><button className="secondary-cta" onClick={()=>setExitAsk(false)}>KEEP TRAINING</button><button className="secondary-cta" onClick={()=>{track("workout_draft_saved",{day:active.day,index:active.index});saveDraft(active);setState(null)}}>SAVE DRAFT & EXIT</button><button className="danger-cta" onClick={()=>{track("workout_discarded",{day:active.day,index:active.index});clearDraft();setState(null)}}>ELIMINA</button></div></div></div>}
  {skipAsk&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5"><div className="eyebrow">SALTA</div><h2 className="mt-2 text-xl font-extrabold">Saltare questo esercizio?</h2><p className="mt-2 text-xs text-muted">Verrà registrato come saltato e l’allenamento continuerà dopo i 3 minuti di recupero di transizione.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setSkipAsk(false)}>ANNULLA</button><button className="primary-cta" onClick={confirmSkip}>SALTA</button></div></div></div>}
  {modifyAsk&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5"><div className="eyebrow">SUBSTITUTE</div><h2 className="mt-2 text-xl font-extrabold">What did you do instead?</h2><p className="mt-2 text-xs text-muted">The original exercise is logged as modified. The workout will continue after the transition recovery.</p><input autoFocus className="mt-4 w-full" value={modification} onChange={e=>setModification(e.target.value)} placeholder="e.g. Dragon Flag" onKeyDown={e=>{if(e.key==="Enter")confirmModify()}}/><div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>{setModifyAsk(false);setModification("")}}>ANNULLA</button><button className="primary-cta" disabled={!modification.trim()} onClick={confirmModify}>SAVE SUBSTITUTE</button></div></div></div>}
 </div>
}

function TransitionRecovery({seconds,nextLabel,onDone,sound=true,vibration=true}:{seconds:number;nextLabel:string;onDone:()=>void;sound?:boolean;vibration?:boolean}){
 return <Rest seconds={seconds} sound={sound} vibration={vibration} label="RECUPERO DI TRANSIZIONE" nextLabel={nextLabel} onSkip={onDone} onDone={onDone}/>;
}

function buildSession(a:{id:string;started:number;day:DayKey;readiness:Readiness;sessionNote?:string;sessionFatigue?:1|2|3|4|5},logs:WorkoutLog[]):SessionSummary{
 const sessionId=String(a.started);
 const normalizedLogs=logs.map(l=>({...l,sessionId}));
 const standardReps=normalizedLogs.reduce((s,l)=>s+(l.result.reps?.reduce((x,y)=>x+y,0)||0),0);
 const emomReps=normalizedLogs.reduce((s,l)=>s+(l.result.emom?.reduce((x,y)=>x+y,0)||0),0);
 return{id:sessionId,date:Date.now(),day:a.day,durationSec:Math.round((Date.now()-a.started)/1000),readiness:a.readiness,logs:normalizedLogs,totalReps:totalSessionReps(normalizedLogs),emomReps,bestSkillSeconds:normalizedLogs.filter((l:WorkoutLog)=>l.kind==="SKILL_STATIC").reduce((m,l)=>Math.max(m,Math.max(...(l.result.seconds||[0]))),0)};
}

function coachingRecord(log:WorkoutLog, session?:SessionSummary){return {exerciseId:log.exerciseId,status:log.status,result:log.result,session:{readiness:session?.readiness,date:log.date}};}
function coachingRecordForLog(log:WorkoutLog){
 const session=getSessions().find(s=>s.id===log.sessionId);
 return coachingRecord(log,session);
}
function criteriaFor(block:ExerciseBlock){return criteriaForBlock(block);}
function meetsCurrentProgression(blockId:string, log:WorkoutLog):boolean{
 const block=Object.values(PROGRAM).flatMap(p=>p.blocks).find(b=>b.id===blockId)||effectiveProgram("Monday").blocks.find(b=>b.id===blockId);
 if(!block)return false;
 return evaluateProgression(block,coachingRecordForLog(log),criteriaFor(block)).qualifies;
}
function logVariantName(log:WorkoutLog){return log.variantName||log.exerciseName;}
function logVariantId(log:WorkoutLog){return exerciseExposureKeyString({exerciseId:log.exerciseId,variantId:log.variantId||log.exerciseId});}
function currentVariantLogs(block:ExerciseBlock){
 const current=getVariant(block.id);
 const currentId=current?.variantId||block.id;
 const currentPrescription={exerciseId:block.id,status:"complete",result:{},prescription:{variantId:currentId,targetRange:block.target,sets:block.sets,minutes:block.minutes,restSec:block.rest,kind:block.kind}} as any;
 return getLogs()
   .filter(x=>x.exerciseId===block.id&&!x.skipped&&(x.status==="complete"||x.status==="modified")&&logVariantId(x)===exerciseExposureKeyString({exerciseId:block.id,variantId:currentId}))
   .filter(x=>isSamePrescription(currentPrescription,{exerciseId:x.exerciseId,status:x.status,result:x.result,prescription:x.prescription} as any))
   .sort((a,b)=>a.date-b.date);
}
function progressionCount(blockId:string, block:ExerciseBlock){
 const logs=currentVariantLogs(block);
 const criteria=variantMasteryCriteria(block);
 const streak=progressionStreak(block,logs.slice(-Math.max(2,criteria.consecutiveSessions||2)).map(l=>coachingRecord(l)),criteria);
 const required=criteria.consecutiveSessions||1;
 if(streak>=required)return {state:"PRONTO",label:"PRONTO PER REVISIONE COACH",detail:`Criterion reached in ${required} consecutive qualifying exposures.`};
 if(streak>0)return {state:`${streak}/${required}`,label:`${streak}/${required} QUALIFYING EXPOSURES`,detail:"Ripeti questo standard ancora una volta prima di cambiare variante."};
 return {state:"HOLD",label:"KEEP CURRENT VARIANT",detail:"Continua a progredire nella prescrizione attuale."};
}

function currentVariantFor(exerciseId:string, fallback:string){
 const o=getProgramOverride(exerciseId); if(o?.name)return o.name;
 const v=getVariant(exerciseId);
 return v?.variantName||fallback;
}
function nextLadderVariant(exerciseId:string, currentName:string){
 const key=exerciseId==="pike-feet"?"pike":exerciseId;
 const ladder=getProgressionLadder(key);
 if(!ladder)return null;
 const idx=ladder.findIndex(x=>x.name===currentName);
 return ladder[Math.min(ladder.length-1,idx+1)]||ladder[0];
}
function PromotionPanel({block,coachLinked=false}:{block:ExerciseBlock;coachLinked?:boolean}){
  if(coachLinked || !PROGRESSIONS[block.id]) return null;
  const currentName=currentVariantFor(block.id,PROGRESSIONS[block.id].current);
  const logs=currentVariantLogs(block);
  const spec=progressionSpecForBlock(block,getProgressionLadder(block.id)[1]?.id||block.id);
  const criteria=spec.variantMastery.criteria;
  const streak=progressionStreak(block,logs.slice(-Math.max(2,criteria.consecutiveSessions||2)).map(coachingRecordForLog),criteria);
  return <div className="my-3 rounded-2xl border border-line bg-panel p-4">
    <div className="flex items-start justify-between gap-3"><div><span className="field-label">VARIANTE ATTUALE</span><div className="mt-1 text-sm font-bold">{currentName}</div></div><span className="tag">SOLO REVISIONE COACH</span></div>
    <div className="mt-3 text-[9px] text-zinc-500">{streak}/{criteria.consecutiveSessions||1} consecutive qualifying exposures. Any progression must be generated as a proposal and accepted from the session review.</div>
  </div>;
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
  <div className="mt-6 grid grid-cols-2 gap-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-4 sm:mt-auto sm:pt-8"><button className="secondary-cta" onClick={()=>setI(Math.max(0,i-1))} disabled={i===0}>BACK</button>{i<steps.length-1?<button className="primary-cta" onClick={next}>PROSSIMO</button>:<button className="primary-cta" onClick={onDone}>START FIRST EXERCISE</button>}</div>
  <button className="mt-3 min-h-10 w-full rounded-xl border border-line bg-transparent px-4 py-2 text-[9px] font-bold tracking-[.12em] text-zinc-500 transition hover:text-zinc-300" onClick={onDone}>SALTA WARM-UP</button>
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
 return <div className="rest-player flex flex-1 flex-col items-center justify-center py-8">
   <div className="text-center"><div className="field-label">{label}</div>{nextLabel&&<div className="mt-2 text-sm font-bold text-zinc-300">NEXT · {nextLabel}</div>}</div>
   <div className="relative mt-8 h-[232px] w-[232px]">
     <svg className="h-full w-full -rotate-90" viewBox="0 0 232 232" aria-hidden="true"><circle cx="116" cy="116" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-900"/><circle cx="116" cy="116" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-violet-400 transition-[stroke-dashoffset] duration-200" strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}/></svg>
     <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-6xl font-extrabold tracking-tighter tabular-nums">{formatClock(sec)}</div><div className="mt-2 text-[9px] font-bold tracking-[.16em] text-zinc-600">{label}</div></div>
   </div>
   <button onClick={onSkip} className="mt-8 min-h-10 rounded-xl border border-line px-5 text-[9px] font-bold tracking-[.12em] text-zinc-500">SALTA {label}</button>
 </div>
}

function range(target:string){const n=target.match(/\d+(?:\.\d+)?/g)?.map(Number)||[];return{min:n[0]||1,max:n[1]??n[0]??1}}
function TargetPanel({block,target,onChange}:{block:ExerciseBlock;target:number;onChange:(value:number)=>void}){
 const r=range(block.target);
 const density=block.trainingMethod==="DENSITY_5X70";
 return <div className="target-panel rounded-2xl border border-line bg-panel p-4"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">{density?"TARGET CALCOLATO":"TARGET RANGE"}</span><div className="mt-1 text-sm font-bold">{block.target}{density?" reps / set":""}</div></div><div className="text-right"><span className="field-label">{density?"70% DEL MASSIMALE":"OBIETTIVO DI OGGI"}</span>{density?<div className="mt-1 text-sm font-extrabold text-violet2">{target} reps</div>:<div className="mt-1 flex items-center justify-end gap-2"><button className="mini-btn" disabled={target<=r.min} onClick={()=>onChange(target-1)}><Minus size={14}/></button><b className="w-8 text-center">{target}</b><button className="mini-btn" disabled={target>=r.max} onClick={()=>onChange(target+1)}><Plus size={14}/></button></div>}</div></div></div>
}
function SetBlock({block,day,onComplete,onStarted,existing,onProgress,sound,vibration}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void;sound:boolean;vibration:boolean}){
 const r=range(block.target),overrideUpdatedAt=getProgramOverride(block.id)?.updatedAt||0,[reps,setReps]=useState<number[]>(()=>existing?.result.reps||[]),[input,setInput]=useState(""),[rest,setRest]=useState(false),[band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue!==undefined?String(existing.result.fatigue):""),[editing,setEditing]=useState<number|null>(null),[editValue,setEditValue]=useState(""),[target,setTargetLocal]=useState(()=>existing?.prescription?.todayTarget??effectiveTodayTarget(block,r));
 const variantName=currentVariantFor(block.id,block.name),prev=latestLog(day,block.id,existing?.date,getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id),last=prev?.result.reps?.[reps.length],max=block.sets||1,complete=reps.length>=max;
 const setTarget=(value:number)=>{const next=Math.max(r.min,Math.min(r.max,value));setTargetLocal(next);setTodayTarget(block.id,next,r.min,r.max)};
 const makeLog=(status:BlockStatus,nextReps:number[]):WorkoutLog=>({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status,prescription:prescriptionSnapshot(block,target),result:{reps:nextReps,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,note:`Today target ${target}/set`}});
 const persist=(next:number[])=>onProgress(makeLog("incomplete",next));
 const saveSet=()=>{const n=Number(input);if(!Number.isFinite(n)||n<0||complete||rest)return;const next=[...reps,n];setReps(next);setInput("");setRest(shouldRestAfterStandardSet(next.length,max));onStarted();persist(next)};
 const finish=(status:BlockStatus)=>{if(block.trainingMethod!=="DENSITY_5X70")setTodayTarget(block.id,target,r.min,r.max);onComplete(makeLog(status,reps));};
 const diff=last!==undefined&&input!==""?Number(input)-last:null;
 return <div className="set-player flex flex-1 flex-col pt-5"><TargetPanel block={block} target={target} onChange={setTarget}/><div className="mt-6 text-center"><div className="text-[9px] tracking-[.15em] text-zinc-600">SET {Math.min(reps.length+1,max)} / {max}</div><span className="field-label mt-3">RIPETIZIONI</span><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={complete} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label="Reps completed this set" className="counter-input" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={complete}/><button className="counter-btn" disabled={complete} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div>{last!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">ULTIMA SERIE · {last} reps{diff!==null&&<span className={`ml-2 ${diff>=0?"text-emerald-400":"text-rose-300"}`}>{diff>=0?`+${diff}`:`${diff}`}</span>}</div>}</div><div className="mt-6 grid gap-2 sm:grid-cols-2">{!complete&&!rest&&<button className="primary-cta sm:col-span-2" onClick={saveSet}>SALVA SERIE</button>}{complete&&!rest&&<button className="primary-cta sm:col-span-2" onClick={()=>finish("complete")}>PROSSIMO ESERCIZIO</button>}{complete&&rest&&<button className="secondary-cta sm:col-span-2" disabled>RECUPERO PRIMA DEL PROSSIMO ESERCIZIO</button>}{reps.length>0&&!complete&&<button className="secondary-cta sm:col-span-2" onClick={()=>finish("incomplete")}>SALVA INCOMPLETO</button>}</div>{rest&&<Rest seconds={block.rest} sound={sound} vibration={vibration} onSkip={()=>setRest(false)} onDone={()=>setRest(false)}/>}<div className="mt-4 flex flex-wrap justify-center gap-2">{reps.map((r,i)=><button className="chip" key={i} title="Tocca per modificare questa serie" onClick={()=>{setEditing(i);setEditValue(String(r))}}>SERIE {i+1}: {r}</button>)}</div>{editing!==null&&<div className="mt-3 rounded-xl border border-line bg-panel p-3"><span className="field-label">MODIFICA SERIE {editing+1}</span><div className="mt-1 flex items-center gap-2"><button className="counter-btn" onClick={()=>setEditValue(String(Math.max(0,Number(editValue||0)-1)))}><Minus size={16}/></button><input className="counter-input flex-1" inputMode="numeric" value={editValue} onChange={e=>setEditValue(e.target.value.replace(/\D/g,""))}/><button className="counter-btn" onClick={()=>setEditValue(String(Number(editValue||0)+1))}><Plus size={16}/></button></div><div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setEditing(null)}>ANNULLA</button><button className="primary-cta" onClick={()=>{const n=Number(editValue);if(Number.isFinite(n)&&n>=0){const next=reps.map((x,j)=>j===editing?n:x);setReps(next);persist(next)}setEditing(null)}}>SALVA MODIFICA</button></div></div>}<div className="mt-auto pb-4 pt-8">{block.bandOptions&&<label className="block mb-3"><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<EffortPicker rir={rir} setRir={setRir} fatigue={fatigue} setFatigue={setFatigue}/></div></div>
}

function EffortPicker({rir,setRir,fatigue,setFatigue}:{rir:string;setRir:(v:string)=>void;fatigue:string;setFatigue:(v:string)=>void}){return <div className="effort-panel mt-4 rounded-2xl border border-line bg-panel p-3"><div className="grid gap-4 sm:grid-cols-2"><div><div className="flex items-center justify-between"><span className="field-label">QUANTE REPS AVEVI ANCORA?</span>{rir!==''&&<span className="text-[8px] font-bold text-violet2">{rirLabel(Number(rir))}</span>}</div><div className="mt-2 grid grid-cols-4 gap-2">{RIR_OPTIONS.map(v=><button type="button" key={v} onClick={()=>setRir(rir===String(v)?'':String(v))} aria-pressed={rir===String(v)} className={`rounded-xl border px-2 py-3 text-[10px] font-extrabold transition ${rir===String(v)?'effort-option-active':'effort-option'}`}>{v===3?'3+':v}</button>)}</div></div><div><div className="flex items-center justify-between"><span className="field-label">QUANTO È STATA DURA?</span>{fatigue!==''&&<span className="text-[8px] font-bold text-violet2">{fatigueLabel(Number(fatigue))}</span>}</div><div className="mt-2 grid grid-cols-5 gap-1.5">{FATIGUE_OPTIONS.map(v=><button type="button" key={v} onClick={()=>setFatigue(fatigue===String(v)?'':String(v))} aria-pressed={fatigue===String(v)} className={`rounded-xl border px-1 py-3 text-[10px] font-extrabold transition ${fatigue===String(v)?'effort-option-active':'effort-option'}`}>{v}</button>)}</div><div className="mt-1 text-right text-[8px] text-zinc-600">1 facile · 5 quasi esausto</div></div></div></div>}

function SideSetBlock({block,day,onComplete,onStarted,existing,onProgress,sound,vibration}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void;sound:boolean;vibration:boolean}){
 const rounds=block.sets||1,totalSides=block.id==="oap"?rounds:rounds*2,totalRounds=block.id==="oap"?Math.ceil(rounds/2):rounds,[side,setSide]=useState<"R"|"L">(()=>existing?.result.sides?.[existing.result.sides.length-1]==="R"?"L":"R"),[reps,setReps]=useState<number[]>(()=>existing?.result.reps||[]),[sides,setSides]=useState<("R"|"L")[]>(()=>existing?.result.sides||[]),[input,setInput]=useState(""),[band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue!==undefined?String(existing.result.fatigue):""),[rest,setRest]=useState(false);
 const variantName=currentVariantFor(block.id,block.name),prev=latestLog(day,block.id,existing?.date,getVariant(block.id)?.variantId||block.id),pr=prev?.result.reps||[],ps=prev?.result.sides||[],complete=reps.length>=totalSides,currentIndex=reps.length,round=Math.floor(currentIndex/2)+1;
 const persist=(nextReps:number[],nextSides:("R"|"L")[])=>onProgress({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status:"incomplete",prescription:prescriptionSnapshot(block),result:{reps:nextReps,sides:nextSides,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined}});
 const save=()=>{const n=Number(input);if(!Number.isFinite(n)||n<0||complete||rest)return;const savedSide=side,nextReps=[...reps,n],nextSides=[...sides,savedSide],isLastSide=nextReps.length>=totalSides;setReps(nextReps);setSides(nextSides);setInput("");onStarted();persist(nextReps,nextSides);if(savedSide==="R")setSide("L");else setSide("R");setRest(shouldRestAfterSideSet(nextReps.length,totalSides,savedSide))};
 const finish=(status:BlockStatus)=>onComplete({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status,prescription:prescriptionSnapshot(block),result:{reps,sides,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined}});
 const r=range(block.target);
 return <div className="side-set-player flex flex-1 flex-col pt-5"><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="flex items-end justify-between gap-4"><div><span className="field-label">SIDE</span><div className="mt-1 text-2xl font-extrabold">{side==="R"?"DESTRA":"SINISTRA"}</div><div className="mt-1 text-[10px] text-muted">ROUND {Math.min(round,totalRounds)} / {totalRounds}</div></div><div className="text-right"><span className="field-label">TARGET / LATO</span><div className="mt-1 text-sm font-extrabold">{r.min===r.max?r.min:`${r.min}–${r.max}`} reps</div></div></div></div><div className="mt-6 text-center"><div className="text-[9px] tracking-[.15em] text-zinc-600">SIDE {Math.min(reps.length+1,totalSides)} / {totalSides}</div><span className="field-label mt-3">RIPETIZIONI</span><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={complete} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label={`Reps completed ${side==="R"?"right":"left"}`} className="counter-input" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={complete}/><button className="counter-btn" disabled={complete} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div>{pr[currentIndex]!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">LAST {ps[currentIndex]==="R"?"DESTRA":"SINISTRA"}: <b className="text-white">{pr[currentIndex]}</b></div>}</div>{!complete&&!rest&&<button className="primary-cta mt-6" onClick={save}>SAVE {side==="R"?"DESTRA":"SINISTRA"}</button>}{complete&&!rest&&<button className="primary-cta mt-2" onClick={()=>finish("complete")}>PROSSIMO ESERCIZIO</button>}{complete&&rest&&<button className="secondary-cta mt-2" disabled>RECUPERO PRIMA DEL PROSSIMO ESERCIZIO</button>}{reps.length>0&&!complete&&<button className="secondary-cta mt-2" onClick={()=>finish("incomplete")}>SALVA INCOMPLETO</button>}{rest&&<Rest seconds={block.rest} sound={sound} vibration={vibration} onSkip={()=>setRest(false)} onDone={()=>setRest(false)}/>}<div className="mt-5 flex flex-wrap justify-center gap-2">{reps.map((r,i)=><button className="chip" key={i} onClick={()=>{setReps(v=>v.filter((_,j)=>j!==i));setSides(v=>v.filter((_,j)=>j!==i))}}>{sides[i]} {i+1}: {r}</button>)}</div><div className="mt-auto pb-4 pt-8">{block.bandOptions&&<label className="block mb-3"><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<EffortPicker rir={rir} setRir={setRir} fatigue={fatigue} setFatigue={setFatigue}/></div></div>
}

function Emom({block,day,onComplete,onStarted,sound,vibration,existing,onProgress}:{block:ExerciseBlock;day:DayKey;onComplete:(l:WorkoutLog)=>void;onStarted:()=>void;sound:boolean;vibration:boolean;existing?:WorkoutLog;onProgress:(l:WorkoutLog)=>void}){
 const variantName=currentVariantFor(block.id,block.name),[minutes,setMinutesLocal]=useState(block.minutes||10),r=range(block.target),[vals,setVals]=useState<number[]>(()=>existing?.result.emom||[]),[input,setInput]=useState(""),[phase,setPhase]=useState<"ready"|"running"|"input"|"complete">(()=>existing?.result.emom?.length?"input":"ready"),[minute,setMinute]=useState((existing?.result.emom?.length||0)+1),[endAt,setEndAt]=useState(0),now=useNow(phase==="running"),[logged,setLogged]=useState(false),[target,setTargetLocal]=useState(()=>existing?.prescription?.todayTarget??effectiveTodayTarget(block,r)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue!==undefined?String(existing.result.fatigue):""),[editing,setEditing]=useState<number|null>(null),[editValue,setEditValue]=useState("");
 const remaining=Math.max(0,endAt?endAt-now:0),sec=Math.ceil(remaining/1000),prev=latestLog(day,block.id,existing?.date,getVariant(block.id)?.variantId||block.id)?.result.emom||[],last=prev[minute-1],lastCountdown=useRef<number|null>(null);
 const persist=(nextVals:number[])=>onProgress({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status:"incomplete",prescription:prescriptionSnapshot({...block,minutes},target),result:{emom:nextVals,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,note:`${minutes}-min EMOM · today target ${target}/min`}});
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
 const finish=(status:BlockStatus="complete")=>{setTodayTarget(block.id,target,r.min,r.max);onComplete({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status,prescription:prescriptionSnapshot({...block,minutes},target),result:{emom:vals,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,note:`${minutes}-min EMOM · today target ${target}/min`}})};
 const adjust=(d:number)=>{const next=Math.max(r.min,Math.min(r.max,target+d));setTargetLocal(next);setTodayTarget(block.id,next,r.min,r.max)};
 const adjustMinutes=(d:number)=>{const next=Math.max(5,Math.min(15,minutes+d));setMinutesLocal(next);setEmomDuration(block.id,next);};
 const diff=last!==undefined&&input!==""?Number(input)-last:null,canFinish=phase==="complete"&&vals.length>=minutes;
 return <div className="emom-player flex flex-1 flex-col pt-4"><div className="text-center"><div className="text-[9px] tracking-[.16em] text-zinc-600">MINUTE {Math.min(minute,minutes)} / {minutes}</div><div className="mt-2 text-7xl font-extrabold">{phase==="ready"?"01:00":phase==="running"?formatClock(sec):phase==="input"?"INVIO":"FATTO"}</div><div className="mt-4 rounded-2xl border border-line bg-panel p-4 text-left"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">RANGE / MIN</span><div className="font-bold">{block.target}</div></div><div className="text-right"><span className="field-label">OBIETTIVO DI OGGI</span><div className="mt-1 flex justify-end gap-2"><button className="mini-btn" disabled={target<=r.min} onClick={()=>adjust(-1)}><Minus size={14}/></button><b>{target}</b><button className="mini-btn" disabled={target>=r.max} onClick={()=>adjust(1)}><Plus size={14}/></button></div></div></div><div className="mt-4 border-t border-line pt-3"><div className="flex items-center justify-between"><span className="field-label">DURATA</span><span className="text-[9px] text-zinc-600">Consigliato {block.minutes||10} min</span></div><div className="mt-2 flex items-center justify-between gap-2"><button className="mini-btn" disabled={minutes<=5||phase!=="ready"} onClick={()=>adjustMinutes(-1)}><Minus size={14}/></button><div className="text-center"><div className="text-2xl font-extrabold">{minutes} min</div><div className="text-[8px] text-zinc-600">5–15 min · prima di iniziare</div></div><button className="mini-btn" disabled={minutes>=15||phase!=="ready"} onClick={()=>adjustMinutes(1)}><Plus size={14}/></button></div></div></div>{last!==undefined&&<div className="mt-3 text-[10px] text-zinc-500">ULTIMA ESPOSIZIONE · M{minute}: <b className="text-white">{last}</b>{diff!==null&&<span className={`ml-2 ${diff>=0?"text-emerald-400":"text-rose-300"}`}>{diff>=0?`+${diff} vs precedente`:`${diff} vs precedente`}</span>}</div>}</div>{(phase==="running"||phase==="input")&&<div className="mt-7 rounded-2xl border border-line bg-panel p-4"><div className="field-label">REPS DI QUESTO MINUTO</div><div className="mt-2 flex items-center justify-center gap-2"><button className="counter-btn" disabled={logged} onClick={()=>setInput(String(Math.max(0,(Number(input)||0)-1)))}><Minus size={16}/></button><input aria-label="Ripetizioni di questo minuto" className="counter-input w-36" inputMode="numeric" value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,""))} placeholder="0" disabled={logged}/><button className="counter-btn" disabled={logged} onClick={()=>setInput(String((Number(input)||0)+1))}><Plus size={16}/></button></div><button className="primary-cta mt-2 w-full" disabled={logged||input===""} onClick={saveMinute}>{logged?`M${minute} SALVATO`:`SALVA M${minute}`}</button></div>}{phase==="ready"&&<button className="primary-cta mt-7 w-full" onClick={start}><Play size={15}/>INIZIA EMOM · {minutes} MIN</button>}{canFinish&&<button className="primary-cta mt-5 w-full" onClick={()=>finish("complete")}>SALVA E AVANTI</button>}{vals.length>0&&phase!=="complete"&&<button className="secondary-cta mt-2 w-full" onClick={()=>finish("incomplete")}>SALVA INCOMPLETO</button>}<div className="mt-5 flex flex-wrap justify-center gap-2">{vals.map((v,i)=><button className="chip" key={i} title="Tocca per modificare questo minuto" onClick={()=>{setEditing(i);setEditValue(String(v))}}>M{i+1}: {v}</button>)}</div>{editing!==null&&<div className="mt-3 rounded-xl border border-line bg-panel p-3"><span className="field-label">MODIFICA MINUTO {editing+1}</span><div className="mt-1 flex items-center gap-2"><button className="counter-btn" onClick={()=>setEditValue(String(Math.max(0,Number(editValue||0)-1)))}><Minus size={16}/></button><input className="counter-input flex-1" inputMode="numeric" value={editValue} onChange={e=>setEditValue(e.target.value.replace(/\D/g,""))}/><button className="counter-btn" onClick={()=>setEditValue(String(Number(editValue||0)+1))}><Plus size={16}/></button></div><div className="mt-2 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setEditing(null)}>ANNULLA</button><button className="primary-cta" onClick={()=>{const n=Number(editValue);if(n>=0){const next=vals.map((x,j)=>j===editing?n:x);setVals(next);persist(next)}setEditing(null)}}>SALVA MODIFICA</button></div></div>}{vals.length>0&&<div className="mt-4 rounded-xl border border-line bg-panel p-3 text-center text-[10px] text-muted">TOTALE <b className="text-white">{emomStats(vals).total}</b> · MEDIA <b className="text-white">{emomStats(vals).avg.toFixed(1)}</b> · CALO <b className="text-white">{emomStats(vals).drop.toFixed(0)}%</b></div>}<div className="mt-auto pb-4 pt-8"><EffortPicker rir={rir} setRir={setRir} fatigue={fatigue} setFatigue={setFatigue}/></div></div>
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
 const todayTarget=effectiveTodayTarget(block,r);
 const lastSession=latestLog(day,block.id,existing?.date,getVariant(block.id)?.variantId||block.id);
 const [band,setBand]=useState<Band>(()=>existing?.result.band||defaultBandFor(block)),[rir,setRir]=useState(()=>existing?.result.rir!==undefined?String(existing.result.rir):""),[fatigue,setFatigue]=useState(()=>existing?.result.fatigue!==undefined?String(existing.result.fatigue):""),[attemptQuality,setAttemptQuality]=useState<"Clean"|"Shaky"|"Lost position"|undefined>(undefined),[resting,setResting]=useState(false);
 const lastSeries=lastSession?.result.seconds?.[vals.length];
 const countdownRemaining=Math.max(0,countdownEnd?countdownEnd-now:0),count=Math.ceil(countdownRemaining/1000),elapsed=phase==="hold"?Math.min(r.max,Math.max(0,(now-started)/1000)):0,status=classifyIso(elapsed,r.min,r.max);
 const stopLock=useRef(false);
 useEffect(()=>{if(phase!=="count"||countdownRemaining>0)return;setStarted(Date.now());setPhase("hold");feedback("start",sound,vibration)},[phase,countdownRemaining,sound,vibration]);
 useEffect(()=>{if(phase!=="hold"||elapsed<r.max)return;stop()},[phase,elapsed,r.max]);
 const startCountdown=()=>{initAudio();stopLock.current=false;setCountdownEnd(Date.now()+5000);setPhase("count");onStarted()};
 const stop=()=>{if(stopLock.current||phase!=="hold")return;stopLock.current=true;const sec=Math.min(r.max,Number(elapsed.toFixed(1)));const next=[...vals,sec],nextQ=attemptQuality?[...qualities,attemptQuality]:[...qualities];setVals(next);setQualities(nextQ);setAttemptQuality(undefined);setPhase("stopped");if(sec>=r.max)feedback("complete",sound,vibration);else if(vibration){try{navigator.vibrate?.(50)}catch{}};onProgress({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status:"incomplete",prescription:prescriptionSnapshot(block),result:{seconds:next,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,quality:nextQ as ("Clean"|"Shaky"|"Lost position")[],note:`Coach range ${block.target}`}})};
 const finish=()=>onComplete({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status:"complete",prescription:prescriptionSnapshot(block),result:{seconds:vals,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,quality:qualities as ("Clean"|"Shaky"|"Lost position")[],note:`Coach range ${block.target}`}});
 const allInRange=vals.length>=Math.max(1,block.sets||3)&&vals.every(v=>v>=r.min&&v<=r.max),allClean=qualities.length===vals.length&&qualities.every(q=>q==="Clean"),maxed=vals.length>0&&vals.length>=Math.max(1,block.sets||3)&&vals.every(v=>v>=r.max);
 return <div className="static-skill-player flex flex-1 flex-col items-center pt-2">
   <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-4"><div className="grid grid-cols-2 gap-4"><div><span className="field-label">RANGE</span><div className="mt-1 text-sm font-bold">{r.min}–{r.max}s</div></div><div className="text-right"><span className="field-label">OGGI</span><div className="mt-1 text-sm font-bold text-violet2">{todayTarget.toFixed(1)}s</div></div></div><div className="mt-3 border-t border-line pt-3 text-center text-[9px] tracking-[.12em] text-zinc-600">SET {Math.min(vals.length+1,block.sets||3)} / {block.sets||3}</div></div>
   <div className="mt-4 text-center text-[10px] text-zinc-500">{lastSeries!==undefined?<>LAST SET {vals.length+1} <b className="text-white">{lastSeries.toFixed(1)}s</b></>:"NESSUN DATO PRECEDENTE"}</div>
   <div className="mt-8 text-center text-[92px] font-extrabold tracking-tighter sm:text-[132px]">{phase==="count"?count:phase==="hold"?elapsed.toFixed(1):"00.0"}<span className="text-xl text-zinc-600">{phase==="hold"?"s":""}</span></div>
   <div className={`mt-2 text-[9px] font-extrabold tracking-[.16em] ${phase==="hold"?(status==="BELOW"?"text-rose-300":status==="NEAR"?"text-amber-300":status==="MAX"?"text-emerald-400":"text-violet2"):"text-zinc-600"}`}>{phase==="count"?"PREPARATI":phase==="hold"?(status==="BELOW"?"SOTTO TARGET":status==="NEAR"?"VICINO AL TARGET":status==="MAX"?"TARGET RAGGIUNTO":"TARGET RAGGIUNTO"):phase==="stopped"?"SERIE SALVATA":"PRONTO"}</div>
   <div className="mt-6 w-full max-w-sm">{phase==="ready"&&<button className="primary-cta w-full" onClick={startCountdown}><Play size={15}/>INIZIA</button>}{phase==="count"&&<div className="text-center text-[10px] text-zinc-500">Preparati alla posizione.</div>}{phase==="hold"&&<button className="danger-cta w-full" onClick={stop}>FINE SERIE</button>}{phase==="stopped"&&<div className="rounded-2xl border border-line bg-panel p-4"><div className="text-center"><div className="text-3xl font-extrabold">{vals[vals.length-1]?.toFixed(1)}s</div><div className="mt-1 text-[9px] text-zinc-500">{classifyIso(vals[vals.length-1]||0,r.min,r.max)}</div></div><div className="mt-4"><span className="field-label">QUALITÀ</span><div className="mt-2 grid grid-cols-3 gap-2">{(["Clean","Shaky","Lost position"] as const).map(q=><button key={q} onClick={()=>setAttemptQuality(q)} className={`rounded-xl border px-2 py-3 text-[9px] font-bold ${attemptQuality===q?"border-violet-400 bg-violet-500/10 text-violet2":"border-line bg-panel2 text-zinc-500"}`}>{q==="Clean"?"PULITA":q==="Shaky"?"INSTABILE":"POSIZIONE PERSA"}</button>)}</div></div><div className="mt-4 grid grid-cols-2 gap-2">{vals.length<(block.sets||3)?<button className="secondary-cta" onClick={()=>{stopLock.current=false;setResting(true)}}>RECUPERA E AVANTI</button>:<button className="secondary-cta" disabled>TUTTO REGISTRATO</button>}{vals.length>=(block.sets||3)?<button className="primary-cta" onClick={finish}>SALVA E AVANTI</button>:<button className="secondary-cta" onClick={()=>onComplete({id:existing?.id||crypto.randomUUID(),sessionId:existing?.sessionId||`draft:${day}`,date:Date.now(),day,exerciseId:block.id,exerciseName:block.name,variantId:getProgramOverride(block.id)?.variantId||getVariant(block.id)?.variantId||block.id,variantName,kind:block.kind,status:"incomplete",prescription:prescriptionSnapshot(block,todayTarget),result:{seconds:vals,band,rir:rir?Number(rir):undefined,fatigue:fatigue?Number(fatigue):undefined,note:"Incomplete static skill"}})}>SALVA INCOMPLETO</button>}</div></div>}</div>
   {resting&&<div className="w-full max-w-sm"><Rest seconds={block.rest||0} sound={sound} vibration={vibration} onSkip={()=>{stopLock.current=false;setResting(false);setAttemptQuality(undefined);startCountdown()}} onDone={()=>{stopLock.current=false;setResting(false);setAttemptQuality(undefined);startCountdown()}}/></div>}
   {vals.length>0&&<div className="mt-5 w-full max-w-sm rounded-xl border border-line bg-panel2 p-3 text-center"><div className="flex flex-wrap justify-center gap-2">{vals.map((v,i)=><span key={i} className="chip">{v.toFixed(1)}s</span>)}</div>{maxed&&allClean&&<div className="mt-3 text-[9px] font-bold text-emerald-400">PROGRESSOIONE PRONTA</div>}{allInRange&&!maxed&&allClean&&<div className="mt-3 text-[9px] font-bold text-violet2">TARGET COMPLETATO</div>}</div>}
   <div className="mt-auto w-full max-w-sm pb-[calc(env(safe-area-inset-bottom)+8px)] pt-6">{block.bandOptions&&<label className="block mb-3"><span className="field-label">LOOP</span><select value={band} onChange={e=>setBand(e.target.value as Band)}>{block.bandOptions.map(b=><option key={b}>{b}</option>)}</select></label>}<EffortPicker rir={rir} setRir={setRir} fatigue={fatigue} setFatigue={setFatigue}/></div>
 </div>
}

function parseTargetRange(target:string){const m=String(target||"").match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);if(!m)return null;return{min:Number(m[1]),max:Number(m[2])};}
function proposeTargetProgression(block:ExerciseBlock,log:WorkoutLog,session?:SessionSummary):Omit<CoachProposal,"id"|"date">|null{
 if(log.status!=="complete"||block.trainingMethod==="DENSITY_5X70")return null;
 const criteria=criteriaForBlock(block);
 const history=currentVariantLogs(block).filter(x=>x.date<=log.date);
 const required=Math.max(2,criteria.consecutiveSessions||2);
 const recent=history.slice(-required);
 if(recent.length<required)return null;
 const streak=progressionStreak(block,recent.map(coachingRecordForLog),criteria);
 if(streak<required)return null;
 const decision=decideExposure(block,coachingRecordForLog(log),criteria);
 if(decision.decision!=="PROGRESS")return null;
 const range=parseTargetRange(block.target); if(!range)return null;
 const isStatic=block.trainingMethod==="STATIC_HOLD"||block.kind==="SKILL_STATIC"||block.previousMode==="seconds";
 const step=block.kind==="EMOM"?1:(range.max>=30?5:1);
 const nextMin=isStatic?range.min:Number((range.min+step).toFixed(1));
 const nextMax=Number((range.max+(isStatic?1:step)).toFixed(1));
 const suffix=block.kind==="SKILL_STATIC"?"s":"";
 return {type:"target",exerciseId:block.id,title:"Progress target — "+block.name,detail:"The upper target was reached across "+required+" consecutive comparable exposures with adequate RIR/stability/readiness.",from:block.target,to:nextMin+"–"+nextMax+suffix,reason:required+" consecutive exposures qualified on the same prescription; no progression is based on a single session.",status:"pending",sessionId:log.id};
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
     const targetProposal=proposeTargetProgression(block,log,session);
     if(targetProposal&&!current.some(p=>p.sessionId===targetProposal.sessionId&&p.exerciseId===targetProposal.exerciseId&&p.type===targetProposal.type&&p.to===targetProposal.to))saveCoachProposal(targetProposal);
     const densityProposal=proposeDensityRestProgression(block,log,getLogs());
     if(densityProposal&&!current.some(p=>p.sessionId===densityProposal.sessionId&&p.exerciseId===densityProposal.exerciseId&&p.type===densityProposal.type&&p.to===densityProposal.to))saveCoachProposal(densityProposal);
     const currentName=currentVariantFor(block.id,PROGRESSIONS[block.id]?.current||block.name);
     const currentVariant=getVariant(block.id);
     const currentVariantId=currentVariant?.variantId||block.id;
     const history=getLogs().filter(x=>x.exerciseId===block.id&&!x.skipped&&String(x.variantId||x.exerciseId)===String(currentVariantId)&&logVariantName(x)===currentName).sort((a,b)=>a.date-b.date);
     const now=history[history.length-1],prev=history[history.length-2];
     const nextId=getProgressionLadder(block.id)[1]?.id||block.id;
     const masterySpec=progressionSpecForBlock(block,nextId);
     if(now?.id===log.id&&prev&&evaluateProgression(block,coachingRecordForLog(now),masterySpec.variantMastery.criteria).qualifies&&evaluateProgression(block,coachingRecordForLog(prev),masterySpec.variantMastery.criteria).qualifies){
       const next=nextLadderVariant(block.id,currentName);
       if(next&&next.name!==currentName&&!current.some(p=>p.sessionId===session.id&&p.exerciseId===block.id&&p.type==="variant"&&p.to===next.name)){
         saveCoachProposal({type:"variant",exerciseId:block.id,variantId:next.id,title:`Progression candidate — ${block.name}`,detail:`The progression standard was met in two consecutive qualifying exposures.`,from:currentName,to:next.name,reason:`Two consecutive qualifying sessions met the exercise-specific progression criteria.`,status:"pending",sessionId:session.id});
       }
     }
   }
   setItems(getCoachProposals().filter(p=>p.sessionId===session.id));
 },[session.id]);
 const apply=async(p:CoachProposal,accept:boolean)=>{
   track(accept?"coach_proposal_accepted":"coach_proposal_rejected",{exerciseId:p.exerciseId,type:p.type});
   if(!accept){
     const current=getCoachProposals().find(x=>x.id===p.id);
     if(!current||current.status!=="pending") return;
     updateCoachProposal(p.id,"rejected");
     saveCoachDecision({type:"coach",exerciseId:p.exerciseId,title:`Proposal rejected — ${p.title}`,detail:p.reason,from:p.from,to:p.to});
     setItems(getCoachProposals().filter(x=>x.sessionId===session.id));
     return;
   }
   const block=blocks.find(b=>b.id===p.exerciseId);
   if(!block){setMessage("L’esercizio non è più presente nel piano attivo.");return}
   const currentProposal=getCoachProposals().find(x=>x.id===p.id);
   if(!currentProposal||currentProposal.status!=="pending") return;
   const previous=getProgramOverride(block.id)||null;
   let nextVariantId=getVariant(block.id)?.variantId||block.id;
   let variantState=undefined as ReturnType<typeof getVariant>;
   if(p.type==="variant") {
     const ladder=getProgressionLadder(block.id);
     const index=Math.max(0,ladder.findIndex(x=>x.name===p.to));
     nextVariantId=p.variantId||ladder[index]?.id||p.to;
     variantState={exerciseId:block.id,variantId:nextVariantId,variantName:p.to,step:index,status:"promoted",updatedAt:Date.now(),lastCoachAction:"promote"};
   }
   const nextRest=p.type==="rest"?Number(String(p.to).replace(/\D/g,"")):block.rest;
   const override={exerciseId:block.id,variantId:nextVariantId,catalogExerciseId:block.catalogExerciseId,name:p.type==="variant"?p.to:block.name,kind:block.kind,target:p.type==="target"?p.to:block.target,sets:block.sets,rest:nextRest,minutes:block.minutes,bandOptions:block.bandOptions,defaultBand:block.defaultBand,updatedAt:Date.now(),previous};
   const accepted=acceptCoachProposalAtomically(p.id,override,variantState,{type:p.type==="variant"?"progression":"program",exerciseId:p.exerciseId,title:`Proposal accepted — ${p.title}`,detail:`${p.reason} Applied to future sessions.`,from:p.from,to:p.to});
   if(accepted.changed){
     try{
       const experiment=createExperimentFromProposal(p, p.from, undefined, 2, previous);
       updateCoachProposal(p.id,"accepted");
       // experiment linkage is persisted when the proposal is created/accepted by storage flow
     }catch{}
   }
   await syncProgramLayer().catch(()=>undefined);
   setMessage(`${block.name}: ${p.from} → ${p.to}`);
   setItems(getCoachProposals().filter(x=>x.sessionId===session.id));
 }
 if(!items.length)return null;
 return <section className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">PROPOSTE DEL COACH</div><p className="mt-1 text-[10px] leading-4 text-zinc-500">Approva o rifiuta la proposta. Il workout resta invariato finché non la accetti.</p></div><span className="tag">APPROVAZIONE UMANA</span></div>{message&&<div className="mt-3 rounded-lg bg-emerald-500/10 p-2 text-[9px] text-emerald-300">{message}</div>}<div className="mt-4 space-y-2">{items.map(p=><div key={p.id} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[8px] font-bold tracking-[.12em] text-violet2">{p.type.toUpperCase()}</div><div className="mt-1 text-sm font-extrabold">{p.title}</div></div><span className="text-[8px] font-bold text-zinc-600">{p.status.toUpperCase()}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div><div className="field-label">ATTUALE</div><div className="mt-1 text-sm font-bold">{p.from}</div></div><div><div className="field-label">PROPOSTA</div><div className="mt-1 text-sm font-bold text-violet2">{p.to}</div></div></div><p className="mt-3 text-[9px] leading-4 text-zinc-500">{p.reason}</p>{p.status==="pending"&&<div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>void apply(p,false)}>RIFIUTA</button><button className="primary-cta" onClick={()=>void apply(p,true)}>ACCETTA E AGGIORNA IL PIANO</button></div>}{p.status!=="pending"&&<div className="mt-3 text-[9px] font-bold text-zinc-500">DECISIONE REGISTRATA: {p.status.toUpperCase()}</div>}</div>)}</div></section>;
}

function Summary({session,close,onSave}:{session:SessionSummary;close:()=>void;onSave:(s:SessionSummary)=>void}){
 const [note,setNote]=useState(session.sessionNote||""),[saved,setSaved]=useState(false),[copiedSummary,setCopiedSummary]=useState(false),[mode,setMode]=useState<"summary"|"mobility">("summary"),[mobilityDone,setMobilityDone]=useState(false),[sessionFeel,setSessionFeel]=useState(""),[showDetails,setShowDetails]=useState(false),[autoReview,setAutoReview]=useState<any>(null),[experimentResults,setExperimentResults]=useState<any[]>([]);
 const coachNote=[sessionFeel?`SESSION FEEL: ${sessionFeel}`:"",note.trim()].filter(Boolean).join("\n");
 const handoff=makeCoachHandoff({...session,sessionNote:coachNote}),details=makeSessionReport({...session,sessionNote:coachNote});
 const saveFeedback=()=>{track("session_feedback_saved",{day:session.day,hasFeel:Boolean(sessionFeel),hasNote:Boolean(note.trim())});const next={...session,sessionNote:coachNote};replaceSession(next);uploadWorkoutSession(next).catch(err=>console.warn("Cloud sync deferred.",err));onSave(next);setSaved(true)};
 useEffect(()=>{try{const sessionsForReview=getSessions();const phase=currentPhase(Date.now());const cycle=runProductionCoachCycle(buildCoachContext(sessionsForReview));setAutoReview(cycle.review);setExperimentResults(cycle.experiments);}catch{setAutoReview(null);setExperimentResults([])}},[session.id,session.sessionFatigue]);
 const copy=async()=>{track("coach_handoff_copied",{day:session.day});try{await navigator.clipboard.writeText(handoff);setCopiedSummary(true);setTimeout(()=>setCopiedSummary(false),1400)}catch{}};
 const exportReport=()=>{track("session_report_exported",{day:session.day});download(details,`coach-report-${session.day.toLowerCase()}.txt`)};
 if(mode==="mobility")return <MobilityPlayer day={session.day} workoutSessionId={session.id} onDone={()=>{track("mobility_completed",{day:session.day});setMobilityDone(true);setMode("summary")}} onSkipAll={()=>{track("mobility_skipped",{day:session.day});setMode("summary");setMobilityDone(true)}}/>;
 return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink text-white"><div className="mx-auto max-w-2xl px-4 py-8 pb-32">
  <div className="eyebrow">ALLENAMENTO COMPLETATO</div><h1>Sessione salvata.</h1>
  <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="TEMPO" value={Math.round(session.durationSec/60)}/><Metric label="RIPETIZIONI" value={session.totalReps}/><Metric label="EMOM" value={session.emomReps}/><Metric label="FATICA" value={session.sessionFatigue?`${session.sessionFatigue}/5`:"—"}/></div>
  <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">REPORT PER IL COACH</div><p className="mt-1 text-[10px] leading-4 text-zinc-500">Il report sintetico serve a una cosa: dare al Coach i dati necessari per il prossimo aggiustamento.</p></div><span className="tag">PRONTO</span></div><div className="mt-4 rounded-xl border border-line bg-panel2 p-3"><div className="text-[10px] font-bold text-zinc-300">Il Coach ha già ricevuto i dati di questa seduta.</div><p className="mt-1 text-[9px] leading-4 text-zinc-600">Copia il report solo se vuoi condividerlo manualmente o conservarlo fuori dall’app.</p></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><button className="primary-cta" onClick={copy}>{copiedSummary?"COPIATO":"COPIA REPORT"}</button><button className="secondary-cta" onClick={()=>{track("session_report_details_toggled",{day:session.day,open:!showDetails});setShowDetails(v=>!v)}}>{showDetails?"NASCONDI DETTAGLI":"MOSTRA DETTAGLI"}</button><button className="secondary-cta" onClick={exportReport}><Download size={14}/>ESPORTA</button></div>{showDetails&&<div className="mt-4 rounded-xl border border-line bg-panel2 p-3"><pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-sans text-[9px] leading-5 text-zinc-400">{details}</pre></div>}</div>
  {getCoachExperiments().filter(e=>e.status==='active'||e.status==='verified'||e.status==='inconclusive').slice(-2).map(e=><div key={e.id} className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">ESPERIMENTO DEL COACH</div><div className="mt-1 text-sm font-extrabold">{e.title.replace(/^Esperimento — /,'')}</div></div><span className="tag">{experimentDecisionLabel(e.status)}</span></div><p className="mt-2 text-[9px] leading-4 text-zinc-500">{e.intervention}. Il Coach controlla {e.expectedObservations} esposizioni prima di confermare o rivedere la modifica.</p><div className="mt-3 text-[9px] font-bold text-zinc-400">OSSERVAZIONI {e.observations}/{e.expectedObservations}</div>{e.outcome&&<p className="mt-2 text-[9px] leading-4 text-zinc-500">{e.outcome}</p>}{(e.status==='active'||e.status==='inconclusive'||e.status==='verified')&&e.previousOverride&&<button className="secondary-cta mt-3 w-full !py-2" onClick={()=>{if(!window.confirm('Annullare questa modifica e ripristinare il piano precedente?'))return;const r=rollbackExperiment(e.id);if(r.ok) onSave({...session});}}>ANNULLA MODIFICA E RIPRISTINA</button>}</div>) }
  {autoReview&&<div className={`mt-4 rounded-2xl border p-4 ${coachLoopPriority(autoReview)==='ACTION'?'border-amber-500/20 bg-amber-500/5':coachLoopPriority(autoReview)==='CAUTION'?'border-violet-500/20 bg-violet-500/5':'border-line bg-panel'}`}><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">ANALISI AUTOMATICA</div><div className="mt-1 text-sm font-extrabold">{autoReview.headline}</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">Il Coach ha salvato la revisione. Nessuna modifica al piano viene applicata automaticamente.</p></div><span className="tag">SALVATA</span></div><p className="mt-3 text-[10px] leading-5 text-zinc-300">{autoReview.summary}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{autoReview.recommendations.slice(0,2).map((x:string)=><div key={x} className="rounded-lg bg-panel2 p-2 text-[9px] leading-4 text-zinc-500">{x}</div>)}</div></div>}
  <PRMoments session={session}/>
  <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">PROSSIMO PASSO</div><div className="mt-2 text-sm font-extrabold">Prima leggi la revisione del Coach.</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">La seduta è salvata: ora controlliamo performance, recupero e cosa conviene fare nella prossima esposizione.</p></div>
  <CoachVerdict session={session}/>
  <CoachProposalPanel session={session}/>
  <div className="mt-4 rounded-2xl border border-line bg-panel2 p-4"><div className="section-kicker">DOPO L'ALLENAMENTO</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><div className="text-[10px] font-extrabold text-zinc-200">1. Leggi la revisione</div><div className="mt-1 text-[9px] text-zinc-600">È il punto di partenza per la prossima seduta.</div></div><div><div className="text-[10px] font-extrabold text-zinc-200">2. Accetta solo le modifiche che vuoi</div><div className="mt-1 text-[9px] text-zinc-600">Nessun cambio viene applicato senza la tua conferma.</div></div></div></div>
  <div className="mt-4 rounded-2xl border border-line bg-panel p-4"><div className="section-kicker">FEEDBACK</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label><span className="field-label">COME TI È SEMBRATA?</span><select value={sessionFeel} onChange={e=>setSessionFeel(e.target.value)}><option value="">—</option><option value="easy">Facile</option><option value="on_target">In linea</option><option value="hard">Difficile ma controllato</option><option value="very_hard">Molto duro</option></select></label><label><span className="field-label">NOTA · OPZIONALE</span><input value={note} onChange={e=>{setNote(e.target.value);setSaved(false)}} placeholder="Nota facoltativa"/></label></div><button className="primary-cta mt-3 w-full" onClick={saveFeedback}>{saved?"SALVATO":"SALVA FEEDBACK"}</button></div>
  <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="section-kicker">MOBILITÀ</div>{mobilityDone?<div className="mt-2 text-[10px] text-emerald-300">Completata.</div>:<><p className="mt-2 text-[10px] text-zinc-500">Continua qui: non devi uscire dall’app né copiare nulla.</p><div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>{const skipped:MobilitySession={id:crypto.randomUUID(),workoutSessionId:session.id,date:Date.now(),day:session.day,status:"skipped",durationSec:0,logs:[]};saveMobilitySession(skipped);uploadMobilitySession(skipped).catch(err=>console.warn("Mobility cloud sync failed; local session preserved.",err));setMobilityDone(true)}}>SALTA</button><button className="primary-cta" onClick={()=>{track("mobility_started",{day:session.day});setMode("mobility")}}>INIZIA MOBILITÀ</button></div></>}</div>
  <button className="secondary-cta mt-4 w-full" onClick={close}>FATTO</button>
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
   const session:MobilitySession={id:crypto.randomUUID(),workoutSessionId,date:now,day,status:"skipped",durationSec:Math.max(0,Math.round((now-startedRef.current)/1000)),logs:[...logs,...steps.slice(index).map((s:MobilityExercise)=>({id:crypto.randomUUID(),exerciseId:s.id,exerciseName:s.name,kind:s.kind,status:"skipped" as const,skipped:true}))]};
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
   <div className="shrink-0 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4"><span className="text-[9px] tracking-[.14em] text-zinc-600">MOBILITY · {String(index+1).padStart(2,"0")}/{String(steps.length).padStart(2,"0")}</span><button className="min-h-10 px-2 text-[9px] font-bold tracking-[.1em] text-zinc-500" onClick={()=>setConfirmSkipAll(true)}>SALTA TUTTO</button></div></div>
   <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8 pb-28">
     <div className="eyebrow">MOBILITÀ POST-ALLENAMENTO</div><h2 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{step.name}</h2><div className="mt-6 rounded-2xl border border-line bg-panel p-5"><div className="field-label">COME ESEGUIRE</div><p className="mt-2 text-sm leading-6 text-zinc-300">{step.description}</p>{step.cue&&<div className="mt-4 rounded-xl bg-panel2 p-3 text-[10px] leading-5 text-zinc-500"><span className="font-bold text-zinc-300">CUE · </span>{step.cue}</div>}</div>
     <div className="mt-8 text-center">
       <div className="text-8xl font-extrabold tracking-tighter sm:text-[112px]">{formatClock(remaining)}</div>
       <div className="mt-2 text-[9px] font-bold tracking-[.15em] text-violet2">{isStatic?"MANTIENI · RESPIRA · RILASSA":"MUOVITI CON CONTROLLO"}</div>
     </div>
     {!isStatic&&<div className="mx-auto mt-6 w-full max-w-sm rounded-2xl border border-line bg-panel p-4"><div className="field-label">RIPETIZIONI COMPLETATE</div><div className="mt-2 flex items-center justify-center gap-3"><button className="counter-btn" onClick={()=>setReps(v=>Math.max(0,v-1))} aria-label="Decrease mobility reps"><Minus size={16}/></button><div className="w-20 text-center text-4xl font-extrabold">{reps}</div><button className="counter-btn" onClick={()=>setReps(v=>v+1)} aria-label="Increase mobility reps"><Plus size={16}/></button></div><div className="mt-2 text-center text-[8px] tracking-[.12em] text-zinc-600">OBIETTIVO {targetReps} REPS · IL TIMER CONTINUA</div></div>}
     <div className="mt-auto pt-10"><button className="primary-cta w-full" onClick={finishStep}>{isStatic?"TERMINA ESERCIZIO":`DONE · ${reps||targetReps} REPS`}</button><button className="mt-3 min-h-11 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-[9px] font-bold tracking-[.12em] text-zinc-500" onClick={skipStep}>SALTA ESERCIZIO</button><div className="mt-6 rounded-xl border border-line bg-panel2 p-3 text-center text-[9px] font-bold tracking-[.12em] text-zinc-500">{nextName?`PROSSIMO ESERCIZIO · ${nextName.toUpperCase()}`:"ULTIMO ESERCIZIO · FINE MOBILITÀ"}</div></div>
   </div></div>
   {confirmSkipAll&&<div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"><div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-panel p-5"><div className="eyebrow">SALTA MOBILITÀ</div><h3 className="mt-2 text-xl font-extrabold">Saltare tutta la routine?</h3><p className="mt-2 text-xs leading-5 text-muted">Your choice will still be logged, but the remaining exercises will not be performed.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setConfirmSkipAll(false)}>KEEP ROUTINE</button><button className="primary-cta" onClick={skipAll}>SALTA TUTTO</button></div></div></div>}
 </div>
}

function download(text:string,name:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)}

createRoot(document.getElementById("root")!).render(<App/>);
