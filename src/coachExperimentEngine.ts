import type { CoachExperiment, CoachExperimentStatus, CoachProposal, SessionSummary } from './types';
import type { ProgramOverride } from './types';
import { getSessions, getCoachExperiments, saveCoachExperiment, updateCoachExperiment, getProgramOverride, restoreProgramOverride, getCoachProposals, updateCoachProposal, saveCoachDecision } from './storage';
import { analyzeGoal } from './goalAnalyticsEngine';

export interface ExperimentEvaluation {
  experiment: CoachExperiment;
  observationCount: number;
  status: CoachExperimentStatus;
  outcome: string;
  evidenceSessionIds: string[];
  performanceDeltaPct?: number;
  fatigueDelta?: number;
  qualityCoveragePct?: number;
}

function comparableSessions(experiment: CoachExperiment, sessions: SessionSummary[]): SessionSummary[] {
  const filtered=sessions.filter(s=>s.date >= (experiment.startedAt||0) && s.date >= (experiment.appliedAt||experiment.startedAt||0)).sort((a,b)=>a.date-b.date);
  if(!experiment.exerciseId) return filtered.slice(0,experiment.expectedObservations);
  return filtered.filter(s=>s.logs.some(l=>l.exerciseId===experiment.exerciseId && l.status==='complete')).slice(0,experiment.expectedObservations);
}

