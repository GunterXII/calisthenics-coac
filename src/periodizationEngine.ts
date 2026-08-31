import type {
  DayKey,
  ExerciseBlock,
  GoalId,
  GoalState,
  MuscleGroup,
  PhaseAdaptationWeights,
  PhasePlan,
  PhaseTransitionDecision,
  PhaseType,
  PeriodizationCycle,
  PeriodizationState,
  SessionSummary,
} from "./types";
import { sessionStimulusByAdaptation, sessionStimulusByMuscleAndAdaptation } from "./trainingModel";
import { weeklyWorkload } from "./workloadEngine";

/**
 * V16 Phase 2 — periodization planner.
 *
 * This layer does NOT mutate PROGRAM. It builds a phase/week prescription context
 * above the existing microcycle and lets the later program-builder decide how to
 * express that context through exercise selection and volume.
 *
 * Numbers are product heuristics for planning, not physiological constants.
 */

export interface PhaseTemplate {
  id: string;
  type: PhaseType;
  weeks: number;
  weights: PhaseAdaptationWeights;
  volumeMultiplier: number;
  intensityMultiplier: number;
  hypertrophyFloor: number;
  fatigueBudget: number;
  primaryGoals: GoalId[];
  secondaryGoals: GoalId[];
  maintenanceGoals: GoalId[];
}

export interface WeeklyStimulusBudget {
  weights: PhaseAdaptationWeights;
  totalBudget: number;
  targets: Record<keyof PhaseAdaptationWeights, number>;
  minimum: Record<keyof PhaseAdaptationWeights, number>;
}

export interface PeriodizationContext {
  cycle: PeriodizationCycle;
  phase: PhasePlan;
  goals: GoalState[];
  weekTarget: WeeklyStimulusBudget;
  primaryGoals: GoalId[];
  secondaryGoals: GoalId[];
  maintenanceGoals: GoalId[];
}

export interface PhaseReviewInput {
  phase: PhasePlan;
  goalStates: GoalState[];
  sessions: SessionSummary[];
  now?: number;
  minWeeksBeforeAdvance?: number;
  maxWeeksBeforeForcedDeload?: number;
  resumePhaseType?: PhaseType;
}

const PHASE_TEMPLATES: readonly PhaseTemplate[] = [
  {
    id: "accumulation-1",
    type: "ACCUMULATION",
    weeks: 4,
    weights: { skill: 0.25, strength: 0.20, hypertrophy: 0.35, endurance: 0.20, power: 0 },
    volumeMultiplier: 1.00,
    intensityMultiplier: 0.92,
    hypertrophyFloor: 0.90,
    fatigueBudget: 100,
    primaryGoals: ["oap", "flpu", "front_lever_touch", "pushups", "dips"],
    secondaryGoals: ["oap", "flpu", "pushups", "dips"],
    maintenanceGoals: [],
  },
  {
    id: "oap-1",
    type: "OAP_EMPHASIS",
    weeks: 4,
    weights: { skill: 0.30, strength: 0.30, hypertrophy: 0.30, endurance: 0.10, power: 0 },
    volumeMultiplier: 0.95,
    intensityMultiplier: 1.05,
    hypertrophyFloor: 0.80,
    fatigueBudget: 95,
    primaryGoals: ["oap"],
    secondaryGoals: ["flpu", "front_lever_touch"],
    maintenanceGoals: ["pushups", "dips"],
  },
  {
    id: "fl-1",
    type: "FL_EMPHASIS",
    weeks: 4,
    weights: { skill: 0.35, strength: 0.25, hypertrophy: 0.30, endurance: 0.10, power: 0 },
    volumeMultiplier: 0.95,
    intensityMultiplier: 1.03,
    hypertrophyFloor: 0.80,
    fatigueBudget: 95,
    primaryGoals: ["flpu", "front_lever_touch"],
    secondaryGoals: ["oap"],
    maintenanceGoals: ["pushups", "dips"],
  },
  {
    id: "endurance-1",
    type: "ENDURANCE_EMPHASIS",
    weeks: 3,
    weights: { skill: 0.10, strength: 0.15, hypertrophy: 0.35, endurance: 0.40, power: 0 },
    volumeMultiplier: 1.05,
    intensityMultiplier: 0.90,
    hypertrophyFloor: 0.85,
    fatigueBudget: 100,
    primaryGoals: ["pushups", "dips"],
    secondaryGoals: ["oap", "flpu", "front_lever_touch"],
    maintenanceGoals: [],
  },
  {
    id: "realization-1",
    type: "REALIZATION",
    weeks: 1,
    weights: { skill: 0.30, strength: 0.30, hypertrophy: 0.15, endurance: 0.25, power: 0 },
    volumeMultiplier: 0.65,
    intensityMultiplier: 1.05,
    hypertrophyFloor: 0.50,
    fatigueBudget: 70,
    primaryGoals: ["oap", "flpu", "front_lever_touch", "pushups", "dips"],
    secondaryGoals: [],
    maintenanceGoals: [],
  },
  {
    id: "deload-1",
    type: "DELOAD",
    weeks: 1,
    weights: { skill: 0.10, strength: 0.10, hypertrophy: 0.20, endurance: 0.10, power: 0 },
    volumeMultiplier: 0.50,
    intensityMultiplier: 0.75,
    hypertrophyFloor: 0.35,
    fatigueBudget: 45,
    primaryGoals: [],
    secondaryGoals: [],
    maintenanceGoals: ["oap", "flpu", "front_lever_touch", "pushups", "dips"],
  },
];

