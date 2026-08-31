import type {CoachProposal,ExerciseBlock,ProgressionCriteria,SessionSummary,WorkoutLog} from "./types";
import {
  criteriaForBlock,
  decideExposure,
  evaluateProgression,
  nextTargetFromSpec,
  progressionSpecForBlock,
  parseTargetRange,
} from "./coachingEngine";

export type CoachAction = "PROGRESS"|"HOLD"|"REGRESS"|"REDUCE_VOLUME"|"REVIEW";

export interface CoachCoreInput {
  session:SessionSummary;
  blocks:ExerciseBlock[];
  history:SessionSummary[];
  referenceWeightKg?:number;
}

export interface CoachExerciseAnalysis {
  exerciseId:string;
  variantId:string;
  variantName:string;
  action:CoachAction;
  confidence:number;
  qualifies:boolean;
  streak:number;
  requiredStreak:number;
  comparableExposures:number;
  performanceBand:string;
  reasons:string[];
  currentTarget:string;
  proposedTarget?:string;
  proposal?:Omit<CoachProposal,"id"|"date"|"status">;
}

export interface CoachCoreResult {
  sessionId:string;
  analyses:CoachExerciseAnalysis[];
  proposals:CoachExerciseAnalysis["proposal"][];
}

const sameVariant=(a:WorkoutLog,b:WorkoutLog)=>
  a.exerciseId===b.exerciseId &&
  String(a.variantId||a.exerciseId)===String(b.variantId||b.exerciseId);

const comparable=(a:WorkoutLog,b:WorkoutLog)=>
  sameVariant(a,b) &&
  a.status==="complete" &&
  b.status==="complete" &&
  (!a.prescription || !b.prescription || (
    String(a.prescription.targetRange||"")===String(b.prescription.targetRange||"") &&
    (a.prescription.sets??null)===(b.prescription.sets??null) &&
    (a.prescription.minutes??null)===(b.prescription.minutes??null) &&
    (a.prescription.restSec??null)===(b.prescription.restSec??null) &&
    String(a.prescription.kind||"")===String(b.prescription.kind||"")
  ));

function flattenLogs(sessions:SessionSummary[]):WorkoutLog[]{
  return sessions.flatMap(s=>s.logs||[]).sort((a,b)=>a.date-b.date);
}

function blockForLog(log:WorkoutLog,blocks:ExerciseBlock[]):ExerciseBlock|undefined{
  return blocks.find(b=>b.id===log.exerciseId || b.catalogExerciseId===log.exerciseId);
}

function priorComparableLogs(log:WorkoutLog,history:SessionSummary[]):WorkoutLog[]{
  return flattenLogs(history)
    .filter(x=>x.date<log.date && comparable(log,x))
    .sort((a,b)=>a.date-b.date);
}

function qualifyingStreak(block:ExerciseBlock,log:WorkoutLog,history:SessionSummary[],criteria:ProgressionCriteria,referenceWeightKg?:number){
  const sequence=[...priorComparableLogs(log,history),log].sort((a,b)=>a.date-b.date);
  let streak=0;
  for(let i=sequence.length-1;i>=0;i--){
    const evaluation=evaluateProgression(block,sequence[i],criteria,referenceWeightKg);
    if(!evaluation.qualifies)break;
    streak++;
    if(streak>=(criteria.consecutiveSessions||1))break;
  }
  return streak;
}

function evidence(log:WorkoutLog,streak:number,required:number):{label:string;value:string}[]{
  const values=log.result.emom?.length
    ? `EMOM ${log.result.emom.join("/")}`
    : log.result.seconds?.length
      ? `holds ${log.result.seconds.map(v=>v.toFixed(1)).join("/")}s`
      : log.result.reps?.length
        ? `sets ${log.result.reps.join("/")}`
        : "no numeric output";
  return [
    {label:"Performance",value:values},
    ...(log.result.rir!==undefined?[{label:"RIR",value:String(log.result.rir)}]:[]),
    ...(log.result.fatigue!==undefined?[{label:"Fatigue",value:`${log.result.fatigue}/5`}]:[]),
    {label:"Comparable streak",value:`${streak}/${required}`},
  ];
}

function makeProgressProposal(block:ExerciseBlock,log:WorkoutLog,analysis:{streak:number;required:number;confidence:number;reasons:string[]}):CoachExerciseAnalysis["proposal"]{
  const spec=progressionSpecForBlock(block);
  const current=log.prescription?.targetRange||block.target;
  const next=nextTargetFromSpec(current,spec,block.kind);
  if(next===current)return undefined;
  return {
    type:"target",
    exerciseId:block.id,
    variantId:String(log.variantId||block.id),
    title:`Progress ${block.name}`,
    detail:`Raise the target from ${current} to ${next} after ${analysis.streak} comparable qualifying exposures.`,
    from:current,
    to:next,
    reason:analysis.reasons.join(" "),
    sessionId:log.sessionId,
    confidenceLevel:analysis.confidence>=90?"HIGH":analysis.confidence>=75?"MEDIUM":"LOW",
    evidence:evidence(log,analysis.streak,analysis.required),
    warnings:[],
    oldValue:current,
    newValue:next,
  };
}

