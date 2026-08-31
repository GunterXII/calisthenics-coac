import type { CoachContext } from './coachAdvisorEngine';
import type { ExerciseBlock, GoalId, MuscleGroup } from './types';
import { buildAdaptivePeriodizedDay } from './adaptiveProgramEngine';
import { trainingProfileForBlock } from './trainingModel';
import { weeklyStimulusActual, phaseStimulusTarget } from './adaptiveStimulusEngine';
import { weeklyWorkload } from './workloadEngine';
import { getProgramOverrides } from './storage';

export type ImpactAction = 'ADD_SET'|'REMOVE_SET'|'CHANGE_TARGET'|'CHANGE_MINUTES'|'CHANGE_VARIANT';
export type GoalProtectionStatus = 'PROTECTED'|'WATCH'|'INTERFERENCE';
export interface GoalProtection {
  goalId: GoalId;
  label: string;
  status: GoalProtectionStatus;
  reason: string;
}

export interface ProgramImpact {
  day: string;
  exerciseId: string;
  before: { sets?: number; target: string; minutes?: number; fatigue: number; hypertrophy: number; muscleGroups: MuscleGroup[] };
  after: { sets?: number; target: string; minutes?: number; fatigue: number; hypertrophy: number; muscleGroups: MuscleGroup[] };
  delta: { fatigue: number; hypertrophy: number; primaryStimulus?: number };
  weekly: {
    fatigue: number;
    fatigueBudget: number;
    fatigueUtilizationPct: number;
    primaryAttainmentPct: number;
    hypertrophyLowMuscles: MuscleGroup[];
    projectedHypertrophyByMuscle: Partial<Record<MuscleGroup, number>>;
  };
  goalProtection: GoalProtection[];
  verdict: 'LOW_IMPACT'|'WATCH'|'HIGH_IMPACT';
  warnings: string[];
}

const GOALS: Array<{id:GoalId;label:string;muscles:MuscleGroup[]}> = [
  {id:'oap',label:'OAP',muscles:['lats','upper_back','biceps','forearms','core']},
  {id:'flpu',label:'Front Lever Pull-Up',muscles:['lats','upper_back','biceps','forearms','core']},
  {id:'front_lever_touch',label:'Front Lever Touch',muscles:['lats','upper_back','forearms','core']},
  {id:'pushups',label:'Push-ups',muscles:['chest','triceps','front_delts']},
  {id:'dips',label:'Dips',muscles:['chest','triceps','front_delts']},
];

function resolveDay(context: CoachContext, exerciseId: string){
  const found = context.sessions.find(s=>s.logs.some(l=>l.exerciseId===exerciseId));
  return found?.day || 'Monday';
}

function applyChange(block: ExerciseBlock, action: ImpactAction, value: number | string): ExerciseBlock {
  const next = { ...block };
  if(action==='ADD_SET') next.sets=Math.max(1,(block.sets||1)+Number(value));
  else if(action==='REMOVE_SET') next.sets=Math.max(1,(block.sets||1)-Number(value));
  else if(action==='CHANGE_MINUTES' && block.kind==='EMOM') next.minutes=Math.max(5,Math.min(15,Number(value)));
  else if(action==='CHANGE_TARGET') next.target=String(value);
  else if(action==='CHANGE_VARIANT') next.name=String(value);
  return next;
}

function effectiveWeeklyBlocks(context: CoachContext, day: string){
  return buildAdaptivePeriodizedDay(context.phase, day as any, ['oap','flpu','front_lever_touch','pushups','dips'], context.sessions).program.blocks;
}

function goalProtection(context: CoachContext, muscleGroups: MuscleGroup[], fatigueDelta: number): GoalProtection[] {
  return GOALS.map(goal => {
    const overlap = goal.muscles.filter(m => muscleGroups.includes(m));
    const readiness = context.skillReadiness?.find(x => x.goalId === goal.id);
    const poorRecovery = readiness ? !readiness.recoveryOk : false;
    if (!overlap.length && fatigueDelta <= 2) return { goalId:goal.id, label:goal.label, status:'PROTECTED', reason:`Nessun overlap muscolare diretto con ${goal.label} e costo di fatica contenuto.` };
    if (poorRecovery || fatigueDelta >= 4) return { goalId:goal.id, label:goal.label, status:'INTERFERENCE', reason:`Possibile interferenza con ${goal.label}: overlap ${overlap.join(', ') || 'sistemico'} e segnali di recupero/fatica da proteggere.` };
    return { goalId:goal.id, label:goal.label, status:'WATCH', reason:`${goal.label}: overlap ${overlap.join(', ')}; mantenere la qualità della skill e rivalutare al prossimo exposure.` };
  });
}

