import type { GoalId, GoalState, PhasePlan, ReadinessAnalysis, SessionSummary } from './types';
import { analyzeAllGoals, type GoalPerformanceSnapshot } from './goalAnalyticsEngine';
import { analyzeRecoveryForBlocks, weeklyWorkload, type RecoveryStatus } from './workloadEngine';
import { defaultPeriodizationCycle, phaseForCycleWeek, resolveAdaptivePhase } from './periodizationEngine';
import { getSessions } from './storage';
import { analyzeHypertrophyResponse } from './hypertrophyResponseEngine';
import { allSkillReadiness } from './skillPerformanceEngine';

export type CoachTone = 'GOOD'|'CAUTION'|'PRIORITY'|'RECOVERY';
export interface CoachInsight { id:string; title:string; body:string; tone:CoachTone; action?:string; }
export interface CoachContext {
  phase: PhasePlan;
  goals: GoalPerformanceSnapshot[];
  sessions: SessionSummary[];
  insights: CoachInsight[];
  weeklyFatigue: number;
  recoveryStatus: RecoveryStatus;
  hypertrophy: ReturnType<typeof analyzeHypertrophyResponse>;
  skillReadiness: ReturnType<typeof allSkillReadiness>;
}

const goalLabel: Record<GoalId,string> = {oap:'OAP',flpu:'Front Lever Pull-Up',front_lever_touch:'Front Lever Touch',pushups:'Push-ups',dips:'Dips'};

function detectPhase(): PhasePlan {
  const cycle = defaultPeriodizationCycle();
  const start = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('cc-periodization-cycle-start') || Date.now()) : Date.now();
  try{
    const override=JSON.parse(localStorage.getItem('cc-v17-phase-override')||'null');
    return resolveAdaptivePhase(cycle,start,override,Date.now());
  }catch{}
  const week = (Math.floor(Math.max(0, Date.now()-start)/(7*86400000)) % cycle.totalWeeks)+1;
  return phaseForCycleWeek(cycle, week);
}

function recentSessions(sessions: SessionSummary[]) { return sessions.slice().sort((a,b)=>b.date-a.date).slice(0,6); }

export function buildCoachContext(sessions: SessionSummary[] = getSessions()): CoachContext {
  const recent = recentSessions(sessions);
  const phase = detectPhase();
  const goalMap = analyzeAllGoals(sessions) as unknown as GoalPerformanceSnapshot[];
  const goals = Array.isArray(goalMap) ? goalMap : [];
  const fatigueValues = recent.flatMap(s=>s.logs.map(l=>Number(l.result.fatigue||0))).filter(Number.isFinite);
  const weeklyFatigue = fatigueValues.length ? Math.min(5, fatigueValues.reduce((a,b)=>a+b,0)/fatigueValues.length) : 0;
  const blocks = recent.flatMap(s=>s.logs.map(l=>({ id:l.exerciseId, name:l.exerciseName, kind:l.kind, sets:l.prescription?.sets, target:l.prescription?.targetRange, fatigueCost:l.prescription?.fatigueCost, muscleGroups:l.prescription?.muscleGroups }))) as any;
  const recovery = analyzeRecoveryForBlocks(blocks, recent, recent[0]?.readiness || {});
  const workload = weeklyWorkload(sessions, Date.now());
  const hypertrophy=analyzeHypertrophyResponse(sessions);
  const skillReadiness=allSkillReadiness(sessions);
  const insights: CoachInsight[] = [];

  const progressing = goals.filter(g=>String(g.status)==='PROGRESSING');
  const stalled = goals.filter(g=>String(g.status)==='STALLED' || String(g.status)==='REGRESSING');
  if(progressing.length) insights.push({id:'progressing', title:'Progress is visible', tone:'GOOD', body:`${progressing.slice(0,2).map(g=>goalLabel[g.goal.id]).join(' e ')} ${progressing.length>1?'stanno':'sta'} mostrando un trend positivo. Mantieni la specificità della fase prima di aggiungere altra fatica.`, action:'Proteggi il lavoro principale.'});
  if(stalled.length) insights.push({id:'stalled', title:'A goal needs attention', tone:'PRIORITY', body:`${goalLabel[stalled[0].goal.id]} non sta mostrando una progressione affidabile. Prima di aumentare la difficoltà, controlla tecnica, recupero e volume secondario.`, action:'Non forzare la progressione.'});
  const lowHypertrophy=hypertrophy.filter(x=>x.status==='LOW').slice(0,4);
  if(lowHypertrophy.length) insights.push({id:'hypertrophy', title:'Alcuni muscoli ricevono poco volume', tone:'CAUTION', body:`Volume ipertrofico basso per ${lowHypertrophy.map(x=>x.muscle.replaceAll('_',' ')).join(', ')}. Meglio colmare il gap prima di aggiungere altra fatica alle skill.`, action:'Aumenta il volume del muscolo mancante.'});
  if(weeklyFatigue >= 4 || recovery.report.overallRecovery === 'HIGH_FATIGUE' || recovery.report.overallRecovery === 'FATIGUED') insights.push({id:'fatigue', title:'Recovery is the limiter', tone:'RECOVERY', body:'I segnali recenti indicano fatica alta. Il prossimo incremento dovrebbe essere conservativo e la priorità va alla qualità del gesto.', action:'Riduci accessori/density.'});
  if(!insights.length) insights.push({id:'steady', title:'No major red flags', tone:'GOOD', body:'Performance, fase e recupero non mostrano un problema evidente. Il miglioramento più utile viene dalla continuità, non da cambiamenti drastici.', action:'Mantieni il piano.'});
  return {phase, goals, sessions:recent, insights, weeklyFatigue, recoveryStatus: recovery.report.overallRecovery, hypertrophy, skillReadiness};
}