const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "triceps", "front_delts", "side_delts", "lats", "upper_back", "biceps", "forearms", "core",
  "quads", "glutes", "hamstrings", "calves",
];

const ADAPTATIONS = ["skill", "strength", "hypertrophy", "endurance", "power"] as const;

function round(n:number, d=3){ return Number(n.toFixed(d)); }
function clamp(n:number, min:number, max:number){ return Math.max(min, Math.min(max, n)); }

export function defaultPeriodizationCycle(): PeriodizationCycle {
  const totalWeeks = PHASE_TEMPLATES.filter(p => p.type !== "DELOAD").reduce((sum, phase) => sum + phase.weeks, 0);
  return {
    id: "cc-v16-16w-concurrent",
    totalWeeks,
    phaseOrder: PHASE_TEMPLATES.filter(p => p.type !== "DELOAD").map(p => p.type),
  };
}

export function phaseTemplates(): readonly PhaseTemplate[] { return PHASE_TEMPLATES; }

export function phaseTemplateForType(type:PhaseType):PhaseTemplate {
  return PHASE_TEMPLATES.find(p => p.type === type) ?? PHASE_TEMPLATES[0];
}

export function phasePlanFor(type:PhaseType, week=1):PhasePlan {
  const t = phaseTemplateForType(type);
  const safeWeek = clamp(Math.floor(week), 1, t.weeks);
  return {
    id: `${t.id}-w${safeWeek}`,
    type: t.type,
    week: safeWeek,
    totalWeeks: t.weeks,
    adaptationWeights: { ...t.weights },
    volumeMultiplier: t.volumeMultiplier,
    intensityMultiplier: t.intensityMultiplier,
    hypertrophyFloor: t.hypertrophyFloor,
    fatigueBudget: t.fatigueBudget,
  };
}

export function goalStateFromBaseline(id:GoalId, baseline:number, target:number):GoalState {
  const safeBaseline = Math.max(0, baseline);
  const safeTarget = Math.max(safeBaseline, target);
  return {
    id,
    baseline: safeBaseline,
    current: safeBaseline,
    target: safeTarget,
    trend: 0,
    confidence: 0,
    status: safeBaseline >= safeTarget && safeTarget > 0 ? "REALIZING" : "BUILDING",
  };
}

function goalProgressPct(goal:GoalState):number {
  if(goal.target <= goal.baseline) return goal.current >= goal.target ? 100 : 0;
  return clamp(((goal.current - goal.baseline) / (goal.target - goal.baseline)) * 100, 0, 100);
}

export function deriveGoalStatus(goal:GoalState):GoalState {
  const progress = goalProgressPct(goal);
  let status:GoalState["status"] = "BUILDING";
  if(goal.current >= goal.target && goal.target > 0) status = "REALIZING";
  else if(goal.trend > 0.05) status = "PROGRESSING";
  else if(goal.trend < -0.05) status = "REGRESSING";
  else if(progress > 20) status = "STALLED";
  return { ...goal, status };
}

/**
 * Calculates a balanced weekly adaptation budget. Higher phase weights get a larger
 * share, while a hypertrophy floor guarantees that muscle-building work remains a
 * first-class constraint even during OAP/FL blocks.
 */
