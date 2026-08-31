import type { ExerciseBlock, MuscleGroup, SessionSummary, TrainingAdaptation, WorkoutLog } from './types';
import { trainingProfileForBlock } from './trainingModel';
import { PROGRAM } from './program';
import { WORKLOAD_MUSCLES } from './workloadEngine';

export interface AdaptationBudgetSnapshot {
  target: number;
  actual: number;
  attainmentPct: number;
}

export interface MuscleHypertrophySnapshot {
  muscle: MuscleGroup;
  productiveSets: number;
  adjustedStimulus: number;
  exposures: number;
  status: 'LOW' | 'ADEQUATE' | 'HIGH';
}

export interface WeeklyStimulusSnapshot {
  adaptations: Record<TrainingAdaptation, AdaptationBudgetSnapshot>;
  hypertrophyByMuscle: Record<MuscleGroup, MuscleHypertrophySnapshot>;
  totalFatigue: number;
}

export interface AdaptiveDecision {
  action: 'PROGRESS_PRIMARY' | 'HOLD' | 'ADD_HYPERTROPHY' | 'REDUCE_SECONDARY' | 'DELOAD';
  reasons: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const ADAPTATIONS: TrainingAdaptation[] = ['skill','strength','hypertrophy','endurance','power'];
const round = (n:number,d=2) => Number(n.toFixed(d));
const clamp = (n:number,min:number,max:number) => Math.max(min, Math.min(max,n));

function blockFromLog(log:WorkoutLog): ExerciseBlock | undefined {
  const blocks = PROGRAM[log.day]?.blocks || [];
  const p = log.prescription;
  return blocks.find(b=>b.id===log.exerciseId) || {
    id: log.exerciseId,
    name: log.exerciseName,
    kind: log.kind,
    detail: '',
    target: p?.targetRange || '',
    rest: p?.restSec || 0,
    sets: p?.sets,
    minutes: p?.minutes,
    progressionMode: p?.progressionMode,
    fatigueCost: p?.fatigueCost,
    muscleGroups: p?.muscleGroups,
    effectiveSetWeight: p?.effectiveSetWeight,
    gripDemand: p?.gripDemand,
  } as ExerciseBlock;
}

function performedUnits(log: WorkoutLog): number {
  if (log.status !== 'complete') return 0;
  if (log.kind === 'EMOM') return Math.max(0, (log.result.emom || []).length);
  if (log.result.seconds?.length) return log.result.seconds.length;
  return (log.result.reps || []).length;
}

function qualityFactor(log: WorkoutLog): number {
  const q = log.result.quality || [];
  if (!q.length) return 0.95;
  let total = 0;
  for (const x of q) total += x === 'Clean' ? 1 : x === 'Shaky' ? 0.88 : 0.55;
  return total / q.length;
}

function proximityFactor(log: WorkoutLog): number {
  const rir = log.result.rir;
  if (typeof rir !== 'number') return 0.92;
  return rir <= 0 ? 1 : rir === 1 ? 0.98 : rir === 2 ? 0.92 : 0.82;
}

function fatigueFactor(log: WorkoutLog): number {
  const fatigue = log.result.fatigue;
  if (typeof fatigue !== 'number') return 1;
  return fatigue <= 2 ? 0.92 : fatigue === 3 ? 1 : fatigue === 4 ? 1.08 : 1.15;
}

function logStimulus(log: WorkoutLog) {
  const block = blockFromLog(log);
  if (!block) return null;
  const profile = trainingProfileForBlock(block);
  const units = performedUnits(log);
  if (!units) return null;
  const quality = qualityFactor(log);
  const proximity = proximityFactor(log);
  const effectiveUnits = units * (profile.effectiveSetWeight || 1);
  return {
    profile,
    units,
    skill: effectiveUnits * profile.stimulus.skill * quality,
    strength: effectiveUnits * profile.stimulus.strength * quality,
    hypertrophy: effectiveUnits * profile.stimulus.hypertrophy * quality * proximity,
    endurance: effectiveUnits * profile.stimulus.endurance * quality,
    power: effectiveUnits * profile.stimulus.power * quality,
    fatigue: effectiveUnits * profile.fatigueCost * fatigueFactor(log),
  };
}

export function weeklyStimulusActual(sessions: SessionSummary[], now = Date.now()): WeeklyStimulusSnapshot {
  const start = now - 7 * 86400000;
  const recent = sessions.filter(s=>s.date>=start && s.date<=now);
  const actual:Record<TrainingAdaptation,number> = {skill:0,strength:0,hypertrophy:0,endurance:0,power:0};
  const muscle = Object.fromEntries(WORKLOAD_MUSCLES.map(m=>[m,{productiveSets:0,adjustedStimulus:0,exposures:0}])) as Record<MuscleGroup,{productiveSets:number; adjustedStimulus:number; exposures:number}>;
  const fatigue = { value:0 };
  for (const m of WORKLOAD_MUSCLES) muscle[m] = {productiveSets:0,adjustedStimulus:0,exposures:0};
  for (const session of recent) {
    for (const log of session.logs) {
      const x = logStimulus(log);
      if (!x) continue;
      actual.skill += x.skill; actual.strength += x.strength; actual.hypertrophy += x.hypertrophy; actual.endurance += x.endurance; actual.power += x.power; fatigue.value += x.fatigue;
      for (const m of x.profile.muscleGroups) {
        const cell = muscle[m] || (muscle[m] = {productiveSets:0,adjustedStimulus:0,exposures:0});
        cell.productiveSets += x.units * x.profile.stimulus.hypertrophy * qualityFactor(log) * proximityFactor(log);
        cell.adjustedStimulus += x.hypertrophy;
        cell.exposures += 1;
      }
    }
  }
  const adaptations = {} as Record<TrainingAdaptation, AdaptationBudgetSnapshot>;
  for (const a of ADAPTATIONS) {
    const value = round(actual[a]);
    adaptations[a] = {target:0, actual:value, attainmentPct:0};
  }
  const hypertrophyByMuscle = {} as Record<MuscleGroup, MuscleHypertrophySnapshot>;
  for (const m of WORKLOAD_MUSCLES) {
    const x = muscle[m];
    const sets = round(x.productiveSets);
    hypertrophyByMuscle[m] = {muscle:m,productiveSets:sets,adjustedStimulus:round(x.adjustedStimulus),exposures:x.exposures,status:sets<4?'LOW':sets>14?'HIGH':'ADEQUATE'};
  }
  return {adaptations, hypertrophyByMuscle, totalFatigue:round(fatigue.value)};
}

export function compareStimulusToBudget(actual: WeeklyStimulusSnapshot, target: Record<TrainingAdaptation,number>): WeeklyStimulusSnapshot {
  const adaptations = {} as Record<TrainingAdaptation, AdaptationBudgetSnapshot>;
  for (const a of ADAPTATIONS) {
    const t = Math.max(0, target[a] || 0);
    const aVal = actual.adaptations[a].actual;
    adaptations[a] = {target:round(t), actual:aVal, attainmentPct:t>0?round(clamp((aVal/t)*100,0,200)):100};
  }
  return {...actual, adaptations};
}

export function adaptiveDecision(
  actual: WeeklyStimulusSnapshot,
  primaryAdaptation: TrainingAdaptation,
  fatigueBudget: number,
  currentPhaseIsDeload = false,
): AdaptiveDecision {
  const reasons:string[] = [];
  if (currentPhaseIsDeload) return {action:'DELOAD',priority:'HIGH',reasons:['Fase di scarico: ridurre il volume e preservare la qualità.']};
  if (actual.totalFatigue > fatigueBudget * 1.08) {
    return {action:'REDUCE_SECONDARY',priority:'HIGH',reasons:[`Fatica stimata ${round(actual.totalFatigue)} oltre il budget ${round(fatigueBudget)}: proteggi il lavoro prioritario e riduci prima gli accessori.`]};
  }
  const primary = actual.adaptations[primaryAdaptation];
  const underHypertrophy = Object.values(actual.hypertrophyByMuscle).filter(x=>x.status==='LOW').slice(0,3);
  if (underHypertrophy.length) {
    reasons.push(`Volume ipertrofico basso per: ${underHypertrophy.map(x=>x.muscle.replaceAll('_',' ')).join(', ')}.`);
  }
  if (primary.attainmentPct < 80) reasons.push(`Lo stimolo prioritario (${primaryAdaptation}) è sotto il target (${primary.attainmentPct.toFixed(0)}%).`);
  if (primary.attainmentPct >= 95 && actual.totalFatigue <= fatigueBudget) {
    if (underHypertrophy.length) return {action:'ADD_HYPERTROPHY',priority:'MEDIUM',reasons:[...reasons,'Lo stimolo prioritario è adeguato: meglio investire il margine nel volume ipertrofico mancante.']};
    return {action:'PROGRESS_PRIMARY',priority:'LOW',reasons:['Lo stimolo prioritario è adeguato e la fatica resta entro il budget.']};
  }
  if (reasons.length) return {action:'HOLD',priority:'MEDIUM',reasons};
  return {action:'HOLD',priority:'LOW',reasons:['Mantieni il piano: non ci sono evidenze sufficienti per cambiare la dose.']};
}


/** Converts phase weights into internal relative targets. These are product heuristics,
 * not physiological units; they exist only to compare the current week with the plan. */
export function phaseStimulusTarget(phase:{adaptationWeights:{skill:number;strength:number;hypertrophy:number;endurance:number;power?:number}}):Record<TrainingAdaptation,number>{
  const w=phase.adaptationWeights;
  return {
    skill:Math.max(1,w.skill*20),
    strength:Math.max(1,w.strength*20),
    hypertrophy:Math.max(1,w.hypertrophy*50),
    endurance:Math.max(1,w.endurance*20),
    power:Math.max(0,(w.power||0)*10),
  };
}
