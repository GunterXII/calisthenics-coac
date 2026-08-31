import type { PhasePlan, SessionSummary } from './types';
import { buildCoachReview, type CoachReview } from './coachReviewEngine';
import { savePeriodizationReview } from './storage';

export interface SessionCoachLoopResult {
  review: CoachReview;
  saved: boolean;
}

/**
 * Closes the post-workout coaching loop without silently modifying the plan.
 * A review is persisted automatically; phase changes still require explicit approval.
 */
export function runPostSessionCoachLoop(
  sessions: SessionSummary[],
  phase: PhasePlan,
  now = Date.now(),
): SessionCoachLoopResult {
  const review = buildCoachReview(sessions, phase);
  let saved = false;
  try {
    savePeriodizationReview({
      reviewId: review.id,
      action: review.phaseDecision.action,
      phaseId: review.phase.id,
      nextPhaseId: review.phaseDecision.nextPhaseId,
      reason: review.phaseDecision.reason,
      confidence: review.phaseDecision.confidence,
      activeFrom: now,
      activeUntil: review.phaseDecision.nextPhaseId ? now + 7 * 86400000 : undefined,
    });
    saved = true;
  } catch {
    saved = false;
  }
  return { review, saved };
}

export function coachLoopPriority(review: CoachReview): 'GOOD'|'CAUTION'|'ACTION' {
  if (review.tone === 'RECOVERY' || review.phaseDecision.action === 'DELOAD') return 'ACTION';
  if (review.tone === 'PRIORITY' || review.tone === 'CAUTION' || review.phaseDecision.action !== 'STAY') return 'CAUTION';
  return 'GOOD';
}