export function weeklyStimulusBudget(phase:PhasePlan, totalBudget=100):WeeklyStimulusBudget {
  const raw = phase.adaptationWeights;
  const activeWeights = ADAPTATIONS.reduce((sum, key) => sum + (raw[key] || 0), 0) || 1;
  const targets = {} as WeeklyStimulusBudget["targets"];
  const minimum = {} as WeeklyStimulusBudget["minimum"];
  for(const key of ADAPTATIONS){
    const normalized = (raw[key] || 0) / activeWeights;
    targets[key] = round(totalBudget * normalized);
    minimum[key] = 0;
  }
  // Hypertrophy is a protected floor. Do not steal from the phase's primary bucket
  // mechanically; scale the rest down if needed so the total remains bounded.
  minimum.hypertrophy = round(totalBudget * 0.18 * phase.hypertrophyFloor);
  if(targets.hypertrophy < minimum.hypertrophy){
    const deficit = minimum.hypertrophy - targets.hypertrophy;
    targets.hypertrophy = minimum.hypertrophy;
    const donorKeys = ADAPTATIONS.filter(k => k !== "hypertrophy" && targets[k] > minimum[k]);
    const donorTotal = donorKeys.reduce((s,k) => s + targets[k], 0) || 1;
    for(const k of donorKeys){
      const cut = Math.min(targets[k], deficit * targets[k] / donorTotal);
      targets[k] = round(targets[k] - cut);
    }
  }
  return { weights: {...raw}, totalBudget, targets, minimum };
}

export function buildPeriodizationContext(
  phase:PhasePlan,
  goals:GoalState[],
  totalBudget=100,
):PeriodizationContext {
  const template = phaseTemplateForType(phase.type);
  const cycle = defaultPeriodizationCycle();
  return {
    cycle,
    phase,
    goals: goals.map(deriveGoalStatus),
    weekTarget: weeklyStimulusBudget(phase, totalBudget),
    primaryGoals: [...template.primaryGoals],
    secondaryGoals: [...template.secondaryGoals],
    maintenanceGoals: [...template.maintenanceGoals],
  };
}

export function phaseForCycleWeek(cycle:PeriodizationCycle, absoluteWeek:number):PhasePlan {
  const week=Math.max(1,Math.floor(absoluteWeek));
  // Adaptive-friendly 16-week default: development waves are interrupted by
  // short deload windows at weeks 4, 8 and 12. The final week is realization.
  const defaultSchedule:PhasePlan[]=[
    ...[1,2,3].map(w=>phasePlanFor("ACCUMULATION",w)),
    phasePlanFor("DELOAD",1),
    ...[1,2,3].map(w=>phasePlanFor("OAP_EMPHASIS",w)),
    phasePlanFor("DELOAD",1),
    ...[1,2,3].map(w=>phasePlanFor("FL_EMPHASIS",w)),
    phasePlanFor("DELOAD",1),
    ...[1,2,3].map(w=>phasePlanFor("ENDURANCE_EMPHASIS",w)),
    phasePlanFor("REALIZATION",1),
  ];
  if(cycle.id==="cc-v16-16w-concurrent") return defaultSchedule[Math.min(defaultSchedule.length-1,week-1)];
  let offset=0;
  for(const type of cycle.phaseOrder){
    const template=phaseTemplateForType(type);
    if(week<=offset+template.weeks) return phasePlanFor(type, week-offset);
    offset+=template.weeks;
  }
  const lastType=cycle.phaseOrder[cycle.phaseOrder.length-1]||"REALIZATION";
  return phasePlanFor(lastType, phaseTemplateForType(lastType).weeks);
}


export function resolveAdaptivePhase(
  cycle:PeriodizationCycle,
  cycleStart:number,
  override?: { phaseType:PhaseType; startedAt:number; } | null,
  now=Date.now(),
):PhasePlan {
  if(override && override.startedAt > 0 && now >= override.startedAt){
    const template=phaseTemplateForType(override.phaseType);
    const elapsedWeeks=Math.floor(Math.max(0, now-override.startedAt)/(7*86400000));
    if(elapsedWeeks < template.weeks) return phasePlanFor(override.phaseType, elapsedWeeks+1);
  }
  const elapsedWeeks=Math.floor(Math.max(0, now-cycleStart)/(7*86400000));
  return phaseForCycleWeek(cycle, (elapsedWeeks % cycle.totalWeeks)+1);
}

