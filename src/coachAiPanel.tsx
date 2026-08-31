import {useEffect,useMemo,useState} from 'react';
import {MessageSquare, Send, Sparkles, RotateCcw} from 'lucide-react';
import {getSessions, savePeriodizationReview, getPeriodizationReview, getCoachDecisions} from './storage';
import {deterministicCoachBrief, type CoachContext} from './coachAdvisorEngine';
import {buildCoachUiState, coachInsightTone} from './coachUiIntegration';
import {askCoach, type CoachMessage} from './coachAiGateway';
import {buildCoachReview, type CoachReview} from './coachReviewEngine';
import {phaseTypeFromId} from './periodizationEngine';
import {buildCoachProposalDraft, saveCoachProposalDraft, type CoachProposalDraft} from './coachProposalEngine';
import {t, phaseLabel} from './i18n';
import type {SessionSummary} from './types';

const KEY='cc-coach-chat-v16';

function recentCoachChanges(){
 const since=Date.now()-7*86400000;
 return getCoachDecisions().filter(x=>x.date>=since).slice(-4).reverse();
}

function loadMessages():CoachMessage[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
function saveMessages(v:CoachMessage[]){localStorage.setItem(KEY,JSON.stringify(v.slice(-30)))}

export function CoachPanel(){
 const sessions=getSessions() as SessionSummary[];
 const messagesSeed=loadMessages();
 const ui=useMemo(()=>buildCoachUiState(sessions,messagesSeed.length>0),[sessions.length,sessions[0]?.id,messagesSeed.length]);
 const context=ui.context;
 const [messages,setMessages]=useState<CoachMessage[]>(messagesSeed);
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [review,setReview]=useState<CoachReview|null>(()=>buildCoachReview(sessions,context.phase));
 const [proposalDraft,setProposalDraft]=useState<CoachProposalDraft|null>(null);
 const [proposalSaved,setProposalSaved]=useState(false);
 const [proposalQuestion,setProposalQuestion]=useState('');
 const [reviewing,setReviewing]=useState(false);
 const [applied,setApplied]=useState(false);
 useEffect(()=>saveMessages(messages),[messages]);
 const send=async(q=text.trim())=>{
   if(!q||busy)return;
   const user:CoachMessage={role:'user',content:q,createdAt:Date.now()};
   setMessages(m=>[...m,user]);setText('');setBusy(true);
   try{const answer=await askCoach(q,context,messages);setMessages(m=>[...m,answer])}
   finally{setBusy(false)}
 };
 const reset=()=>{if(!window.confirm('Cancellare tutta la conversazione con il Coach?'))return;setMessages([]);localStorage.removeItem(KEY)};
 const runReview=()=>{setReviewing(true);try{setReview(buildCoachReview(sessions,context.phase));}finally{setReviewing(false)}};
 const makeProposal=(question?:string)=>{const q=(question||text.trim()||proposalQuestion).trim();if(!q)return;setProposalSaved(false);setProposalQuestion(q);setProposalDraft(buildCoachProposalDraft(context,q));};
 const saveProposal=()=>{if(!proposalDraft)return;saveCoachProposalDraft(proposalDraft);setProposalSaved(true);};
 const savedInitial=getPeriodizationReview();
 const applyPhase=()=>{
   if(!review?.phaseDecision.nextPhaseId)return;
   const type=phaseTypeFromId(review.phaseDecision.nextPhaseId);
   if(!type)return;
   savePeriodizationReview({reviewId:review.id,action:review.phaseDecision.action,phaseId:review.phase.id,nextPhaseId:review.phaseDecision.nextPhaseId,reason:review.phaseDecision.reason,confidence:review.phaseDecision.confidence,activeFrom:Date.now(),activeUntil:Date.now()+7*86400000});
   if(review.phaseDecision.action==='ADVANCE'||review.phaseDecision.action==='DELOAD') localStorage.setItem('cc-v17-phase-override',JSON.stringify({phaseType:type,startedAt:Date.now()}));
   setApplied(true);
 };
 const starter=['Come sta andando la mia OAP?','Perché non aumenteresti il volume dei pull-up?','Sto facendo abbastanza ipertrofia?','Come dovrei modificare il workout di oggi?'];
 const savedReview=Boolean(savedInitial);
 return <section className="mt-5 w-full min-w-0 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
   <div className="flex items-start justify-between gap-3"><div><div className="section-kicker flex items-center gap-2"><Sparkles size={13}/> {t('coachReview')}</div><h2 className="mt-2 text-2xl font-extrabold">{t('questionCoach')}</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-zinc-500">Legge fase, obiettivi, ultime sessioni, recupero e volume. Il Coach non modifica il piano senza una decisione esplicita.</p></div><button className="mini-btn" title={t('clearChat')} onClick={reset}><RotateCcw size={14}/></button></div>
   <div className={`mt-4 rounded-2xl border p-4 ${coachInsightTone(ui.primary.tone)}`}>
     <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="section-kicker">PRIORITÀ DEL COACH</div><div className="mt-1 text-sm font-extrabold">{ui.headline}</div><p className="mt-2 text-[10px] leading-5 text-zinc-300">{ui.primary.body}</p></div><span className="tag shrink-0">{ui.primary.tone}</span></div>
     {ui.secondary.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{ui.secondary.map(x=><div key={x.id} className="rounded-xl border border-line bg-panel2 p-3"><div className="text-[9px] font-extrabold">{x.title}</div><div className="mt-1 text-[9px] leading-4 text-zinc-500">{x.body}</div></div>)}</div>}
   </div>
   <div className="mt-4 rounded-xl border border-line bg-panel2 p-3"><div className="grid gap-2 sm:grid-cols-3"><div><span className="field-label">{t('phase')}</span><div className="mt-1 text-xs font-bold">{phaseLabel(context.phase.type)}</div></div><div><span className="field-label">{t('week')}</span><div className="mt-1 text-xs font-bold">{context.phase.week}/{context.phase.totalWeeks}</div></div><div><span className="field-label">{t('status')}</span><div className="mt-1 text-xs font-bold">{ui.recoveryLabel}</div></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full bg-lime-400" style={{width:`${Math.round(ui.phaseProgress*100)}%`}} /></div><div className="mt-2 text-[9px] leading-4 text-zinc-500">{deterministicCoachBrief(context)}</div></div>{recentCoachChanges().length>0&&<div className="mt-3 rounded-xl border border-line bg-panel p-3"><div className="field-label">COSA È CAMBIATO</div><div className="mt-2 space-y-2">{recentCoachChanges().slice(0,3).map(x=><div key={x.id} className="flex items-start justify-between gap-3 text-[9px]"><span className="text-zinc-400">{x.title}</span><span className="shrink-0 text-zinc-600">{new Date(x.date).toLocaleDateString('it-IT')}</span></div>)}</div></div>}
   <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
     <div className="flex items-start justify-between gap-3"><div><div className="section-kicker">{t('coachReview')}</div><div className="mt-1 text-sm font-extrabold">{review?.headline||'Vuoi una revisione completa?'}</div><p className="mt-1 text-[10px] leading-5 text-zinc-500">Analizza l’ultima sessione e verifica anche se la fase corrente è ancora appropriata.</p></div><button className="secondary-cta" onClick={runReview} disabled={reviewing}>{reviewing?t('reviewing'):t('reviewLast')}</button></div>
     {(savedReview||review)&&<div className="mt-4 rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">
       <div className="flex items-center justify-between gap-3"><span className="tag">{(review?.tone||'GOOD')}</span><span className="text-[8px] text-zinc-600">{review?new Date(review.createdAt).toLocaleString('it-IT'):'ultima revisione salvata'}</span></div>
       {review&&<><div className="mb-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-panel2 p-3"><div className="field-label">{t('stimulus')}</div><div className="mt-1 text-sm font-extrabold">{review.stimulus.attainmentPct.toFixed(0)}%</div></div><div className="rounded-xl bg-panel2 p-3"><div className="field-label">IPERTROFIA</div><div className="mt-1 text-sm font-extrabold">{review.stimulus.lowHypertrophyMuscles.length?`${review.stimulus.lowHypertrophyMuscles.length} DA CURARE`:'OK'}</div></div><div className="rounded-xl bg-panel2 p-3"><div className="field-label">RECUPERO</div><div className="mt-1 text-sm font-extrabold">{context.recoveryStatus==='FRESH'?'BUONO':context.recoveryStatus}</div></div></div><p className="mt-3 text-[10px] leading-5 text-zinc-300">{review.summary}</p><div className="mt-3 grid gap-2">{review.recommendations.map(x=><div key={x} className="rounded-lg border border-line bg-panel p-2 text-[9px] leading-4 text-zinc-400">{x}</div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{review.reasons.map(x=><div key={x} className="rounded-lg bg-panel2 p-2 text-[8px] text-zinc-500">{x}</div>)}</div>{review.phaseDecision.action!=='STAY'&&review.phaseDecision.nextPhaseId&&<div className="mt-3 rounded-xl border border-violet-500/20 bg-panel p-3"><div className="text-[9px] font-extrabold">DECISIONE FASE · {review.phaseDecision.action}</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">{review.phaseDecision.reason}</p><button className="primary-cta mt-3 w-full" onClick={applyPhase} disabled={applied}>{applied?'DECISIONE SALVATA':'APPLICA DALLA PROSSIMA SESSIONE'}</button></div>}</>}
     </div>}
   </div>
   {!messages.length&&<div className="mt-4"><div className="field-label">{t('tryAsking')}</div><div className="mt-2 flex flex-wrap gap-2">{starter.map(s=><button key={s} className="chip" onClick={()=>send(s)}>{s}</button>)}</div></div>}
   <div className="mt-4 max-h-[420px] min-w-0 space-y-3 overflow-y-auto overflow-x-hidden pr-1" aria-live="polite">{messages.map((m,i)=><div key={`${m.createdAt}-${i}`} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`min-w-0 max-w-[88%] break-words rounded-2xl px-4 py-3 text-[10px] leading-5 ${m.role==='user'?'bg-violet-600 text-white':'border border-line bg-panel text-zinc-300'}`}><div>{m.content}</div>{m.role==='assistant'&&<div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] uppercase tracking-[.12em] text-zinc-600"><span>{m.source==='ai'?t('aiCoach'):t('rulesFallback')}</span>{m.toolCalls?.length? <span>· dati verificati: {m.toolCalls.join(', ')}</span>:null}</div>}</div></div>)}</div>
   {messages.some(m=>m.role==='assistant')&&<div className="mt-3 flex justify-end"><button className="secondary-cta !py-2" onClick={()=>{const lastUser=[...messages].reverse().find(m=>m.role==='user');makeProposal(lastUser?.content)}} disabled={busy||!messages.some(m=>m.role==='assistant')}>TRASFORMA IN PROPOSTA</button></div>}
   <div className="mt-4 flex min-w-0 items-end gap-2"><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} rows={2} placeholder="Es. Devo aumentare i dips nella prossima sessione?" className="min-h-[54px] min-w-0 flex-1 resize-none rounded-2xl border border-line bg-panel px-4 py-3 text-sm"/><button aria-label="Invia al Coach" className="primary-cta !min-h-[54px] !w-[58px] !px-0" onClick={()=>send()} disabled={!text.trim()||busy}>{busy?<span className="animate-pulse">…</span>:<Send size={17}/>}</button></div>
   {proposalDraft&&<div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="section-kicker">PROPOSTA STRUTTURATA</div><div className="mt-1 text-sm font-extrabold">{proposalDraft.proposal.title}</div><p className="mt-1 text-[9px] leading-4 text-zinc-500">Una sola variabile alla volta. La modifica resta in sospeso finché non viene accettata nel report della sessione.</p></div><span className="tag">{proposalDraft.confidence>=0.75?'ALTA':proposalDraft.confidence>=0.55?'MEDIA':'BASSA'} CONFIDENZA</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-panel p-3"><div className="field-label">ATTUALE</div><div className="mt-1 text-sm font-bold">{proposalDraft.proposal.from}</div></div><div className="rounded-xl bg-panel p-3"><div className="field-label">PROPOSTA</div><div className="mt-1 text-sm font-bold text-violet2">{proposalDraft.proposal.to}</div></div></div><div className="mt-3 space-y-2">{proposalDraft.evidence.map(e=><div key={e.label} className="rounded-lg bg-panel2 p-2 text-[9px] text-zinc-500"><span className="font-bold text-zinc-400">{e.label}:</span> {e.value}</div>)}{proposalDraft.goalProtection.length>0&&<div className="rounded-xl border border-line bg-panel2 p-3"><div className="field-label">PROTEZIONE GOAL</div><div className="mt-2 space-y-2">{proposalDraft.goalProtection.map(g=><div key={g.goalId} className="flex items-start justify-between gap-3 text-[9px]"><div><span className="font-bold text-zinc-300">{g.label}</span><div className="mt-0.5 text-zinc-600">{g.reason}</div></div><span className="shrink-0 text-[8px] font-bold tracking-[.08em]">{g.status==='PROTECTED'?'PROTETTO':g.status==='WATCH'?'MONITORARE':'INTERFERENZA'}</span></div>)}</div></div>}{proposalDraft.warnings.map(w=><div key={w} className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-2 text-[9px] text-amber-200/80">{w}</div>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><button className="secondary-cta" onClick={()=>setProposalDraft(null)}>CHIUDI</button><button className="primary-cta" onClick={saveProposal} disabled={proposalSaved}>{proposalSaved?'PROPOSTA SALVATA':'SALVA PROPOSTA'}</button></div></div>}
   <div className="mt-2 flex items-center gap-2 text-[8px] text-zinc-600"><MessageSquare size={11}/> Il Coach usa il contesto strutturato dell’app. Se l’AI non è disponibile, entra in funzione il motore locale.</div>
 </section>
}