function makeRecoveryProposal(block:ExerciseBlock,log:WorkoutLog,action:CoachAction,confidence:number,reasons:string[]):CoachExerciseAnalysis["proposal"]{
  if(action!=="REDUCE_VOLUME"&&action!=="REGRESS")return undefined;
  const current=log.prescription?.targetRange||block.target;
  return {
    type:"program_review",
    exerciseId:block.id,
    variantId:String(log.variantId||block.id),
    title:action==="REGRESS"?`Review regression: ${block.name}`:`Reduce volume: ${block.name}`,
    detail:action==="REGRESS"
      ? `Do not progress ${block.name}. Review the variant/load before the next exposure.`
      : `Consolidate ${block.name} and reduce secondary work before the next exposure.`,
    from:current,
    to:action,
    reason:reasons.join(" "),
    sessionId:log.sessionId,
    confidenceLevel:confidence>=90?"HIGH":confidence>=75?"MEDIUM":"LOW",
    evidence:evidence(log,0,0),
    warnings:["Review required: this proposal does not auto-change the program."],
    oldValue:current,
    newValue:action,
  };
}

/**
 * Phase 3 deterministic decision layer.
 * It consumes completed workout data and emits proposals only; it never mutates
 * program overrides, targets, variants, or historical logs.
 */
export function runCoachCore(input:CoachCoreInput):CoachCoreResult{
  const sessionLogs=input.session.logs||[];
  const analyses:CoachExerciseAnalysis[]=[];

  for(const log of sessionLogs){
    const block=blockForLog(log,input.blocks);
    if(!block)continue;

    const criteria=criteriaForBlock(block);
    const evaluation=decideExposure(block,log,criteria);
    const progression=evaluateProgression(block,log,criteria,input.referenceWeightKg);
    const prior=priorComparableLogs(log,input.history);
    const required=criteria.consecutiveSessions||1;
    const streak=progression.qualifies?qualifyingStreak(block,log,input.history,criteria,input.referenceWeightKg):0;
    const currentTarget=log.prescription?.targetRange||block.target;
    const reasons=[...evaluation.reasons];

    let action:CoachAction=evaluation.decision;
    let proposal:CoachExerciseAnalysis["proposal"];

    if(evaluation.decision==="PROGRESS"){
      if(streak>=required){
        proposal=makeProgressProposal(block,log,{streak,required,confidence:evaluation.confidence,reasons});
        if(!proposal){
          reasons.push("Performance qualifies, but no safe target increment is registered for this exercise.");
          action="HOLD";
        }
      }else{
        action="HOLD";
        reasons.push(`Current exposure qualifies, but the gate is ${streak}/${required} comparable exposures.`);
      }
    }else if(evaluation.decision==="REDUCE_VOLUME"||evaluation.decision==="REGRESS"){
      proposal=makeRecoveryProposal(block,log,evaluation.decision,evaluation.confidence,reasons);
    }

    analyses.push({
      exerciseId:block.id,
      variantId:String(log.variantId||block.id),
      variantName:log.variantName||log.exerciseName,
      action,
      confidence:evaluation.confidence,
      qualifies:progression.qualifies,
      streak,
      requiredStreak:required,
      comparableExposures:prior.length,
      performanceBand:evaluation.performanceBand,
      reasons,
      currentTarget,
      proposedTarget:proposal?.newValue,
      proposal,
    });
  }

  return {sessionId:input.session.id,analyses,proposals:analyses.map(x=>x.proposal).filter(Boolean)};
}

export function summarizeCoachCore(result:CoachCoreResult):string{
  if(!result.analyses.length)return "No coachable completed exposures in this session.";
  return result.analyses.map(a=>{
    const target=a.proposedTarget?` → ${a.proposedTarget}`:"";
    return `${a.variantName}: ${a.action}${target} · confidence ${a.confidence}% · gate ${a.streak}/${a.requiredStreak}`;
  }).join("\n");
}

export function isSafeProgressionProposal(proposal:CoachExerciseAnalysis["proposal"]):boolean{
  if(!proposal||proposal.type!=="target")return false;
  const from=parseTargetRange(proposal.from);
  const to=parseTargetRange(proposal.to);
  return to.max>from.max && to.min>from.min;
}