export function phaseTypeFromId(id:string):PhaseType|undefined {
  if(id.includes('deload-1')) return 'DELOAD';
  if(id.includes('oap-1')) return 'OAP_EMPHASIS';
  if(id.includes('fl-1')) return 'FL_EMPHASIS';
  if(id.includes('endurance-1')) return 'ENDURANCE_EMPHASIS';
  if(id.includes('realization-1')) return 'REALIZATION';
  if(id.includes('accumulation-1')) return 'ACCUMULATION';
  return undefined;
}

export function nextPhaseType(type:PhaseType):PhaseType|undefined {
  const ordered = PHASE_TEMPLATES.filter(p => p.type !== "DELOAD");
  const index = ordered.findIndex(p => p.type === type);
  return index >= 0 && index < ordered.length - 1 ? ordered[index + 1].type : undefined;
}

function recentSessions(sessions:SessionSummary[], now:number):SessionSummary[] {
  return sessions.filter(s => s.date <= now).sort((a,b) => a.date - b.date);
}

function goalSignal(goal:GoalState):number {
  return clamp(0.5 + goal.trend * 4 + goal.confidence * 0.25, 0, 1);
}

function phaseGoalSignal(phase:PhasePlan, goals:GoalState[]):number {
  const template = phaseTemplateForType(phase.type);
  const relevant = goals.filter(g => template.primaryGoals.includes(g.id) || template.secondaryGoals.includes(g.id));
  if(!relevant.length) return 0.5;
  return relevant.reduce((sum,g) => sum + goalSignal(g), 0) / relevant.length;
}

function recentHypertrophyScore(sessions:SessionSummary[], now:number):number {
  const recent = recentSessions(sessions, now).filter(s => s.date >= now - 7 * 86400000);
  let total = 0;
  for(const s of recent){
    const stim = sessionStimulusByAdaptation(
      s.logs.map(l => ({
        id:l.exerciseId,
        name:l.exerciseName,
        kind:l.kind,
        detail:"",
        target:l.prescription?.targetRange || "",
        rest:l.prescription?.restSec || 0,
        sets:l.prescription?.sets,
        minutes:l.prescription?.minutes,
        progressionMode:l.prescription?.progressionMode,
        fatigueCost:l.prescription?.fatigueCost,
        muscleGroups:l.prescription?.muscleGroups,
        effectiveSetWeight:l.prescription?.effectiveSetWeight,
        gripDemand:l.prescription?.gripDemand,
      } as ExerciseBlock)),
    );
    total += stim.hypertrophy;
  }
  return total;
}

