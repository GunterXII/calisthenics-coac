import type { CoachContext } from './coachAdvisorEngine';
import type { DayKey, ExerciseBlock, MuscleGroup, SessionSummary } from './types';
import { getCoachExperiments, getProgramOverrides } from './storage';
import { PROGRAM } from './program';
import { trainingProfileForBlock } from './trainingModel';
import { weeklyStimulusActual } from './adaptiveStimulusEngine';
import { analyzeHypertrophyResponse } from './hypertrophyResponseEngine';
import { allSkillReadiness } from './skillPerformanceEngine';
import { weeklyWorkload } from './workloadEngine';
import { buildPeriodizedDay } from './programBuilder';
import { buildAdaptivePeriodizedDay } from './adaptiveProgramEngine';
import { simulateProgramImpact, type ImpactAction } from './coachImpactEngine';

export type CoachToolName =
  | 'get_goal_status'
  | 'get_recent_sessions'
  | 'get_weekly_workload'
  | 'get_hypertrophy_status'
  | 'get_current_program'
  | 'simulate_program_change'
  | 'get_active_experiments';

export interface CoachToolCall {
  name: CoachToolName;
  arguments?: Record<string, unknown>;
}

export interface CoachToolResult {
  name: CoachToolName;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export const COACH_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_goal_status',
      description: 'Legge stato, trend, best e capacità ripetibile degli obiettivi dell\'atleta.',
      parameters: { type: 'object', properties: { goalId: { type: 'string', enum: ['oap','flpu','front_lever_touch','pushups','dips'] } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_sessions',
      description: 'Restituisce le ultime sessioni e le performance rilevanti senza modificare dati.',
      parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 12 } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weekly_workload',
      description: 'Restituisce carico, fatica, recupero e warning dell\'ultima settimana.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hypertrophy_status',
      description: 'Restituisce il volume ipertrofico stimato per muscolo e segnala aree basse/alte.',
      parameters: { type: 'object', properties: { muscle: { type: 'string' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_program',
      description: 'Legge la seduta corrente o il programma di una giornata, inclusi override applicati.',
      parameters: { type: 'object', properties: { day: { type: 'string', enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_program_change',
      description: 'Simula in sola lettura una modifica semplice di set, target o minuti e descrive la variazione teorica di dose/fatica.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string' },
          kind: { type: 'string', enum: ['ADD_SET','REMOVE_SET','CHANGE_TARGET','CHANGE_MINUTES'] },
          value: { type: 'number' },
        },
        required: ['exerciseId','kind','value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_experiments',
      description: 'Restituisce esperimenti di coaching in corso e le loro osservazioni.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
] as const;

function safeLimit(value: unknown, fallback = 6) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(12, Math.round(n))) : fallback;
}

function currentProgramForDay(context: CoachContext, day: DayKey): { program: ReturnType<typeof buildAdaptivePeriodizedDay>['program']; base: ReturnType<typeof buildPeriodizedDay> } {
  const adaptive = buildAdaptivePeriodizedDay(context.phase, day, ['oap','flpu','front_lever_touch','pushups','dips'], context.sessions);
  const base = buildPeriodizedDay({ phase: context.phase, day, goals: ['oap','flpu','front_lever_touch','pushups','dips'] });
  const overrides = getProgramOverrides();
  const blocks = adaptive.program.blocks.map(b => overrides[b.id] ? { ...b, ...overrides[b.id] } : b);
  return { program: { ...adaptive.program, blocks }, base };
}

function serializeSession(s: SessionSummary) {
  return {
    id: s.id,
    date: s.date,
    day: s.day,
    readiness: s.readiness,
    totalReps: s.totalReps,
    durationSec: s.durationSec,
    logs: s.logs.map(l => ({
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      variantId: l.variantId,
      status: l.status,
      prescription: l.prescription,
      reps: l.result.reps,
      seconds: l.result.seconds,
      emom: l.result.emom,
      rir: l.result.rir,
      fatigue: l.result.fatigue,
      quality: l.result.quality,
      note: l.result.note,
    })),
  };
}

function hypertrophyRows(sessions: SessionSummary[]) {
  const snapshot = weeklyStimulusActual(sessions);
  return Object.values(snapshot.hypertrophyByMuscle)
    .map(x => ({ muscle: x.muscle, productiveSets: x.productiveSets, adjustedStimulus: x.adjustedStimulus, exposures: x.exposures, status: x.status }));
}

function normalizeMuscle(value: unknown): MuscleGroup | undefined {
  if (!value) return undefined;
  const key = String(value).toLowerCase().replace(/\s+/g, '_') as MuscleGroup;
  return hypertrophyRows([]).some(x => x.muscle === key) ? key : undefined;
}

export function executeCoachTool(call: CoachToolCall, context: CoachContext): CoachToolResult {
  try {
    switch (call.name) {
      case 'get_goal_status': {
        const id = call.arguments?.goalId;
        const goal = context.goals.find(g => g.goal.id === id);
        if (!goal) return { name: call.name, ok: false, error: 'Goal non trovato.' };
        return { name: call.name, ok: true, data: {
          id: goal.goal.id,
          name: goal.goal.label,
          current: goal.current,
          target: goal.target,
          best: goal.best,
          repeatableBest: goal.repeatableBest,
          qualityAdjustedBest: goal.qualityAdjustedBest,
          recentMedian: goal.recentMedian,
          trendPct: goal.trendPct,
          confidence: goal.confidence,
          status: goal.status,
        } };
      }
      case 'get_recent_sessions':
        return { name: call.name, ok: true, data: context.sessions.slice(0, safeLimit(call.arguments?.limit)).map(serializeSession) };
      case 'get_weekly_workload': {
        const workload = weeklyWorkload(context.sessions, Date.now());
        return { name: call.name, ok: true, data: {
          totalAdjustedSets: workload.totalAdjustedSets,
          totalFatigueLoad: workload.totalFatigueLoad,
          overallRecovery: workload.overallRecovery,
          warnings: workload.warnings,
        } };
      }
      case 'get_hypertrophy_status': {
        const rows = hypertrophyRows(context.sessions);
        const muscle = normalizeMuscle(call.arguments?.muscle);
        const selected = muscle ? rows.filter(x => x.muscle === muscle) : rows;
        return { name: call.name, ok: true, data: selected };
      }
      case 'get_current_program': {
        const day = (call.arguments?.day || context.sessions[0]?.day || 'Monday') as DayKey;
        const view = currentProgramForDay(context, day);
        return { name: call.name, ok: true, data: {
          day,
          phase: { type: context.phase.type, week: context.phase.week, totalWeeks: context.phase.totalWeeks },
          blocks: view.program.blocks.map(b => ({ id:b.id, name:b.name, kind:b.kind, role:b.trainingRole, priority:b.priority, target:b.target, sets:b.sets, minutes:b.minutes, rest:b.rest, fatigueCost:b.fatigueCost, muscleGroups:b.muscleGroups })),
        } };
      }
      case 'simulate_program_change': {
        const exerciseId = String(call.arguments?.exerciseId || '');
        const kind = String(call.arguments?.kind || '');
        const value = Number(call.arguments?.value);
        const day = (context.sessions.find(s => s.logs.some(l => l.exerciseId === exerciseId))?.day || 'Monday') as DayKey;
        const view = currentProgramForDay(context, day);
        const block = view.program.blocks.find(b => b.id === exerciseId);
        if (!block || !Number.isFinite(value)) return { name: call.name, ok: false, error: 'Esercizio o valore non valido.' };
        const next: Partial<ExerciseBlock> = {};
        if (kind === 'ADD_SET') next.sets = Math.max(1, (block.sets || 0) + value);
        else if (kind === 'REMOVE_SET') next.sets = Math.max(1, (block.sets || 0) - value);
        else if (kind === 'CHANGE_MINUTES' && block.kind === 'EMOM') next.minutes = Math.max(5, Math.min(18, value));
        else if (kind === 'CHANGE_TARGET') next.target = String(value);
        else return { name: call.name, ok: false, error: 'Modifica non supportata in simulazione.' };
        const impact = simulateProgramImpact(context, exerciseId, kind as ImpactAction, value);
        if (!impact) return { name: call.name, ok: false, error: 'Impatto non calcolabile.' };
        return { name: call.name, ok: true, data: {
          day, exerciseId, exerciseName: block.name,
          before: impact.before, after: impact.after,
          estimatedFatigueDelta: impact.delta.fatigue,
          estimatedHypertrophyDelta: impact.delta.hypertrophy,
          weekly: impact.weekly,
          verdict: impact.verdict, warnings: impact.warnings,
          note: 'Simulazione: nessuna modifica è stata salvata.',
        } };
      }
      case 'get_active_experiments':
        return { name: call.name, ok: true, data: getCoachExperiments().filter(e => e.status === 'active').slice(-10) };
      default:
        return { name: call.name, ok: false, error: 'Tool non supportato.' };
    }
  } catch (error) {
    return { name: call.name, ok: false, error: error instanceof Error ? error.message : 'Errore tool.' };
  }
}

export function buildCoachToolSnapshot(context: CoachContext) {
  const workload = weeklyWorkload(context.sessions, Date.now());
  const stimulus = weeklyStimulusActual(context.sessions);
  const days: DayKey[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const currentProgram = Object.fromEntries(days.map(day => {
    const view = currentProgramForDay(context, day);
    return [day, view.program.blocks.map(b => ({
      id:b.id, name:b.name, kind:b.kind, role:b.trainingRole, priority:b.priority,
      target:b.target, sets:b.sets, minutes:b.minutes, rest:b.rest,
      fatigueCost:b.fatigueCost, muscleGroups:b.muscleGroups,
    }))];
  }));

  // Pre-compute a bounded set of deterministic simulations. The LLM can only
  // reason over simulations that the app itself has calculated; it cannot invent
  // a training-load impact or mutate the program.
  const simulations: Record<string, unknown> = {};
  for (const day of days) {
    const blocks = (currentProgram[day] || []) as Array<{id:string; kind:string; sets?:number; minutes?:number; target?:string}>;
    for (const block of blocks) {
      const actions: Array<[ImpactAction, number]> = [['ADD_SET',1],['REMOVE_SET',1]];
      if (block.kind === 'EMOM') actions.push(['CHANGE_MINUTES',1],['CHANGE_MINUTES',-1]);
      for (const [kind,value] of actions) {
        const impact = simulateProgramImpact(context, block.id, kind, value);
        if (impact) simulations[`${block.id}:${kind}:${value}`] = {
          day, exerciseId:block.id, exerciseName:(blocks.find(b=>b.id===block.id) as any)?.name,
          before:impact.before, after:impact.after,
          estimatedFatigueDelta:impact.delta.fatigue,
          estimatedHypertrophyDelta:impact.delta.hypertrophy,
          weekly:impact.weekly, verdict:impact.verdict, warnings:impact.warnings,
        };
      }
    }
  }

  return {
    currentPhase: { id: context.phase.id, type: context.phase.type, week: context.phase.week, totalWeeks: context.phase.totalWeeks, fatigueBudget: context.phase.fatigueBudget },
    goals: context.goals.map(g => ({ id:g.goal.id, name:g.goal.label, current:g.current, target:g.target, best:g.best, repeatableBest:g.repeatableBest, qualityAdjustedBest:g.qualityAdjustedBest, recentMedian:g.recentMedian, trendPct:g.trendPct, confidence:g.confidence, status:g.status })),
    recentSessions: context.sessions.slice(0,12).map(serializeSession),
    workload: { totalAdjustedSets: workload.totalAdjustedSets, totalFatigueLoad: workload.totalFatigueLoad, overallRecovery: workload.overallRecovery, warnings: workload.warnings },
    hypertrophy: analyzeHypertrophyResponse(context.sessions).map(x => ({ muscle:x.muscle, productiveSets:x.currentSets, previousSets:x.previousSets, trendPct:x.trendPct, adjustedStimulus:x.currentStimulus, status:x.status, confidence:x.confidence })),
    skillReadiness: allSkillReadiness(context.sessions).map(x=>({goalId:x.goalId,performance:x.performance,qualityPct:x.qualityPct,repeatability:x.repeatability,recentMedian:x.recentMedian,currentRir:x.currentRir,recoveryOk:x.recoveryOk,canProgress:x.canProgress,reason:x.reason})),
    activeExperiments: getCoachExperiments().filter(e=>e.status==='active').slice(-10),
    currentProgram,
    simulations,
  };
}
