import { buildCoachAdvisorView, type CoachAdvisorView } from './coachAdvisorPhase6';
import type { SessionSummary } from './types';

export type CoachUiState = CoachAdvisorView & {
  hasSessions: boolean;
  hasConversation: boolean;
  recoveryLabel: string;
  phaseProgress: number;
};

function recoveryLabel(status: CoachAdvisorView['context']['recoveryStatus']): string {
  switch (status) {
    case 'FRESH': return 'Fresco';
    case 'RECOVERING': return 'In recupero';
    case 'FATIGUED': return 'Affaticato';
    default: return 'Molto affaticato';
  }
}

/**
 * Phase 7 presentation adapter.
 * Keeps the UI dependent on one stable Coach contract instead of rebuilding
 * coaching context independently inside components.
 */
export function buildCoachUiState(
  sessions: SessionSummary[] = [],
  hasConversation = false,
): CoachUiState {
  const advisor = buildCoachAdvisorView(sessions);
  const totalWeeks = Math.max(1, advisor.context.phase.totalWeeks);
  const week = Math.min(totalWeeks, Math.max(1, advisor.context.phase.week));
  return {
    ...advisor,
    hasSessions: sessions.length > 0,
    hasConversation,
    recoveryLabel: recoveryLabel(advisor.context.recoveryStatus),
    phaseProgress: week / totalWeeks,
  };
}

export function coachInsightTone(tone: string): string {
  switch (tone) {
    case 'ACTION': return 'border-amber-500/20 bg-amber-500/5';
    case 'WARN': return 'border-rose-500/20 bg-rose-500/5';
    case 'GOOD': return 'border-lime-400/20 bg-lime-400/5';
    default: return 'border-line bg-panel';
  }
}
