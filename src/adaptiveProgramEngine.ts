import type {DayKey, DayProgram, ExerciseBlock, PhasePlan, SessionSummary, MuscleGroup, WorkoutLog} from './types';
import {analyzeReadiness} from './coachingEngine';
import {trainingProfileForBlock} from './trainingModel';
import {recoveryForMuscle, weeklyWorkload} from './workloadEngine';
import {buildPeriodizedDay} from './programBuilder';

export type AdaptiveAdjustmentAction =
  | 'NONE'
  | 'PROTECT'
  | 'ADD_VOLUME'
  | 'ADD_DENSITY'
  | 'REDUCE_VOLUME'
  | 'REDUCE_DENSITY'
  | 'HOLD';

export interface AdaptiveBlockDecision {
  exerciseId: string;
  action: AdaptiveAdjustmentAction;
  setsDelta: number;
  minutesDelta: number;
  reason: string;
  confidence: number;
}

export interface AdaptiveDayPlan {
  day: DayKey;
  program: DayProgram;
  decisions: AdaptiveBlockDecision[];
  weeklyFatigue: number;
  overallRecovery: ReturnType<typeof weeklyWorkload>['overallRecovery'];
}

const clamp = (n:number,min:number,max:number) => Math.max(min, Math.min(max,n));
const round = (n:number,d=2) => Number(n.toFixed(d));
const isEndurance = (b:ExerciseBlock) => b.trainingRole === 'endurance' || b.kind === 'EMOM' || b.id.endsWith('-long') || b.id.includes('density');
const isPrimarySkill = (b:ExerciseBlock) => b.priority === 'primary' && (b.trainingRole === 'skill' || b.progressionMode === 'skill_quality' || b.progressionMode === 'static_hold');

function recentLogsForBlock(block:ExerciseBlock, sessions:SessionSummary[], now:number):WorkoutLog[] {
  return sessions
    .flatMap(s => s.logs || [])
    .filter(l => l.exerciseId === block.id && l.date < now && l.status === 'complete' && !l.skipped)
    .sort((a,b) => a.date - b.date);
}

function average(values:number[]) { return values.length ? values.reduce((a,b)=>a+b,0)/values.length : undefined; }

function parseTarget(target:string):{min:number;max:number;kind:'reps'|'seconds'|'emom'}|undefined {
  const em = target.match(/(\d+)\s*[–-]\s*(\d+)\/min/i);
  if (em) return {min:Number(em[1]), max:Number(em[2]), kind:'emom'};
  const sec = target.match(/(\d+)\s*[–-]\s*(\d+)\s*sec/i);
  if (sec) return {min:Number(sec[1]), max:Number(sec[2]), kind:'seconds'};
  const rep = target.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (rep) return {min:Number(rep[1]), max:Number(rep[2]), kind:'reps'};
  return undefined;
}

function previousPerformance(block:ExerciseBlock, sessions:SessionSummary[], now:number){
  const logs = recentLogsForBlock(block, sessions, now).slice(-2);
  const target = parseTarget(block.target);
  if (!logs.length || !target) return {known:false, atUpper:false, low:false, stable:false, avg:undefined as number|undefined, qualityGood:false, rir:undefined as number|undefined};
  const values = logs.map(l => {
    if (target.kind === 'seconds') return average(l.result.seconds || [] ) || 0;
    if (target.kind === 'emom') return average(l.result.emom || []) || 0;
    return average(l.result.reps || []) || 0;
  });
  const avg = average(values);
  const qualityScores = logs.flatMap(l => l.result.quality || []).map(q => q === 'Clean' ? 1 : q === 'Shaky' ? 0.5 : 0);
  const qualityGood = qualityScores.length === 0 || average(qualityScores)! >= 0.75;
  const avgRir = average(logs.map(l => l.result.rir).filter((x):x is number => typeof x === 'number'));
  const atUpper = avg !== undefined && avg >= target.max * 0.97 && qualityGood && (avgRir === undefined || avgRir >= 1);
  const low = avg !== undefined && avg < target.min * 0.90;
  const stable = values.length > 1 ? Math.abs(values[values.length-1] - values[0]) <= Math.max(target.max * 0.15, 1) : true;
  return {known:true, atUpper, low, stable, avg, qualityGood, rir:avgRir};
}

