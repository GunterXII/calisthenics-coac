import type {Band,BlockKind,ExerciseBlock,MuscleGroup,ProgressionMode,ProgramOverride,PrescriptionSnapshot} from "./types";

export interface TodayTargetState {
  value:number;
  updatedAt:number;
}

export interface PrescriptionTargetRange {
  min:number;
  max:number;
  suffix:string;
}

export interface EffectivePrescription {
  block:ExerciseBlock;
  targetRange:PrescriptionTargetRange;
  todayTarget?:number;
  programOverride?:ProgramOverride;
  targetSource:"PROGRAM_DEFAULT"|"TODAY_TARGET";
}

export interface PrescriptionCaptureOptions {
  todayTarget?:number;
  variantId?:string;
  variantName?:string;
  capturedAt?:number;
}

const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}

/** Parse the numeric part of the program target without making assumptions about unsupported prose targets. */
export function parsePrescriptionRange(target:string):PrescriptionTargetRange|undefined{
  const emom=target.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*\/min/i);
  if(emom)return {min:Number(emom[1]),max:Number(emom[2]),suffix:"/min"};

  const range=target.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(range){
    return {min:Number(range[1]),max:Number(range[2]),suffix:target.replace(range[0],"").trim()};
  }

  const single=target.match(/(\d+(?:\.\d+)?)\s*(\/min|s|sec|reps?)?$/i);
  if(single)return {min:Number(single[1]),max:Number(single[1]),suffix:single[2]||""};
  return undefined;
}

function matchingOverride(block:ExerciseBlock,overrides:Record<string,ProgramOverride>):ProgramOverride|undefined{
  const direct=overrides[block.id];
  if(direct)return direct;
  if(block.catalogExerciseId && overrides[block.catalogExerciseId])return overrides[block.catalogExerciseId];
  return undefined;
}

/** Apply only explicitly supplied override fields. The base block remains immutable. */
export function applyProgramOverride(block:ExerciseBlock,override?:ProgramOverride):ExerciseBlock{
  if(!override)return {...block};
  return {
    ...block,
    ...(override.name!==undefined?{name:override.name}:{}),
    ...(override.detail!==undefined?{detail:override.detail}:{}),
    ...(override.kind!==undefined?{kind:override.kind}:{}),
    ...(override.trainingRole!==undefined?{trainingRole:override.trainingRole}:{}),
    ...(override.priority!==undefined?{priority:override.priority}:{}),
    ...(override.progressionMode!==undefined?{progressionMode:override.progressionMode}:{}),
    ...(override.fatigueCost!==undefined?{fatigueCost:override.fatigueCost}:{}),
    ...(override.muscleGroups!==undefined?{muscleGroups:override.muscleGroups}:{}),
    ...(override.effectiveSetWeight!==undefined?{effectiveSetWeight:override.effectiveSetWeight}:{}),
    ...(override.gripDemand!==undefined?{gripDemand:override.gripDemand}:{}),
    ...(override.target!==undefined?{target:override.target}:{}),
    ...(override.sets!==undefined?{sets:override.sets}:{}),
    ...(override.rest!==undefined?{rest:override.rest}:{}),
    ...(override.minutes!==undefined?{minutes:override.minutes}:{}),
    ...(override.bandOptions!==undefined?{bandOptions:override.bandOptions}:{}),
    ...(override.defaultBand!==undefined?{defaultBand:override.defaultBand}:{}),
  };
}

/**
 * Resolve the prescription shown for a future exposure.
 * A program override is authoritative over an older today-target value.
 */
