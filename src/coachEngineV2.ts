import type { ExerciseBlock, ProgressionCriteria, SessionSummary, WorkoutLog, CoachExposureDecision } from "./types";
import { analyzeReadiness, criteriaForBlock, decideExposure, evaluateProgression, isSamePrescription, progressionStreak, type CoachingLogRecord } from "./coachingEngine";
import { analyzeRecoveryForBlocks, weeklyWorkload, type RecoveryStatus } from "./workloadEngine";
import { trainingProfileForBlock } from "./trainingModel";

export interface ExerciseCoachContext {
  block: ExerciseBlock;
  current: WorkoutLog;
  previousComparable?: WorkoutLog;
  comparableExposures: number;
  weeklyRecovery: RecoveryStatus;
  recoveryPct: number;
  fatigueLoad: number;
  readinessStatus: ReturnType<typeof analyzeReadiness>["status"];
  progressionStreak: number;
}

export interface ExerciseCoachDecision {
  decision: CoachExposureDecision;
  confidence: number;
  reasons: string[];
  performanceBand: ReturnType<typeof decideExposure>["performanceBand"];
  comparableExposure: boolean;
  progressionStreak: number;
  context: ExerciseCoachContext;
}

function record(log: WorkoutLog, session?: SessionSummary): CoachingLogRecord {
  return {
    exerciseId: log.exerciseId,
    status: log.status,
    result: log.result,
    session: { readiness: session?.readiness, date: log.date },
    prescription: log.prescription
      ? {
          variantId: log.prescription.variantId,
          targetRange: log.prescription.targetRange,
          sets: log.prescription.sets,
          minutes: log.prescription.minutes,
          restSec: log.prescription.restSec,
          kind: log.prescription.kind,
        }
      : undefined,
  };
}

function completedComparableLogs(log: WorkoutLog, sessions: SessionSummary[]): WorkoutLog[] {
  const all = sessions
    .flatMap(s => s.logs || [])
    .filter(x => x.exerciseId === log.exerciseId && x.date < log.date && x.status === "complete");
  return all.filter(x => isSamePrescription(record(log), record(x)) && (x.result.band || "") === (log.result.band || ""));
}

function recentFatigueReason(log: WorkoutLog, previous?: WorkoutLog): string | undefined {
  const fatigue = log.result.fatigue;
  if (typeof fatigue === "number" && fatigue >= 4) return `Reported fatigue is ${fatigue}/5; avoid adding work until output stabilizes.`;
  if (previous) {
    const prevTotal = (previous.result.reps || previous.result.emom || []).reduce((a, b) => a + Number(b || 0), 0);
    const curTotal = (log.result.reps || log.result.emom || []).reduce((a, b) => a + Number(b || 0), 0);
    if (prevTotal > 0 && curTotal < prevTotal * 0.85 && (log.result.rir ?? 2) <= 1) {
      return `Output is down ${Math.round((1 - curTotal / prevTotal) * 100)}% versus the last comparable exposure with low RIR; treat this as fatigue until recovery data improves.`;
    }
  }
  return undefined;
}

