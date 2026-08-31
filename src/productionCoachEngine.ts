import type { CoachContext } from './coachAdvisorEngine';
import { buildCoachReview, type CoachReview } from './coachReviewEngine';
import { reviewActiveExperiments, type ExperimentEvaluation } from './coachExperimentEngine';
import { getCoachExperiments } from './storage';

export interface ProductionCoachCycle {
  review: CoachReview;
  experiments: ExperimentEvaluation[];
  activeExperimentCount: number;
  requiresHumanDecision: boolean;
  summary: string;
}

export function runProductionCoachCycle(context: CoachContext): ProductionCoachCycle {
  const experiments=reviewActiveExperiments(context.sessions);
  const review=buildCoachReview(context.sessions, context.phase);
  const active=getCoachExperiments().filter(e=>e.status==='active').length;
  const requiresHumanDecision=review.phaseDecision.action!=='STAY' || experiments.some(e=>e.status==='inconclusive');
  const summary = requiresHumanDecision
    ? 'Il Coach ha trovato almeno una decisione che richiede revisione umana.'
    : 'Nessuna decisione critica: continua il piano e accumula evidenza comparabile.';
  return {review,experiments,activeExperimentCount:active,requiresHumanDecision,summary};
}
