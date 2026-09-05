import type { GoalState, PhasePlan, SessionSummary } from './types';
import { analyzeAllGoals, goalStateFromAnalytics } from './goalAnalyticsEngine';
import { reviewCurrentPhase, defaultPeriodizationCycle, phaseForCycleWeek } from './periodizationEngine';
import { weeklyWorkload } from './workloadEngine';
import { weeklyStimulusActual, compareStimulusToBudget, adaptiveDecision, phaseStimulusTarget } from './adaptiveStimulusEngine';
import { analyzeHypertrophyResponse } from './hypertrophyResponseEngine';
import { allSkillReadiness } from './skillPerformanceEngine';
import { detectPlateaus } from './plateauEngine';

export type ReviewTone = 'GOOD'|'CAUTION'|'PRIORITY'|'RECOVERY';
export interface CoachReview {
  id:string;
  createdAt:number;
  sessionId?:string;
  phase:PhasePlan;
  headline:string;
  summary:string;
  tone:ReviewTone;
  reasons:string[];
  recommendations:string[];
  nextSession?:string;
  goalStates:GoalState[];
  phaseDecision:{action:string;reason:string;confidence:number;nextPhaseId?:string};
  workload:{totalAdjustedSets:number;fatigueLoad:number;overallRecovery:string;warnings:string[]};
  stimulus:{primary:string;actual:number;target:number;attainmentPct:number;lowHypertrophyMuscles:string[]};
}

function latest(sessions:SessionSummary[]){return sessions.slice().sort((a,b)=>b.date-a.date)[0];}
function averageDefined(values:Array<number|undefined>){const xs=values.filter((x):x is number=>typeof x==='number');return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:undefined;}
function primaryAdaptationFor(phase:PhasePlan):'skill'|'strength'|'hypertrophy'|'endurance'|'power'{
  if(phase.type==='OAP_EMPHASIS'||phase.type==='FL_EMPHASIS') return 'skill';
  if(phase.type==='ENDURANCE_EMPHASIS') return 'endurance';
  if(phase.type==='REALIZATION') return 'strength';
  return 'hypertrophy';
}

