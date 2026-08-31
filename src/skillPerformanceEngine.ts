import type { GoalId, SessionSummary } from './types';
import { analyzeReadiness } from './coachingEngine';
import { analyzeGoal, type GoalPerformanceSnapshot } from './goalAnalyticsEngine';

export interface SkillReadiness {
  goalId: GoalId;
  performance: number;
  qualityPct: number;
  repeatability: number;
  recentMedian: number;
  currentRir?: number;
  recoveryOk: boolean;
  canProgress: boolean;
  confidence: 'LOW'|'MEDIUM'|'HIGH';
  reason: string;
}

function qualityPctFor(goal:GoalPerformanceSnapshot){ return goal.qualityCoveragePct || 0; }
function recentValues(goal:GoalPerformanceSnapshot){ return goal.recentEvidence.map(x=>x.value); }
function repeatability(goal:GoalPerformanceSnapshot){
  const vals=recentValues(goal).slice(-4);
  if(vals.length<2) return 0;
  const best=Math.max(...vals); const near=vals.filter(v=>v>=best*0.9).length;
  return near/vals.length;
}

export function skillReadiness(goalId:GoalId,sessions:SessionSummary[]):SkillReadiness {
  const goal=analyzeGoal(goalId,sessions);
  const recent=sessions.slice().sort((a,b)=>b.date-a.date).slice(0,3);
  const rirValues=recent.flatMap(s=>s.logs.filter(l=>goal.goal.benchmarkExerciseIds.includes(l.exerciseId)).map(l=>l.result.rir)).filter((x):x is number=>typeof x==='number');
  const currentRir=rirValues.length?rirValues[0]:undefined;
  const recoveryOk=recent.length===0 || analyzeReadiness(recent[0].readiness).allowProgression;
  const rep=repeatability(goal);
  const quality=qualityPctFor(goal);
  const evidenceEnough=goal.exposures>=3;
  const canProgress=evidenceEnough&&quality>=60&&rep>=0.5&&recoveryOk&&(currentRir===undefined||currentRir>=1)&&goal.trendPct>=0;
  let reason='Servono più esposizioni comparabili prima di aumentare la difficoltà.';
  if(canProgress) reason='Prestazione, qualità, ripetibilità e recupero sono sufficientemente allineati.';
  else if(!recoveryOk) reason='Il recupero recente non supporta una progressione ora.';
  else if(quality<60) reason='La qualità documentata è troppo bassa per considerare sicura una progressione.';
  else if(rep<0.5) reason='Il risultato migliore non è ancora abbastanza ripetibile.';
  else if(currentRir!==undefined&&currentRir<1) reason='La prestazione è troppo vicina al limite: meglio consolidare prima.';
  const confidence = canProgress ? (goal.exposures >= 6 && quality >= 80 && rep >= 0.75 ? 'HIGH' : 'MEDIUM') : (goal.exposures >= 3 ? 'MEDIUM' : 'LOW');
  return {goalId,performance:goal.current,qualityPct:quality,repeatability:rep,recentMedian:goal.recentMedian,currentRir,recoveryOk,canProgress,confidence,reason};
}

export function allSkillReadiness(sessions:SessionSummary[]):SkillReadiness[] {
  return (['oap','flpu','front_lever_touch'] as GoalId[]).map(id=>skillReadiness(id,sessions));
}