export function decideExerciseInContext(block: ExerciseBlock, log: WorkoutLog, sessions: SessionSummary[]): ExerciseCoachDecision {
  const session = sessions.find(s => s.id === log.sessionId);
  const criteria: ProgressionCriteria = criteriaForBlock(block);
  const base = decideExposure(block, record(log, session), criteria);
  const readiness = analyzeReadiness(session?.readiness);
  // Evaluate recovery from workload that existed BEFORE this exposure; the current
  // session must not make itself look under-recovered.
  const priorSessions = sessions.filter(s => s.date < log.date);
  const recovery = analyzeRecoveryForBlocks([block], priorSessions, session?.readiness, log.date);
  const muscleStatuses = trainingProfileForBlock(block).muscleGroups
    .map(m => recovery.report.recovery[m])
    .filter(Boolean);
  const worst = muscleStatuses.length ? muscleStatuses.reduce((a, b) => (a.recoveryPct < b.recoveryPct ? a : b)) : undefined;
  const comparable = completedComparableLogs(log, sessions);
  const previousComparable = comparable[comparable.length - 1];
  const currentRecord = record(log, session);
  const streak = progressionStreak(block, [...comparable, log].map(x => record(x, sessions.find(s => s.id === x.sessionId))), criteria);
  const progressionEvaluation = evaluateProgression(block, currentRecord, criteria);
  const reasons = [...base.reasons];
  let decision = base.decision;
  let confidence = base.confidence;
  const requiredStreak = Math.max(2, criteria.consecutiveSessions || 2);

  if (progressionEvaluation.qualifies && streak >= requiredStreak && readiness.allowProgression) {
    decision = "PROGRESS";
    reasons.push(`Progression gate met: ${streak}/${requiredStreak} consecutive qualifying exposures.`);
    confidence = Math.max(confidence, 94);
  }

  if (log.status === "skipped" || log.status === "modified") {
    return {
      decision: "REVIEW",
      confidence: 95,
      reasons: log.status === "skipped" ? ["Skipped exposure: no training conclusion is drawn."] : ["Modified/substituted exposure: keep it out of automatic progression comparisons."],
      performanceBand: base.performanceBand,
      comparableExposure: false,
      progressionStreak: 0,
      context: {
        block,
        current: log,
        previousComparable,
        comparableExposures: comparable.length,
        weeklyRecovery: worst?.status || recovery.report.overallRecovery,
        recoveryPct: worst?.recoveryPct ?? 100,
        fatigueLoad: recovery.report.totalFatigueLoad,
        readinessStatus: readiness.status,
        progressionStreak: 0,
      },
    };
  }

  if (readiness.status === "PAIN_REVIEW") {
    decision = "REGRESS";
    reasons.unshift("Blocking joint-pain signal overrides normal progression logic.");
    confidence = Math.max(confidence, 96);
  } else if (worst && (worst.status === "HIGH_FATIGUE" || worst.status === "FATIGUED")) {
    const fatigueReason = recentFatigueReason(log, previousComparable);
    if (fatigueReason) reasons.unshift(fatigueReason);
    else reasons.unshift(`${worst.muscle.replace(/_/g, " ")} recovery is ${Math.round(worst.recoveryPct)}%; keep the prescription stable.`);
    if (decision === "PROGRESS" || readiness.status !== "READY") decision = "REDUCE_VOLUME";
    else decision = "HOLD";
    confidence = Math.max(confidence, 90);
  } else if (readiness.status === "RECOVERY" || readiness.status === "CAUTION") {
    if (decision === "PROGRESS") decision = "HOLD";
    reasons.unshift("Readiness does not support a harder exposure today.");
    confidence = Math.max(confidence, 88);
  }

  if (previousComparable) {
    const currentTotal = (log.result.reps || log.result.emom || []).reduce((a, b) => a + Number(b || 0), 0);
    const previousTotal = (previousComparable.result.reps || previousComparable.result.emom || []).reduce((a, b) => a + Number(b || 0), 0);
    if (previousTotal > 0 && currentTotal < previousTotal * 0.85 && readiness.status === "READY") {
      reasons.unshift(`Output is ${Math.round((1 - currentTotal / previousTotal) * 100)}% below the last comparable exposure; confirm recovery before reacting.`);
      if (decision === "PROGRESS") decision = "HOLD";
    }
  }

  if (decision === "PROGRESS" && streak < requiredStreak) {
    decision = "HOLD";
    reasons.unshift(`Progression evidence is not yet stable: ${streak}/${Math.max(2, criteria.consecutiveSessions || 2)} qualifying comparable exposures.`);
    confidence = Math.min(confidence, 86);
  }

  const profile = trainingProfileForBlock(block);
  if (profile.priority === "primary" && profile.role === "skill" && decision === "REDUCE_VOLUME") {
    decision = "HOLD";
    reasons.unshift("Primary skill work is protected; reduce lower-priority volume first rather than cutting the skill exposure.");
  }

  return {
    decision,
    confidence,
    reasons: [...new Set(reasons)].slice(0, 4),
    performanceBand: base.performanceBand,
    comparableExposure: Boolean(previousComparable),
    progressionStreak: streak,
    context: {
      block,
      current: log,
      previousComparable,
      comparableExposures: comparable.length,
      weeklyRecovery: worst?.status || recovery.report.overallRecovery,
      recoveryPct: worst?.recoveryPct ?? 100,
      fatigueLoad: recovery.report.totalFatigueLoad,
      readinessStatus: readiness.status,
      progressionStreak: streak,
    },
  };
}

export function decideSessionExercises(session: SessionSummary, program: Record<string, { blocks: ExerciseBlock[] }>, sessions: SessionSummary[] = []): ExerciseCoachDecision[] {
  const blocks = program[session.day]?.blocks || [];
  const all = [...sessions.filter(s => s.id !== session.id), session];
  return session.logs.map(log => {
    const block = blocks.find(b => b.id === log.exerciseId);
    if (!block) return undefined;
    return decideExerciseInContext(block, log, all);
  }).filter(Boolean) as ExerciseCoachDecision[];
}

export function sessionDecisionSummary(decisions: ExerciseCoachDecision[]) {
  const counts: Record<string, number> = {};
  for (const d of decisions) counts[d.decision] = (counts[d.decision] || 0) + 1;
  const priority = ["REGRESS", "REDUCE_VOLUME", "REVIEW", "HOLD", "PROGRESS"];
  const overall = priority.find(x => counts[x]) || "HOLD";
  return { overall, counts };
}
