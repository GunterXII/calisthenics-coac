import type { DayKey, ExerciseBlock, PhasePlan, SessionSummary } from './types';
import { phaseLabel, dayLabel } from './i18n';

export interface WorkoutFlowCopy {
  phase: string;
  day: string;
  headline: string;
  subline: string;
  completionNext: 'COACH_REVIEW'|'MOBILITY'|'DONE';
}

export function workoutFlowCopy(day: DayKey, phase: PhasePlan, nextBlock?: ExerciseBlock, session?: SessionSummary): WorkoutFlowCopy {
  const headline = nextBlock?.name ? `Focus: ${nextBlock.name}` : 'Allenamento pronto';
  const subline = session ? 'La seduta è stata salvata. Controlla prima la revisione del Coach.' : 'Segui l’ordine proposto. Il Coach aggiusterà la dose, non il tuo compito di oggi.';
  return {
    phase: phaseLabel(phase.type),
    day: dayLabel(day),
    headline,
    subline,
    completionNext: session ? 'COACH_REVIEW' : 'DONE',
  };
}

export function recommendedEndAction(hasMobility: boolean, hasReview: boolean): 'COACH_REVIEW'|'MOBILITY'|'DONE' {
  if (!hasReview) return 'COACH_REVIEW';
  if (hasMobility) return 'MOBILITY';
  return 'DONE';
}