function primaryMetric(experiment: CoachExperiment, sessions:SessionSummary[]):number[] {
  if(!experiment.exerciseId) return [];
  return sessions.map(s=>{
    const l=s.logs.find(x=>x.exerciseId===experiment.exerciseId&&x.status==='complete');
    if(!l) return 0;
    if(l.result.seconds?.length) return Math.max(...l.result.seconds);
    if(l.result.reps?.length) return Math.max(...l.result.reps);
    if(l.result.emom?.length) return l.result.emom.reduce((a,b)=>a+b,0);
    return 0;
  }).filter(x=>x>0);
}
function avg(xs:number[]){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
function meanFatigue(sessions:SessionSummary[]){const xs=sessions.flatMap(s=>s.logs.map(l=>l.result.fatigue)).filter((x):x is number=>typeof x==='number');return avg(xs);}
function qualityPct(sessions:SessionSummary[]){const rows=sessions.flatMap(s=>s.logs).filter(l=>l.exerciseId && l.result.quality?.length); if(!rows.length)return 0; const total=rows.reduce((a,l)=>a+l.result.quality!.length,0); const clean=rows.reduce((a,l)=>a+l.result.quality!.filter(q=>q==='Clean').length,0); return total?clean/total*100:0;}

function evaluate(experiment:CoachExperiment,sessions:SessionSummary[]):ExperimentEvaluation{
  const observed=comparableSessions(experiment,sessions);
  if(observed.length<experiment.expectedObservations) return {experiment,observationCount:observed.length,status:'active',outcome:`Osservazioni ${observed.length}/${experiment.expectedObservations}.`,evidenceSessionIds:observed.map(s=>s.id)};
  const values=primaryMetric(experiment,observed);
  const perf=values.length>=2 ? ((avg(values.slice(1))-values[0]) / values[0])*100 : undefined;
  const fatigue=meanFatigue(observed);
  const quality=qualityPct(observed);
  // Conservative practical verification: performance is not materially worse,
  // quality is not collapsing, and fatigue has not risen by a large amount.
  const performanceOk=perf===undefined || perf>=-3;
  const fatigueOk=fatigue<=4;
  const qualityOk=quality===0 || quality>=60;
  const status:CoachExperimentStatus=(performanceOk&&fatigueOk&&qualityOk)?'verified':'inconclusive';
  let outcome='';
  if(status==='verified') outcome=`La modifica è compatibile con performance stabile/migliore (${perf===undefined?'nessun benchmark numerico':`${perf.toFixed(0)}%`}), qualità ${quality?quality.toFixed(0)+'%':'non disponibile'} e fatica media ${fatigue?fatigue.toFixed(1):'—'}/5.`;
  else outcome=`I dati non supportano ancora pienamente la modifica: performance ${perf===undefined?'non disponibile':`${perf.toFixed(0)}%`}, qualità ${quality?quality.toFixed(0)+'%':'non disponibile'}, fatica ${fatigue?fatigue.toFixed(1):'—'}/5.`;
  return {experiment,observationCount:observed.length,status,outcome,evidenceSessionIds:observed.map(s=>s.id),performanceDeltaPct:perf,fatigueDelta:fatigue,qualityCoveragePct:quality};
}

export function createExperimentFromProposal(proposal:CoachProposal,baseline:string,successCriteria=['La performance resta stabile o migliora, la qualità resta accettabile e il recupero non peggiora.'],expectedObservations=2,previousOverride:ProgramOverride|null=null):CoachExperiment{
  const startedAt=Date.now();
  return saveCoachExperiment({proposalId:proposal.id,exerciseId:proposal.exerciseId,title:`Esperimento — ${proposal.title}`,hypothesis:proposal.reason,baseline,intervention:`${proposal.from} → ${proposal.to}`,successCriteria,expectedObservations,observations:0,status:'active',startedAt,appliedAt:startedAt,previousOverride, evidenceSessionIds:[]});
}

export function reviewActiveExperiments(sessions:SessionSummary[]=getSessions()):ExperimentEvaluation[]{
  return getCoachExperiments().filter(e=>e.status==='active').map(e=>{
    const result=evaluate(e,sessions);
    updateCoachExperiment(e.id,{observations:result.observationCount,status:result.status,outcome:result.outcome,evidenceSessionIds:result.evidenceSessionIds,completedAt:result.status==='verified'||result.status==='inconclusive'?Date.now():undefined});
    return result;
  });
}

export function rollbackExperiment(experimentId:string):{ok:boolean;message:string}{
  const experiment=getCoachExperiments().find(e=>e.id===experimentId);
  if(!experiment) return {ok:false,message:'Esperimento non trovato.'};
  const current=getProgramOverride(experiment.exerciseId||'');
  if(!experiment.exerciseId) return {ok:false,message:'Esperimento senza esercizio associato.'};
  restoreProgramOverride(experiment.exerciseId,experiment.previousOverride||null);
  updateCoachExperiment(experimentId,{status:'rolled_back',completedAt:Date.now(),outcome:'Modifica annullata manualmente dal Coach.'});
  const proposal=getCoachProposals().find(p=>p.id===experiment.proposalId);
  if(proposal) updateCoachProposal(proposal.id,'rejected');
  saveCoachDecision({type:'coach',exerciseId:experiment.exerciseId,title:`Rollback — ${experiment.title}`,detail:`Ripristinato il piano precedente dopo la revisione dell’esperimento.`,from:current?.sets?`${current.sets} serie`:undefined,to:experiment.previousOverride?.sets?`${experiment.previousOverride.sets} serie`:undefined});
  return {ok:true,message:'Modifica annullata e piano precedente ripristinato.'};
}

export function experimentDecisionLabel(status: CoachExperimentStatus){switch(status){case'verified':return'MODIFICA CONFERMATA';case'rolled_back':return'MODIFICA ANNULLATA';case'inconclusive':return'DATI INSUFFICIENTI';case'active':return'IN OSSERVAZIONE';default:return'PROPOSTA';}}


export function evaluateExperimentOutcome(experiment: CoachExperiment, sessions: SessionSummary[]): CoachExperiment {
  const scoped=sessions.filter(s=>s.date >= (experiment.startedAt||experiment.createdAt));
  const recent=scoped.slice(-experiment.expectedObservations);
  if(recent.length < experiment.expectedObservations) return experiment;
  const fatigue=recent.map(s=>s.sessionFatigue||0).filter(Boolean);
  const avgFatigue=fatigue.length?fatigue.reduce<number>((a,b)=>a+b,0)/fatigue.length:0;
  const reps=recent.flatMap(s=>s.logs.filter(l=>!experiment.exerciseId||l.exerciseId===experiment.exerciseId).flatMap(l=>l.result.reps||[]));
  const baseline=parseFloat((experiment.baseline.match(/[0-9]+(?:\.[0-9]+)?/)||['0'])[0]);
  const current=reps.length?Math.max(...reps):baseline;
  const performanceOk=current>=baseline;
  const fatigueOk=avgFatigue<=4;
  const outcomeType: 'SUPPORTED'|'INCONCLUSIVE'|'FAILED'=performanceOk&&fatigueOk?'SUPPORTED':(!performanceOk&&avgFatigue>4?'FAILED':'INCONCLUSIVE');
  const status=outcomeType==='SUPPORTED'?'verified':outcomeType==='FAILED'?'rolled_back':'inconclusive';
  return {...experiment,status,outcomeType,observations:recent.length,completedAt:Date.now(),outcome:outcomeType==='SUPPORTED'?'Segnali compatibili con una risposta positiva, senza superare il guardrail di fatica.':outcomeType==='FAILED'?'La modifica peggiora la prestazione o supera il guardrail di fatica.':'Servono più dati o il risultato è misto.',evidenceSessionIds:recent.map(s=>s.id),rollbackAvailable:outcomeType==='FAILED'};
}