export function simulateProgramImpact(context: CoachContext, exerciseId: string, action: ImpactAction, value: number|string): ProgramImpact | null {
  const day=resolveDay(context,exerciseId);
  const blocks=effectiveWeeklyBlocks(context,day);
  const overrides=getProgramOverrides();
  const base=blocks.find(b=>b.id===exerciseId);
  if(!base) return null;
  const effective={...base,...(overrides[exerciseId]||{})};
  const after=applyChange(effective,action,value);
  const beforeProfile=trainingProfileForBlock(effective);
  const afterProfile=trainingProfileForBlock(after);
  const beforeSets=Math.max(1,effective.sets||1);
  const afterSets=Math.max(1,after.sets||1);
  const setDelta=afterSets-beforeSets;
  const minuteDelta=(action==='CHANGE_MINUTES' && effective.kind==='EMOM')
    ? Number(after.minutes||0)-Number(effective.minutes||0)
    : 0;
  const effectiveDoseDelta = setDelta || (minuteDelta * 0.75);
  const fatigueDelta=effectiveDoseDelta*(afterProfile.fatigueCost||effective.fatigueCost||1);
  const hypertrophyDelta=effectiveDoseDelta*(afterProfile.effectiveSetWeight||1)*(afterProfile.stimulus.hypertrophy||0);
  const actual=weeklyStimulusActual(context.sessions);
  const targets=phaseStimulusTarget(context.phase);
  const primary= context.phase.type==='ENDURANCE_EMPHASIS' ? 'endurance' : (context.phase.type==='ACCUMULATION' ? 'hypertrophy' : 'skill');
  const currentFatigue=actual.totalFatigue;
  const projectedFatigue=Math.max(0,currentFatigue+fatigueDelta);
  const utilization=projectedFatigue/Math.max(1,context.phase.fatigueBudget)*100;
  const projectedPrimary=actual.adaptations[primary].actual + effectiveDoseDelta*(afterProfile.effectiveSetWeight||1)*(afterProfile.stimulus[primary]||0);
  const target=targets[primary]||1;
  const attainment=Math.min(200,(projectedPrimary/target)*100);
  const low=Object.values(actual.hypertrophyByMuscle).filter(x=>x.status==='LOW').map(x=>x.muscle).filter(Boolean) as MuscleGroup[];
  const projectedHypertrophyByMuscle:Partial<Record<MuscleGroup,number>>={};
  for (const m of beforeProfile.muscleGroups) {
    const before = actual.hypertrophyByMuscle[m]?.productiveSets || 0;
    projectedHypertrophyByMuscle[m] = Number((before + effectiveDoseDelta*(afterProfile.effectiveSetWeight||1)*(afterProfile.stimulus.hypertrophy||0)).toFixed(2));
  }
  const warnings:string[]=[];
  if(utilization>108) warnings.push('La modifica porterebbe il carico di fatica oltre il budget settimanale.');
  if(utilization>95&&utilization<=108) warnings.push('Il budget di fatica diventerebbe quasi pieno: evita altre aggiunte nella stessa seduta.');
  if((action==='ADD_SET' || action==='CHANGE_MINUTES') && base.priority==='primary') warnings.push('Stai modificando un blocco prioritario: la progressione deve essere sostenuta da performance e tecnica stabili.');
  if(low.length && action==='ADD_SET' && beforeProfile.stimulus.hypertrophy>0) warnings.push(`La modifica aumenta lo stimolo per ${beforeProfile.muscleGroups.join(', ')}.`);
  let verdict:'LOW_IMPACT'|'WATCH'|'HIGH_IMPACT'='LOW_IMPACT';
  if(utilization>108 || fatigueDelta>=5) verdict='HIGH_IMPACT';
  else if(utilization>95 || Math.abs(fatigueDelta)>=2) verdict='WATCH';
  const protection=goalProtection(context, beforeProfile.muscleGroups, fatigueDelta);
  if(protection.some(x=>x.status==='INTERFERENCE')) verdict='HIGH_IMPACT';
  else if(protection.some(x=>x.status==='WATCH') && verdict==='LOW_IMPACT') verdict='WATCH';
  return {
    day, exerciseId,
    before:{sets:effective.sets,target:effective.target,minutes:effective.minutes,fatigue:beforeProfile.fatigueCost,hypertrophy:beforeProfile.stimulus.hypertrophy,muscleGroups:beforeProfile.muscleGroups},
    after:{sets:after.sets,target:after.target,minutes:after.minutes,fatigue:afterProfile.fatigueCost,hypertrophy:afterProfile.stimulus.hypertrophy,muscleGroups:afterProfile.muscleGroups},
    delta:{fatigue:Number(fatigueDelta.toFixed(2)),hypertrophy:Number(hypertrophyDelta.toFixed(2)),primaryStimulus:Number((projectedPrimary-actual.adaptations[primary].actual).toFixed(2))},
    weekly:{fatigue:Number(projectedFatigue.toFixed(2)),fatigueBudget:context.phase.fatigueBudget,fatigueUtilizationPct:Number(utilization.toFixed(1)),primaryAttainmentPct:Number(attainment.toFixed(1)),hypertrophyLowMuscles:low,projectedHypertrophyByMuscle},
    goalProtection:protection,
    verdict,warnings,
  };
}
