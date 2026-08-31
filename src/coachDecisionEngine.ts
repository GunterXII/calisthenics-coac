import type { CoachContext } from './coachAdvisorEngine';
import type { ExerciseBlock, GoalId } from './types';
import { analyzeGoal } from './goalAnalyticsEngine';
import { skillReadiness } from './skillPerformanceEngine';
import { analyzeHypertrophyResponse } from './hypertrophyResponseEngine';
import { estimateGoalResponse } from './athleteResponseEngine';
import { analyzeFrontLeverTouch } from './frontLeverTouchEngine';

export interface CoachDecision {
  action:'HOLD'|'PROGRESS'|'ADD_HYPERTROPHY'|'REDUCE_VOLUME'|'DELOAD';
  exerciseId?:string;
  reason:string;
  confidence:'LOW'|'MEDIUM'|'HIGH';
  evidence:string[];
}

export function decideNextAction(context:CoachContext, focusGoal?:GoalId):CoachDecision {
  const sessions=context.sessions;
  if(context.recoveryStatus==='HIGH_FATIGUE') return {action:'REDUCE_VOLUME',reason:'La fatica è alta: prima proteggiamo qualità e recupero.',confidence:'HIGH',evidence:[`Recovery: ${context.recoveryStatus}`]};
  if(focusGoal && ['oap','flpu'].includes(focusGoal)) {
    const state=skillReadiness(focusGoal,sessions);
    const response=estimateGoalResponse(focusGoal,sessions);
    if(state.canProgress && response.direction==='POSITIVE') return {action:'PROGRESS',reason:'Performance, qualità e risposta individuale sono coerenti con una progressione.',confidence:response.confidence,evidence:[state.reason,response.interpretation]};
    return {action:'HOLD',reason:state.reason,confidence:state.confidence,evidence:[state.reason,response.interpretation]};
  }
  if(focusGoal==='front_lever_touch') {
    const touch=analyzeFrontLeverTouch(sessions);
    if(touch.readiness==='PROGRESS') return {action:'PROGRESS',reason:touch.explanation,confidence:touch.exposures>=6?'HIGH':'MEDIUM',evidence:[`Qualità ${touch.qualityPct}%`,`Ripetibilità ${touch.repeatableScore}%`]};
    return {action:'HOLD',reason:touch.explanation,confidence:touch.exposures>=3?'MEDIUM':'LOW',evidence:[`Qualità ${touch.qualityPct}%`,`Ripetibilità ${touch.repeatableScore}%`]};
  }
  const low=analyzeHypertrophyResponse(sessions).filter(x=>x.status==='LOW');
  if(low.length) return {action:'ADD_HYPERTROPHY',reason:`Volume ipertrofico basso per ${low.slice(0,2).map(x=>x.muscle).join(', ')}.`,confidence:'MEDIUM',evidence:low.slice(0,3).map(x=>`${x.muscle}: ${x.currentSets} set produttivi`)};
  return {action:'HOLD',reason:'Nessun segnale abbastanza forte per cambiare la dose.',confidence:'MEDIUM',evidence:['Performance e recupero non richiedono un cambiamento immediato.']};
}
