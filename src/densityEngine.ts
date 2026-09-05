import type {ExerciseBlock, SessionSummary, WorkoutLog} from './types';

function cleanLongSetReps(log:WorkoutLog):number|undefined{
  if(log.status!=="complete"||log.skipped)return undefined;
  const values=log.result.reps||[];
  if(values.length!==1)return undefined;
  const reps=Number(values[0]);
  if(!Number.isFinite(reps)||reps<=0)return undefined;
  const quality=log.result.quality||[];
  if(quality.length>0 && quality.some(q=>q!=="Clean"))return undefined;
  return reps;
}

export function densityReferenceMax(block:ExerciseBlock,sessions:SessionSummary[]):number{
  const protocol=block.densityProtocol;
  if(!protocol)return 0;
  const referenceId=protocol.referenceExerciseId;
  if(!referenceId)return Math.max(1,Math.round(protocol.referenceMaxReps||1));
  const values=sessions
    .flatMap(s=>s.logs||[])
    .filter(log=>log.exerciseId===referenceId)
    .map(cleanLongSetReps)
    .filter((value):value is number=>value!==undefined);
  return Math.max(1,Math.max(...values,protocol.referenceMaxReps||1));
}

export function densityTargetReps(block:ExerciseBlock,sessions:SessionSummary[]):number{
  const protocol=block.densityProtocol;
  if(!protocol)return 1;
  return Math.max(1,Math.floor(densityReferenceMax(block,sessions)*protocol.referenceMaxFraction + 0.500000001));
}

export function densityTargetRange(block:ExerciseBlock,sessions:SessionSummary[]):string{
  const target=densityTargetReps(block,sessions);
  return `${target}–${target}`;
}

export function resolveDensityPrescription(block:ExerciseBlock,sessions:SessionSummary[]):ExerciseBlock{
  if(block.trainingMethod!=="DENSITY_5X70"||!block.densityProtocol)return block;
  const protocol=block.densityProtocol;
  const target=densityTargetRange(block,sessions);
  const logs=sessions
    .flatMap(s=>s.logs||[])
    .filter(log=>log.exerciseId===block.id&&log.status==="complete"&&!log.skipped)
    .sort((a,b)=>b.date-a.date);
  const latest=logs[0];
  const sameTarget=String(latest?.prescription?.targetRange||"")===target;
  const rest=sameTarget && typeof latest?.prescription?.restSec==="number"
    ? Math.max(protocol.minRestSec,latest!.prescription!.restSec)
    : protocol.initialRestSec;
  return {
    ...block,
    sets:protocol.fixedSets,
    target,
    rest,
    detail:`${protocol.fixedSets} × ${Math.round(protocol.referenceMaxFraction*100)}% del massimale (${target} reps) · dose fissa · riduci il recupero solo quando la performance è stabile`,
  };
}