export function buildCoachReview(sessions:SessionSummary[], phase:PhasePlan):CoachReview {
  const recent=sessions.slice().sort((a,b)=>b.date-a.date).slice(0,8);
  const goals=analyzeAllGoals(sessions);
  const goalStates=goals.map(goalStateFromAnalytics);
  const cycle=defaultPeriodizationCycle();
  const storedStart=typeof localStorage!=='undefined'?Number(localStorage.getItem('cc-periodization-cycle-start')||0):0;
  const cycleStart=storedStart>0?storedStart:Date.now();
  const absoluteWeek=(Math.floor(Math.max(0,Date.now()-cycleStart)/(7*86400000))%cycle.totalWeeks)+1;
  const resumePhaseType=phase.type==='DELOAD'?phaseForCycleWeek(cycle, Math.min(cycle.totalWeeks, absoluteWeek+1)).type:undefined;
  const phaseDecision=reviewCurrentPhase({phase,goalStates,sessions,now:Date.now(),resumePhaseType});
  const workload=weeklyWorkload(sessions);
  const stimulus=weeklyStimulusActual(sessions);
  const primary=primaryAdaptationFor(phase);
  const targets=phaseStimulusTarget(phase);
  const compared=compareStimulusToBudget(stimulus,targets);
  const adaptive=adaptiveDecision(compared,primary,phase.fatigueBudget,phase.type==='DELOAD');
  const hypertrophyResponse=analyzeHypertrophyResponse(sessions);
  const lowHypertrophyMuscles=hypertrophyResponse.filter(x=>x.status==='LOW').map(x=>x.muscle).slice(0,4);
  const skillReadiness=allSkillReadiness(sessions);
  const plateauSignals=detectPlateaus(sessions);
  const current=latest(sessions);
  for(const signal of plateauSignals.slice(0,3)){ reasons.push('Plateau rilevato su '+signal.exerciseId+': '+signal.values.join(' → ')+'.'); recommendations.push(signal.reason); if(signal.recommendation==='CONSIDER_CLUSTER' && tone!=='RECOVERY') tone='PRIORITY'; }
  const avgRir=current?averageDefined(current.logs.map(x=>x.result.rir)):undefined;
  const avgFatigue=current?averageDefined(current.logs.map(x=>x.result.fatigue)):undefined;
  const reasons:string[]=[];
  const recommendations:string[]=[];
  let tone:ReviewTone='GOOD';

  if(adaptive.action==='REDUCE_SECONDARY'){tone='RECOVERY';recommendations.push(...adaptive.reasons);}
  else if(adaptive.action==='ADD_HYPERTROPHY' || lowHypertrophyMuscles.length){tone='CAUTION';recommendations.push(`Proteggi la skill prioritaria e aggiungi volume ipertrofico dove serve: ${lowHypertrophyMuscles.slice(0,3).join(', ')}.`);}
  reasons.push(`Stimolo ${primary}: ${compared.adaptations[primary].attainmentPct.toFixed(0)}% del target della fase.`);
  if(lowHypertrophyMuscles.length) reasons.push(`Ipertrofia da monitorare: ${lowHypertrophyMuscles.join(', ')}.`);
  if(current){
    reasons.push(`Ultima sessione: ${Math.round(current.durationSec/60)} min, ${current.totalReps} reps.`);
    if(avgRir!==undefined) reasons.push(`RIR medio registrato: ${avgRir.toFixed(1)}.`);
    if(avgFatigue!==undefined) reasons.push(`Fatica media registrata: ${avgFatigue.toFixed(1)}/5.`);
  }
  if(workload.overallRecovery==='HIGH_FATIGUE'||workload.overallRecovery==='FATIGUED'){
    tone='RECOVERY';
    reasons.push(`Recupero settimanale: ${workload.overallRecovery}.`);
    recommendations.push('Non aumentare insieme intensità e volume: proteggi la skill prioritaria e riduci prima accessori/density.');
  }
  const stalled=goals.filter(g=>g.status==='STALLED'||g.status==='REGRESSING');
  const progressing=goals.filter(g=>g.status==='PROGRESSING');
  if(stalled.length){tone=tone==='RECOVERY'?'RECOVERY':'PRIORITY';reasons.push(`Goal da osservare: ${stalled.map(g=>g.goal.label).slice(0,2).join(', ')}.`);recommendations.push('Prima di cambiare la skill, verifica qualità del gesto, recupero e volume secondario.');}
  const notReadySkills=skillReadiness.filter(x=>!x.canProgress);
  if(notReadySkills.length && (phase.type==='OAP_EMPHASIS'||phase.type==='FL_EMPHASIS')) reasons.push(`Skill da consolidare: ${notReadySkills.map(x=>x.goalId).join(', ')}.`);
  if(!stalled.length&&progressing.length) recommendations.push(`Mantieni la specificità: ${progressing.slice(0,2).map(g=>g.goal.label).join(' e ')} mostrano un trend positivo.`);
  if(phaseDecision.action==='DELOAD'){tone='RECOVERY';recommendations.unshift('La prossima settimana dovrebbe essere uno scarico: mantieni la tecnica e riduci il volume.');}
  if(phaseDecision.action==='ADVANCE') recommendations.unshift(`La fase può avanzare: ${phaseDecision.reason}`);
  if(!recommendations.length) recommendations.push('Nessuna modifica importante: continua il piano e accumula altre esposizioni comparabili.');

  return {
    id:`review-${current?.id||Date.now()}`,
    createdAt:Date.now(),
    sessionId:current?.id,
    phase,
    headline:tone==='GOOD'?'Continuità buona':tone==='CAUTION'?'Attenzione al bilanciamento':tone==='PRIORITY'?'Un obiettivo richiede attenzione':'Il recupero è il limite',
    summary:phaseDecision.reason,
    tone,
    reasons:[...new Set(reasons)].slice(0,6),
    recommendations:[...new Set(recommendations)].slice(0,5),
    nextSession:phaseDecision.action==='DELOAD'?'Riduci volume e mantieni tecnica.':phase.type==='OAP_EMPHASIS'?'Proteggi le esposizioni OAP e mantieni il volume ipertrofico.':phase.type==='FL_EMPHASIS'?'Proteggi FL/FLPU e mantieni il volume ipertrofico.':'Segui la prescrizione adattiva corrente.',
    goalStates,
    phaseDecision:{action:phaseDecision.action,reason:phaseDecision.reason,confidence:phaseDecision.confidence,nextPhaseId:phaseDecision.nextPhaseId},
    workload:{totalAdjustedSets:workload.totalAdjustedSets,fatigueLoad:workload.totalFatigueLoad,overallRecovery:workload.overallRecovery,warnings:workload.warnings.slice(0,5)},
    stimulus:{primary,actual:compared.adaptations[primary].actual,target:compared.adaptations[primary].target,attainmentPct:compared.adaptations[primary].attainmentPct,lowHypertrophyMuscles},
  };
}