export function reviewCurrentPhase(input:PhaseReviewInput):PhaseTransitionDecision {
  const now = input.now ?? Date.now();
  const minWeeks = input.minWeeksBeforeAdvance ?? Math.max(2, Math.min(3, input.phase.totalWeeks - 1));
  const maxWeeks = input.maxWeeksBeforeForcedDeload ?? input.phase.totalWeeks;
  const phase = input.phase;

  if(phase.type === "DELOAD") {
    const next = input.resumePhaseType || "ACCUMULATION";
    return { action:"ADVANCE", currentPhaseId:phase.id, nextPhaseId:phasePlanFor(next, 1).id, reason:"Lo scarico ha completato la sua funzione di recupero; riprendi la fase di sviluppo prevista.", confidence:0.98 };
  }

  const report = weeklyWorkload(input.sessions, now);
  const hypertrophy = recentHypertrophyScore(input.sessions, now);
  const goalSignalValue = phaseGoalSignal(phase, input.goalStates);
  const fatiguePenalty = report.overallRecovery === "HIGH_FATIGUE" ? 0.45 : report.overallRecovery === "FATIGUED" ? 0.25 : 0;
  const volumePenalty = report.totalFatigueLoad > phase.fatigueBudget ? 0.25 : 0;
  const weeks = phase.week;

  if(weeks >= minWeeks && (report.overallRecovery === "HIGH_FATIGUE" || report.totalFatigueLoad > phase.fatigueBudget * 1.15)) {
    const next = phasePlanFor("DELOAD", 1);
    return { action:"DELOAD", currentPhaseId:phase.id, nextPhaseId:next.id, reason:"Recovery/fatigue signal is high enough to justify a recovery week before adding more stimulus.", confidence:0.9 };
  }

  if(weeks >= maxWeeks) {
    const nextType = nextPhaseType(phase.type);
    if(nextType) {
      const next = phasePlanFor(nextType, 1);
      return { action:"ADVANCE", currentPhaseId:phase.id, nextPhaseId:next.id, reason:"The scheduled phase duration is complete; transition to the next emphasis.", confidence:0.96 };
    }
    return { action:"DELOAD", currentPhaseId:phase.id, nextPhaseId:phasePlanFor("DELOAD",1).id, reason:"The cycle has reached its realization endpoint; unload before restarting accumulation.", confidence:0.98 };
  }

  const phaseScore = clamp(goalSignalValue - fatiguePenalty - volumePenalty + (hypertrophy > 0 ? 0.05 : -0.05), 0, 1);
  if(weeks >= minWeeks && phaseScore > 0.72) {
    return { action:"ADVANCE", currentPhaseId:phase.id, nextPhaseId:nextPhaseType(phase.type) ? phasePlanFor(nextPhaseType(phase.type)!,1).id : undefined, reason:"Primary goals are trending positively without a recovery red flag; moving emphasis is appropriate.", confidence:round(0.70 + phaseScore * 0.25,2) };
  }
  if(weeks >= 3 && goalSignalValue < 0.35 && report.overallRecovery === "FRESH") {
    return { action:"EXTEND", currentPhaseId:phase.id, reason:"Performance trend is not yet strong enough to justify changing emphasis, while recovery is still good; repeat the current focus.", confidence:0.78 };
  }
  if(report.overallRecovery === "FATIGUED") {
    return { action:"REPEAT", currentPhaseId:phase.id, reason:"Recovery is reduced but not yet at a deload threshold; keep the phase and hold progression velocity.", confidence:0.80 };
  }
  return { action:"STAY", currentPhaseId:phase.id, reason:"Continue the current phase and let session-level coaching adjust exercise prescriptions.", confidence:0.84 };
}

export function daysForPhaseFocus(phase:PhasePlan):Record<DayKey,number> {
  // Relative emphasis map used by the future Program Builder. Values are multipliers,
  // not literal sets/reps. The split itself stays unchanged.
  switch(phase.type){
    case "OAP_EMPHASIS":
      return {Monday:1,Tuesday:0.9,Wednesday:1,Thursday:1.25,Friday:1,Saturday:0.9,Sunday:1};
    case "FL_EMPHASIS":
      return {Monday:1,Tuesday:1.2,Wednesday:1,Thursday:0.9,Friday:1,Saturday:1.25,Sunday:1};
    case "ENDURANCE_EMPHASIS":
      return {Monday:1.05,Tuesday:0.9,Wednesday:1.1,Thursday:0.9,Friday:1.25,Saturday:0.9,Sunday:1};
    case "REALIZATION":
      return {Monday:0.75,Tuesday:0.8,Wednesday:0.75,Thursday:0.85,Friday:0.8,Saturday:0.85,Sunday:0.8};
    case "DELOAD":
      return {Monday:0.55,Tuesday:0.55,Wednesday:0.55,Thursday:0.55,Friday:0.55,Saturday:0.55,Sunday:0.55};
    default:
      return {Monday:1,Tuesday:1,Wednesday:1,Thursday:1,Friday:1,Saturday:1,Sunday:1};
  }
}

export function hypertrophyFloorByMuscle(phase:PhasePlan, muscles:MuscleGroup[] = MUSCLE_GROUPS):Record<MuscleGroup,number> {
  const floor = {} as Record<MuscleGroup,number>;
  for(const muscle of muscles) floor[muscle] = round(phase.hypertrophyFloor);
  return floor;
}

/** Returns per-muscle hypertrophy stimulus from the supplied blocks. */
export function sessionHypertrophyByMuscle(blocks:ExerciseBlock[], performedSetCounts?:Record<string,number>) {
  const matrix = sessionStimulusByMuscleAndAdaptation(blocks, performedSetCounts);
  const out:Partial<Record<MuscleGroup,number>> = {};
  for(const muscle of Object.keys(matrix) as MuscleGroup[]) out[muscle] = round(matrix[muscle]?.hypertrophy || 0);
  return out;
}