export function resolveEffectivePrescription(
  block:ExerciseBlock,
  overrides:Record<string,ProgramOverride>={},
  todayTarget?:TodayTargetState,
):EffectivePrescription{
  const programOverride=matchingOverride(block,overrides);
  const effectiveBlock=applyProgramOverride(block,programOverride);
  const targetRange=parsePrescriptionRange(effectiveBlock.target);
  if(!targetRange)return {block:effectiveBlock,targetRange:{min:0,max:0,suffix:""},programOverride,targetSource:"PROGRAM_DEFAULT"};

  const programUpdatedAt=programOverride?.updatedAt||0;
  const usableTodayTarget=todayTarget && finite(todayTarget.value) && todayTarget.updatedAt>=programUpdatedAt
    ? clamp(todayTarget.value,targetRange.min,targetRange.max)
    : undefined;

  return {
    block:effectiveBlock,
    targetRange,
    todayTarget:usableTodayTarget,
    programOverride,
    targetSource:usableTodayTarget===undefined?"PROGRAM_DEFAULT":"TODAY_TARGET",
  };
}

/**
 * Snapshot the exact prescription that was presented to the athlete.
 * This is intentionally independent from later program changes.
 */
export function capturePrescriptionSnapshot(
  block:ExerciseBlock,
  options:PrescriptionCaptureOptions={}
):PrescriptionSnapshot{
  const variantId=options.variantId||block.id;
  const variantName=options.variantName||block.name;
  return {
    version:1,
    exerciseId:block.catalogExerciseId||block.id,
    variantId,
    variantName,
    name:block.name,
    kind:block.kind,
    targetRange:block.target,
    todayTarget:options.todayTarget,
    sets:block.sets,
    minutes:block.minutes,
    restSec:Math.max(0,block.rest||0),
    bandOptions:block.bandOptions,
    defaultBand:block.defaultBand,
    progressionMode:block.progressionMode,
    fatigueCost:block.fatigueCost,
    muscleGroups:block.muscleGroups,
    effectiveSetWeight:block.effectiveSetWeight,
    gripDemand:block.gripDemand,
    capturedAt:options.capturedAt??Date.now(),
  };
}

/** Preserve an already executed variant when attaching a historical snapshot. */
export function captureHistoricalPrescription(
  block:ExerciseBlock,
  executedVariant:{id?:string;name?:string},
  todayTarget?:number,
  capturedAt?:number,
):PrescriptionSnapshot{
  return capturePrescriptionSnapshot(block,{
    todayTarget,
    variantId:executedVariant.id||block.id,
    variantName:executedVariant.name||block.name,
    capturedAt,
  });
}

export function isTodayTargetCurrent(todayTarget:TodayTargetState|undefined,programUpdatedAt:number):boolean{
  return Boolean(todayTarget && finite(todayTarget.value) && todayTarget.updatedAt>=programUpdatedAt);
}

/** Small normalization helper for consumers that need the explicit snapshot target. */
export function targetForSnapshot(effective:EffectivePrescription):number|undefined{
  return effective.todayTarget;
}

export type PrescriptionField="target"|"sets"|"minutes"|"rest"|"bandOptions"|"defaultBand";

export function prescriptionChanged(a:PrescriptionSnapshot|undefined,b:PrescriptionSnapshot|undefined):boolean{
  if(!a||!b)return Boolean(a||b);
  return a.exerciseId!==b.exerciseId||a.variantId!==b.variantId||a.targetRange!==b.targetRange||a.todayTarget!==b.todayTarget||a.sets!==b.sets||a.minutes!==b.minutes||a.restSec!==b.restSec||a.defaultBand!==b.defaultBand;
}

export function snapshotSummary(snapshot:PrescriptionSnapshot):string{
  const target=snapshot.todayTarget!==undefined?`${snapshot.todayTarget}${snapshot.kind==="EMOM"?"/min":""}`:snapshot.targetRange;
  const dose=snapshot.kind==="EMOM"?`${snapshot.minutes??10} min EMOM`:`${snapshot.sets??"?"} sets`;
  return `${dose} · target ${target} · ${snapshot.restSec}s rest`;
}

// Keep these imports visible to the TypeScript compiler when this module is used as a pure domain layer.
export type PrescriptionBlockKind=BlockKind;
export type PrescriptionBand=Band;
export type PrescriptionProgressionMode=ProgressionMode;
export type PrescriptionMuscleGroup=MuscleGroup;