function readinessTrend(sessions:SessionSummary[], now:number){
  const recent = sessions.filter(s => s.date < now && s.date >= now - 14*86400000).slice(-5);
  const scores = recent.map(s => analyzeReadiness(s.readiness).score).filter(Number.isFinite);
  return average(scores) ?? 75;
}

function muscleRecoveryFor(block:ExerciseBlock, sessions:SessionSummary[], now:number){
  const profile = trainingProfileForBlock(block);
  const statuses = (profile.muscleGroups || []).map(m => recoveryForMuscle(m, sessions, now));
  const worst = statuses.length ? statuses.reduce((a,b) => a.recoveryPct < b.recoveryPct ? a : b) : undefined;
  return worst;
}

function capSets(block:ExerciseBlock){
  if (block.trainingRole === 'skill') return 6;
  if (block.trainingRole === 'strength') return 5;
  if (block.trainingRole === 'hypertrophy') return 5;
  return 4;
}

function adjustBlock(block:ExerciseBlock, phase:PhasePlan, sessions:SessionSummary[], now:number):AdaptiveBlockDecision {
  const report = weeklyWorkload(sessions, now);
  const profile = trainingProfileForBlock(block);
  const performance = previousPerformance(block, sessions, now);
  const readiness = readinessTrend(sessions, now);
  const worst = muscleRecoveryFor(block, sessions, now);
  const lowRecovery = Boolean(worst && worst.recoveryPct < 60);
  const highFatigue = report.overallRecovery === 'HIGH_FATIGUE' || report.totalFatigueLoad > phase.fatigueBudget * 1.10;
  const fresh = report.overallRecovery === 'FRESH' && readiness >= 75 && !lowRecovery;

  if (highFatigue && (profile.priority !== 'primary' || !isPrimarySkill(block))) {
    if (block.trainingMethod === 'DENSITY_5X70') return {exerciseId:block.id,action:'REDUCE_VOLUME',setsDelta:-1,minutesDelta:0,reason:'Recent workload is high; reduce one density set before shortening the prescribed recovery.',confidence:0.92};
    if (block.kind === 'EMOM' || isEndurance(block)) return {exerciseId:block.id,action:'REDUCE_DENSITY',setsDelta:0,minutesDelta:-1,reason:'Recent workload is high; reduce low-priority density before cutting primary skill work.',confidence:0.90};
    if (block.sets && block.sets > 1) return {exerciseId:block.id,action:'REDUCE_VOLUME',setsDelta:-1,minutesDelta:0,reason:'Recent workload/recovery is high; reduce lower-priority volume.',confidence:0.90};
  }

  if (lowRecovery && isPrimarySkill(block)) {
    return {exerciseId:block.id,action:'PROTECT',setsDelta:0,minutesDelta:0,reason:`${worst!.muscle} recovery is ${Math.round(worst!.recoveryPct)}%; protect skill quality and do not add volume.`,confidence:0.92};
  }

  if (!performance.known) return {exerciseId:block.id,action:'HOLD',setsDelta:0,minutesDelta:0,reason:'No comparable completed exposure yet; establish a clean baseline before adapting volume.',confidence:0.86};

  if (performance.low) {
    if (isPrimarySkill(block)) return {exerciseId:block.id,action:'HOLD',setsDelta:0,minutesDelta:0,reason:'Recent output is below target; keep the skill exposure stable and avoid adding fatigue.',confidence:0.86};
    if (block.kind === 'EMOM' || isEndurance(block)) return {exerciseId:block.id,action:'REDUCE_DENSITY',setsDelta:0,minutesDelta:-1,reason:'Recent endurance output is below target; reduce density slightly instead of pushing failure.',confidence:0.84};
    return {exerciseId:block.id,action:'HOLD',setsDelta:0,minutesDelta:0,reason:'Recent output is below target; repeat the prescription and rebuild quality.',confidence:0.84};
  }

  if (fresh && performance.atUpper && performance.stable) {
    if (phase.type === 'ENDURANCE_EMPHASIS' && (block.kind === 'EMOM' || isEndurance(block))) {
      const maxMinutes = clamp((block.minutes || 10) + 1, 5, 15);
      return {exerciseId:block.id,action:'ADD_DENSITY',setsDelta:0,minutesDelta:maxMinutes - (block.minutes || 0),reason:'Output is stable at the top of the target with adequate recovery; add one minute of sustainable density.',confidence:0.91};
    }
    if (block.trainingMethod !== 'DENSITY_5X70' && block.trainingRole === 'hypertrophy' && block.sets && block.sets < capSets(block)) {
      // Protect the phase budget: only add a set to hypertrophy when recovery is good.
      return {exerciseId:block.id,action:'ADD_VOLUME',setsDelta:1,minutesDelta:0,reason:'Top of the rep range is repeatable with good recovery; add one productive hypertrophy set.',confidence:0.89};
    }
    if ((block.trainingRole === 'strength' || block.trainingRole === 'skill') && block.sets && block.sets < capSets(block) && phase.type !== 'REALIZATION') {
      return {exerciseId:block.id,action:'ADD_VOLUME',setsDelta:1,minutesDelta:0,reason:'Performance is stable at the top of the target with adequate recovery; add one high-quality exposure.',confidence:0.88};
    }
  }

  // Hypertrophy floor safeguard: if a target muscle is lightly loaded, prefer adding
  // volume to a hypertrophy block rather than increasing fatigue-heavy skill work.
  if (block.trainingMethod !== 'DENSITY_5X70' && block.trainingRole === 'hypertrophy' && block.sets && block.sets < capSets(block)) {
    const thinMuscle = (profile.muscleGroups || []).find(m => report.muscles[m]?.adjustedSets < 6);
    if (thinMuscle && fresh) {
      return {exerciseId:block.id,action:'ADD_VOLUME',setsDelta:1,minutesDelta:0,reason:`${thinMuscle.replace(/_/g,' ')} is below the conservative hypertrophy floor; add one productive set.`,confidence:0.87};
    }
  }

  return {exerciseId:block.id,action:'NONE',setsDelta:0,minutesDelta:0,reason:'Current workload, recovery and performance support keeping the prescription unchanged.',confidence:0.80};
}

export function buildAdaptivePeriodizedDay(phase:PhasePlan, day:DayKey, goals:import('./types').GoalId[]|undefined, sessions:SessionSummary[], now=Date.now()):AdaptiveDayPlan {
  const base = buildPeriodizedDay({phase, day, goals});
  const resolvedBase = {...base, blocks:base.blocks.map(block => resolveDensityBlock(block, sessions))};
  const decisions:AdaptiveBlockDecision[] = resolvedBase.blocks.map(block => adjustBlock(block, phase, sessions, now));
  const blocks = resolvedBase.blocks.map(block => {
    const decision = decisions.find(d => d.exerciseId === block.id)!;
    const next = {...block};
    if (typeof next.sets === 'number') next.sets = Math.max(1, next.sets + decision.setsDelta);
    if (typeof next.minutes === 'number') next.minutes = Math.max(5, next.minutes + decision.minutesDelta);
    next.detail = `${next.detail} · Coach: ${decision.action.replace('_',' ').toLowerCase()}`;
    return next;
  });
  const report = weeklyWorkload(sessions, now);
  return {day, program:{...base, blocks}, decisions, weeklyFatigue:round(report.totalFatigueLoad), overallRecovery:report.overallRecovery};
}