export function answerCoachQuestion(question:string, context:CoachContext): string {
  const q = question.toLowerCase().trim();
  const phase = context.phase;
  const phaseName = phase.type === 'OAP_EMPHASIS' ? 'OAP emphasis' : phase.type === 'FL_EMPHASIS' ? 'Front Lever emphasis' : phase.type === 'ENDURANCE_EMPHASIS' ? 'endurance' : phase.type === 'REALIZATION' ? 'realization' : phase.type === 'DELOAD' ? 'deload' : 'accumulation';
  const low = context.hypertrophy.filter(x=>x.status==='LOW');
  const goal = (id:GoalId) => context.goals.find(x=>x.goal.id===id);
  const fmtGoal = (id:GoalId) => { const g=goal(id); return g ? `${g.goal.label}: ${g.current}/${g.target} · trend ${g.trendPct>0?'+':''}${g.trendPct.toFixed(0)}% · ${g.status}` : `${id}: dati non disponibili`; };

  if (/\b(ciao|hey|salve|ehi)\b/.test(q)) return 'Sono qui. Dimmi cosa vuoi capire o modificare del tuo allenamento e controllerò fase, obiettivi, volume, fatica e recupero prima di consigliarti.';

  if (/quali.*obiettiv|obiettiv.*priorit|priorit.*obiettiv/.test(q)) {
    return `Priorità della fase: ${phaseName}. Stato obiettivi: ${fmtGoal('oap')}; ${fmtGoal('flpu')}; ${fmtGoal('front_lever_touch')}; ${fmtGoal('pushups')}; ${fmtGoal('dips')}. La priorità non significa ignorare gli altri goal: significa decidere dove spendere più fatica adattativa mentre manteniamo gli altri.`;
  }

  if (/fase|periodizz|accumulation|accumulazione/.test(q)) {
    return `Sei in ${phaseName}, settimana ${phase.week}/${phase.totalWeeks}. In questa fase il focus è ${phase.type==='ACCUMULATION'?'costruire base e aumentare lo stimolo ipertrofico mantenendo le skill in allenamento, senza accumulare fatica inutile':phase.type==='OAP_EMPHASIS'?'spingere la specificità dell’OAP mantenendo sufficiente volume ipertrofico':'aumentare la specificità della capacità prioritaria della fase'}. ${low.length ? `Il sistema segnala volume basso per ${low.slice(0,4).map(x=>x.muscle.replaceAll('_',' ')).join(', ')}; quindi non aumenterei automaticamente altra fatica sulle skill finché questo gap non è gestito.` : 'Non risultano al momento gap ipertrofici marcati nel contesto disponibile.'}`;
  }

  if (/quanto.*volume|volume.*(chest|petto|tricip|spall|delt)|petto|chest|triceps|tricipiti|front delts|side delts/.test(q)) {
    const rows=context.hypertrophy;
    const wanted = rows.filter(x=>/chest|petto|triceps|tricip|front_deltoid|front_delt|side_deltoid|side_delt/.test(x.muscle));
    if (!wanted.length) return 'Non ho abbastanza dati di volume muscolare nel contesto corrente per darti un numero affidabile.';
    return wanted.map(x=>`${x.muscle.replaceAll('_',' ')}: ${x.currentSets.toFixed(1)} serie produttive · ${x.status.toLowerCase()} · trend ${x.trendPct == null ? 'non disponibile' : `${x.trendPct>=0?'+':''}${x.trendPct.toFixed(0)}%`}`).join('\n');
  }

  if (/modific|cambio|cambiare|aumento|aumentare|progress|aggiung|ridur/.test(q)) {
    const primary = context.insights.find(i=>i.tone==='PRIORITY'||i.tone==='RECOVERY') || context.insights.find(i=>i.tone==='CAUTION') || context.insights[0];
    const lowNames = low.slice(0,4).map(x=>x.muscle.replaceAll('_',' ')).join(', ');
    if (/ipertrof|massa|muscol/.test(q) && low.length) {
      return `Se vuoi aumentare l'ipertrofia senza compromettere OAP, FL Pull-Up e Front Lever Touch, non aggiungerei subito altra fatica alle skill. Il contesto segnala volume basso per ${lowNames}. In accumulation userei prima parte del budget di recupero su questi muscoli, lasciando invariate le esposizioni principali delle skill. Poi rivaluterei performance, qualità e fatica dopo 1-2 settimane. ${primary?.action||''}`.trim();
    }
    return primary ? `${primary.body} ${primary.action||''}`.trim() : 'Per decidere una modifica guarderei prima performance, tecnica, RIR/fatica e recupero. Non cambierei più variabili insieme.';
  }

  if (/abbastanza.*ipertrof|ipertrof|massa|muscol/.test(q)) {
    return low.length
      ? `Non ancora in modo uniforme: dal punto di vista dell'ipertrofia, le aree che il sistema considera basse sono ${low.slice(0,5).map(x=>x.muscle.replaceAll('_',' ')).join(', ')}. In accumulation darei priorità a colmare questi gap con volume produttivo, senza aumentare contemporaneamente la fatica delle skill. Non significa fare più volume ovunque: significa spostare il budget di recupero verso i muscoli realmente sotto-stimolati.`
      : 'Il volume ipertrofico non mostra gap marcati nel contesto disponibile. Prima di aggiungere serie cercherei un motivo concreto: performance stagnante, volume insufficiente per un muscolo o recupero molto buono.';
  }

  if (/ultim|recent|workout|allenamento|sessione/.test(q) && /cosa|come|modific|aument|ridur|tocch/.test(q)) {
    const workload=context.weeklyFatigue;
    const recovery=context.recoveryStatus;
    const topInsight=context.insights.find(i=>i.tone==='PRIORITY'||i.tone==='RECOVERY') || context.insights[0];
    return `Guardando il contesto recente, il recupero è ${recovery.toLowerCase()} e il carico/fatica settimanale è ${workload.toFixed?.(1) ?? workload}. ${topInsight ? topInsight.body : 'Non vedo abbastanza evidenza per giustificare una modifica aggressiva.'} Prima di aumentare una skill verificherei qualità e ripetibilità nelle ultime esposizioni comparabili.`;
  }

  if (/rir|fatica|fatigue|sforzo/.test(q)) return 'RIR = quante ripetizioni pulite avresti ancora fatto. 0 = nessuna, 1 = una, 2 = due, 3+ = tre o più. Fatica = quanto ti ha pesato la serie: 1 facile, 3 impegnativa, 5 quasi esausto. Non serve azzeccare il numero perfetto: ci interessa la tendenza.';

  const goalMention = (Object.keys(goalLabel) as GoalId[]).find(id => q.includes(id.replace('_',' ')) || q.includes(goalLabel[id].toLowerCase()));
  if(goalMention) return fmtGoal(goalMention);

  return `Posso analizzare questa domanda, ma mi serve un riferimento più preciso. Il contesto attuale è ${phaseName}, settimana ${phase.week}/${phase.totalWeeks}. Puoi chiedermi, per esempio, se aumentare una skill, se il volume ipertrofico è sufficiente o come modificare una seduta specifica.`;
}
export function deterministicCoachBrief(context:CoachContext): string {
  return context.insights.slice(0,3).map(i=>`${i.title}: ${i.body}`).join(' ');
}
