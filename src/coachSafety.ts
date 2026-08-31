import type { CoachProposal, SessionSummary, WorkoutLog } from "./types";
import type { CoachCoreResult, CoachExerciseAnalysis } from "./coachCore";

export type SafetyDecision = "ALLOW" | "HOLD" | "BLOCK";

export interface CoachSafetyResult {
  decision: SafetyDecision;
  reason: string;
  proposal?: CoachProposal;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function sameExposure(a: WorkoutLog, b: WorkoutLog): boolean {
  return a.exerciseId === b.exerciseId &&
    String(a.variantId || a.exerciseId) === String(b.variantId || b.exerciseId) &&
    String(a.prescription?.targetRange || "") === String(b.prescription?.targetRange || "") &&
    (a.prescription?.sets ?? null) === (b.prescription?.sets ?? null) &&
    (a.prescription?.minutes ?? null) === (b.prescription?.minutes ?? null) &&
    (a.prescription?.restSec ?? null) === (b.prescription?.restSec ?? null) &&
    String(a.prescription?.kind || "") === String(b.prescription?.kind || "");
}

function latestComparableCount(log: WorkoutLog, history: SessionSummary[]): number {
  return history
    .flatMap(session => session.logs || [])
    .filter(previous => previous.date < log.date && previous.status === "complete" && sameExposure(log, previous))
    .length;
}

/**
 * Final production guard. It validates a proposal before it can be surfaced as
 * an actionable Coach recommendation. It never mutates the program or history.
 */
export function validateCoachProposal(
  analysis: CoachExerciseAnalysis,
  proposal: CoachProposal | undefined,
  history: SessionSummary[] = [],
  currentLog?: WorkoutLog,
): CoachSafetyResult {
  if (!proposal) return { decision: "HOLD", reason: "No actionable proposal was generated." };
  if (!finite(analysis.confidence) || analysis.confidence < 70) {
    return { decision: "BLOCK", reason: "Confidence is below the production safety threshold." };
  }
  if (!currentLog || currentLog.status !== "complete") {
    return { decision: "BLOCK", reason: "Only a completed exposure can produce an actionable proposal." };
  }
  if (analysis.exerciseId !== currentLog.exerciseId || String(analysis.variantId) !== String(currentLog.variantId || currentLog.exerciseId)) {
    return { decision: "BLOCK", reason: "Proposal and executed variant do not match." };
  }

  const comparable = latestComparableCount(currentLog, history);
  if (analysis.action === "PROGRESS" && comparable < 1) {
    return { decision: "HOLD", reason: "A progression needs at least one previous comparable exposure in addition to the current one." };
  }

  if (analysis.action === "PROGRESS") {
    if (proposal.type !== "target") return { decision: "BLOCK", reason: "Progression must use a target proposal." };
    if (proposal.from === proposal.to) return { decision: "BLOCK", reason: "The proposed target does not change." };
    if (String(proposal.exerciseId) !== String(currentLog.exerciseId)) return { decision: "BLOCK", reason: "Target proposal exercise mismatch." };
  }

  return { decision: "ALLOW", reason: "Proposal passed the final production safety gate.", proposal };
}

export function filterSafeCoachProposals(
  result: CoachCoreResult,
  session: SessionSummary,
  history: SessionSummary[] = [],
): CoachProposal[] {
  const byExercise = new Map((session.logs || []).map(log => [log.exerciseId, log]));
  const safe: CoachProposal[] = [];
  for (const analysis of result.analyses) {
    if (!analysis.proposal) continue;
    const log = byExercise.get(analysis.exerciseId);
    const checked = validateCoachProposal(analysis, analysis.proposal as CoachProposal, history, log);
    if (checked.decision === "ALLOW" && checked.proposal) safe.push(checked.proposal);
  }
  return safe;
}

export function coachSafetySummary(result: CoachCoreResult, session: SessionSummary, history: SessionSummary[] = []): string {
  const safe = filterSafeCoachProposals(result, session, history);
  if (!safe.length) return "Nessuna modifica del programma è stata autorizzata dal controllo finale.";
  return `${safe.length} proposta/e hanno superato il controllo finale del Coach.`;
}
