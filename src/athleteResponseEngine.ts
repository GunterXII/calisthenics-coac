import type { GoalId, SessionSummary, MuscleGroup } from './types';
import { analyzeGoal } from './goalAnalyticsEngine';
import { analyzeHypertrophyResponse } from './hypertrophyResponseEngine';
import { analyzeReadiness } from './coachingEngine';

export interface AthleteResponseEstimate {
  goalId?: GoalId;
  muscle?: MuscleGroup;
  exposureCount: number;
  direction: 'POSITIVE'|'STABLE'|'NEGATIVE'|'UNKNOWN';
  confidence: 'LOW'|'MEDIUM'|'HIGH';
  performanceTrendPct: number;
  averageFatigue: number;
  recoveryScore: number;
  interpretation: string;
}

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const round=(n:number,d=1)=>Number(n.toFixed(d));

export function estimateGoalResponse(goalId:GoalId,sessions:SessionSummary[]):AthleteResponseEstimate {
  const goal=analyzeGoal(goalId,sessions);
  const recent=sessions.slice().sort((a,b)=>b.date-a.date).slice(0,6);
  const values=goal.recentEvidence.slice(-6).map(x=>x.value);
  const first=values[0] ?? goal.baseline;
  const last=values.at(-1) ?? goal.current;
  const trend=first!==0?((last-first)/Math.abs(first))*100:0;
  const fatigue=avg(recent.map(s=>s.sessionFatigue||0).filter(Boolean));
  const recovery=recent.length?avg(recent.map(s=>analyzeReadiness(s.readiness).score)):0;
  const confidence=goal.exposures>=6?'HIGH':goal.exposures>=3?'MEDIUM':'LOW';
  const direction=goal.exposures<2?'UNKNOWN':trend>3?'POSITIVE':trend<-3?'NEGATIVE':'STABLE';
  let interpretation='Servono più dati per stimare la risposta individuale.';
  if(direction==='POSITIVE'&&fatigue<=3.2) interpretation='La capacità sta migliorando senza un segnale di costo eccessivo.';
  if(direction==='STABLE'&&fatigue>=3.5) interpretation='La prestazione è stabile mentre il costo percepito è alto: prima di aggiungere volume conviene consolidare il recupero.';
  if(direction==='NEGATIVE') interpretation='La prestazione è in calo: il Coach dovrebbe verificare fatica, qualità e disponibilità al gesto prima di aumentare lo stimolo.';
  return {goalId,exposureCount:goal.exposures,direction,confidence,performanceTrendPct:round(trend),averageFatigue:round(fatigue),recoveryScore:round(recovery),interpretation};
}

export function estimateMuscleResponse(muscle:MuscleGroup,sessions:SessionSummary[]):AthleteResponseEstimate {
  const rows=analyzeHypertrophyResponse(sessions).filter(x=>x.muscle===muscle);
  const r=rows[0];
  if(!r) return {muscle,exposureCount:0,direction:'UNKNOWN',confidence:'LOW',performanceTrendPct:0,averageFatigue:0,recoveryScore:0,interpretation:'Nessun dato.'};
  const direction=r.trendPct>5?'POSITIVE':r.trendPct<-5?'NEGATIVE':'STABLE';
  return {muscle,exposureCount:r.confidence==='HIGH'?4:r.confidence==='MEDIUM'?2:1,direction,confidence:r.confidence,performanceTrendPct:r.trendPct,averageFatigue:r.fatigueSignal*2.5,recoveryScore:0,interpretation:direction==='POSITIVE'?'Lo stimolo recente sembra produttivo.':direction==='NEGATIVE'?'Ridurre o redistribuire volume può essere più sensato di aggiungere altro.':'La risposta non mostra ancora un segnale netto.'};
}
