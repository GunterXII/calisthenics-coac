import type { GoalId, GoalState, SessionSummary, WorkoutLog, SidePerformance } from './types';
import { deriveGoalStatus } from './periodizationEngine';

export type GoalMetric = 'reps' | 'seconds';
export type GoalSignal = 'BUILD' | 'PROGRESSING' | 'PLATEAU' | 'REGRESSING' | 'REALIZED' | 'INSUFFICIENT_DATA';

export interface GoalDefinition {
  id: GoalId;
  label: string;
  target: number;
  metric: GoalMetric;
  unit: 'reps' | 'seconds';
  benchmarkExerciseIds: string[];
  description: string;
}

export interface GoalEvidence {
  date: number;
  value: number;
  qualityKnown: boolean;
  clean: boolean;
  exerciseId: string;
  exerciseName: string;
}

export interface GoalPerformanceSnapshot {
  goal: GoalDefinition;
  baseline: number;
  current: number;
  best: number;
  target: number;
  progressPct: number;
  trendPct: number;
  exposures: number;
  qualityCoveragePct: number;
  confidence: number;
  status: GoalState['status'];
  latestEvidence?: GoalEvidence;
  recentEvidence: GoalEvidence[];
  interpretation: string;
  repeatableBest: number;
  qualityAdjustedBest: number;
  recentMedian: number;
  sidePerformance?: SidePerformance;
}

export interface GoalDecisionSignal {
  goalId: GoalId;
  signal: GoalSignal;
  confidence: number;
  priorityScore: number;
  progressPct: number;
  trendPct: number;
  exposures: number;
  evidenceWindow: number;
  reasons: string[];
}

export const DEFAULT_GOAL_DEFINITIONS: readonly GoalDefinition[] = [
  { id: 'oap', label: 'OAP', target: 5, metric: 'reps', unit: 'reps', benchmarkExerciseIds: ['oap'], description: 'Best clean reps on the full One Arm Pull-up.' },
  { id: 'flpu', label: 'Front Lever Pull-up', target: 5, metric: 'reps', unit: 'reps', benchmarkExerciseIds: ['flpu'], description: 'Best clean reps on the full Front Lever Pull-up.' },
  { id: 'front_lever_touch', label: 'Front Lever Touch', target: 8, metric: 'seconds', unit: 'seconds', benchmarkExerciseIds: ['touch'], description: 'Best clean Front Lever Touch hold. A full Front Lever is a prerequisite/ability, not the end goal.' },
  { id: 'pushups', label: 'Push-ups', target: 100, metric: 'reps', unit: 'reps', benchmarkExerciseIds: ['pushup-long'], description: 'Best controlled single-set push-up performance.' },
  { id: 'dips', label: 'Dips', target: 50, metric: 'reps', unit: 'reps', benchmarkExerciseIds: ['dips-long'], description: 'Best controlled single-set dip performance.' },
];

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number,d=1)=>Number(n.toFixed(d));

function cleanSeries(log:WorkoutLog, metric:GoalMetric):GoalEvidence[] {
  if (log.status === 'skipped') return [];
  const values = metric === 'seconds' ? (log.result.seconds || []) : (log.result.reps || []);
  if (!values.length) return [];
  const quality = log.result.quality || [];
  return values
    .map((value,index)=>({ date: log.date, value: Number(value || 0), qualityKnown: quality.length > 0, clean: quality.length === 0 ? true : quality[index] !== 'Lost position', exerciseId: log.exerciseId, exerciseName: log.exerciseName }))
    .filter(x=>Number.isFinite(x.value) && x.value > 0 && x.clean);
}

function collectEvidence(goal:GoalDefinition, sessions:SessionSummary[]):GoalEvidence[] {
  const rows:GoalEvidence[] = [];
  for (const session of sessions) {
    for (const log of session.logs || []) {
      if (!goal.benchmarkExerciseIds.includes(log.exerciseId)) continue;
      if (goal.id === 'oap' && log.result.sides?.length && log.result.reps?.length) {
        const right:number[] = [], left:number[] = [];
        log.result.reps.forEach((value,index)=>{
          const side=log.result.sides?.[index];
          const q=log.result.quality?.[index];
          if (q==='Lost position') return;
          if (side==='R') right.push(Number(value)||0);
          if (side==='L') left.push(Number(value)||0);
        });
        if(right.length && left.length){
          const rightBest=Math.max(...right), leftBest=Math.max(...left);
          const value=Math.min(rightBest,leftBest);
          if(value>0) rows.push({date:log.date,value,qualityKnown:Boolean(log.result.quality?.length),clean:true,exerciseId:log.exerciseId,exerciseName:log.exerciseName});
          continue;
        }
      }
      rows.push(...cleanSeries(log, goal.metric));
    }
  }
  return rows.sort((a,b)=>a.date-b.date);
}

function trendPct(values:GoalEvidence[]):number {
  if (values.length < 2) return 0;
  const recent = values.slice(-3).map(x=>x.value);
  const older = values.slice(Math.max(0, values.length - 6), Math.max(1, values.length - 3)).map(x=>x.value);
  if (!older.length) return 0;
  const avg = (xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const oldAvg = avg(older), newAvg = avg(recent);
  if (oldAvg <= 0) return 0;
  return round(((newAvg-oldAvg)/oldAvg)*100,1);
}

function median(xs:number[]):number {
  if(!xs.length) return 0;
  const ys=xs.slice().sort((a,b)=>a-b);
  const m=Math.floor(ys.length/2);
  return ys.length%2 ? ys[m] : (ys[m-1]+ys[m])/2;
}

function repeatableBest(values:GoalEvidence[]):number {
  if(!values.length) return 0;
  const recent=values.slice(-6).map(x=>x.value);
  if(recent.length<2) return recent[0]||0;
  const sorted=recent.slice().sort((a,b)=>b-a);
  const top=Math.max(1, Math.ceil(recent.length*0.5));
  return sorted.slice(0,top).reduce((a,b)=>a+b,0)/top;
}

function qualityAdjustedBest(values:GoalEvidence[]):number {
  if(!values.length) return 0;
  return Math.max(...values.map(x=>x.value*(x.qualityKnown ? (x.clean ? 1 : 0.95) : 0.95)));
}

export function sidePerformanceForOap(sessions:SessionSummary[]):SidePerformance|undefined {
  const logs=sessions.flatMap(s=>s.logs||[]).filter(l=>l.exerciseId==='oap'&&l.status==='complete'&&l.result.sides?.length&&l.result.reps?.length);
  if(!logs.length) return undefined;
  let rightBest=0,leftBest=0,rightQualifying=0,leftQualifying=0;
  for(const log of logs){
    log.result.reps!.forEach((r,i)=>{
      if(log.result.quality?.[i]==='Lost position') return;
      const side=log.result.sides?.[i];
      if(side==='R'){rightBest=Math.max(rightBest,r);rightQualifying+=r>0?1:0;}
      if(side==='L'){leftBest=Math.max(leftBest,r);leftQualifying+=r>0?1:0;}
    });
  }
  return {rightBest,leftBest,rightQualifying,leftQualifying,balanced:rightBest===leftBest};
}

function goalDefinitionFor(id:GoalId, definitions:readonly GoalDefinition[]=DEFAULT_GOAL_DEFINITIONS):GoalDefinition {
  return definitions.find(x=>x.id===id) || DEFAULT_GOAL_DEFINITIONS[0];
}

export function analyzeGoal(id:GoalId, sessions:SessionSummary[], definitions:readonly GoalDefinition[]=DEFAULT_GOAL_DEFINITIONS):GoalPerformanceSnapshot {
  const goal = goalDefinitionFor(id, definitions);
  const evidence = collectEvidence(goal, sessions.filter(s=>Number.isFinite(s.date)).sort((a,b)=>a.date-b.date));
  const best = evidence.length ? Math.max(...evidence.map(x=>x.value)) : 0;
  const repeatable = repeatableBest(evidence);
  const qualityAdjusted = qualityAdjustedBest(evidence);
  const recentMedian = median(evidence.slice(-6).map(x=>x.value));
  const current = evidence.length ? evidence[evidence.length-1].value : 0;
  const baseline = evidence.length ? evidence[0].value : 0;
  const progressPct = baseline >= goal.target && baseline > 0 ? 100 : baseline > 0 && goal.target > baseline ? clamp(((best-baseline)/(goal.target-baseline))*100,0,100) : best >= goal.target ? 100 : 0;
  const qualityKnownCount = evidence.filter(x=>x.qualityKnown).length;
  const qualityCoveragePct = evidence.length ? round((qualityKnownCount/evidence.length)*100,0) : 0;
  const trend = trendPct(evidence);
  const confidence = clamp(round(Math.min(1, evidence.length/6) * (0.65 + 0.35*(qualityCoveragePct/100)),2),0,1);
  const goalState = deriveGoalStatus({ id, baseline, current:best, target:goal.target, trend:trend/100, confidence, status:'BUILDING' });
  let interpretation = 'Not enough benchmark evidence yet.';
  if (best >= goal.target) interpretation = 'Target reached. Keep periodic exposures while most training remains submaximal.';
  else if (trend >= 5) interpretation = 'Recent benchmark performance is moving up.';
  else if (trend <= -8) interpretation = 'Recent benchmark performance is down; investigate fatigue, technique and recovery before adding difficulty.';
  else if (evidence.length >= 2) interpretation = 'Performance is broadly stable; build more high-quality evidence before forcing a change.';

  return { goal, baseline: round(baseline, goal.metric === 'seconds' ? 1 : 0), current: round(current, goal.metric === 'seconds' ? 1 : 0), best: round(best, goal.metric === 'seconds' ? 1 : 0), target: goal.target, progressPct: round(progressPct,1), trendPct: trend, exposures: evidence.length, qualityCoveragePct, confidence, status: goalState.status, latestEvidence: evidence[evidence.length-1], recentEvidence: evidence.slice(-6), interpretation, repeatableBest: round(repeatable, goal.metric === 'seconds' ? 1 : 0), qualityAdjustedBest: round(qualityAdjusted, goal.metric === 'seconds' ? 1 : 0), recentMedian: round(recentMedian, goal.metric === 'seconds' ? 1 : 0), sidePerformance: goal.id==='oap' ? sidePerformanceForOap(sessions) : undefined };
}

export function analyzeAllGoals(sessions:SessionSummary[], definitions:readonly GoalDefinition[]=DEFAULT_GOAL_DEFINITIONS):GoalPerformanceSnapshot[] { return definitions.map(goal=>analyzeGoal(goal.id, sessions, definitions)); }

export function goalStateFromAnalytics(snapshot:GoalPerformanceSnapshot):GoalState {
  const repeatable = snapshot.repeatableBest || snapshot.best;
  const quality = snapshot.qualityAdjustedBest || repeatable;
  const programCurrent = snapshot.exposures >= 4 ? Math.min(repeatable, quality) : snapshot.best;
  return deriveGoalStatus({ id: snapshot.goal.id, baseline: snapshot.baseline, current: programCurrent, target: snapshot.target, trend: snapshot.trendPct/100, confidence: snapshot.confidence, repeatable, qualityAdjusted: quality, recentMedian: snapshot.recentMedian, status: snapshot.status });
}

/** Advisory signal for the Coach. It never changes the program or targets. */
export function goalDecisionSignal(snapshot:GoalPerformanceSnapshot):GoalDecisionSignal {
  const evidenceWindow=Math.min(6,snapshot.exposures);
  const reasons:string[]=[];
  let signal:GoalSignal='INSUFFICIENT_DATA';
  if(snapshot.best>=snapshot.target){ signal='REALIZED'; reasons.push('Benchmark target has been reached.'); }
  else if(snapshot.exposures<2){ signal='INSUFFICIENT_DATA'; reasons.push('At least two benchmark exposures are needed to interpret a trend.'); }
  else if(snapshot.trendPct<=-8){ signal='REGRESSING'; reasons.push('Recent benchmark performance is declining.'); reasons.push('Investigate fatigue, recovery and technique before increasing difficulty.'); }
  else if(snapshot.trendPct>=5){ signal='PROGRESSING'; reasons.push('Recent benchmark performance is improving.'); }
  else if(snapshot.exposures>=4){ signal='PLATEAU'; reasons.push('Performance is stable across a meaningful evidence window.'); reasons.push('Do not force progression from stability alone.'); }
  else { signal='BUILD'; reasons.push('Evidence is still developing; prioritize repeatable quality.'); }

  const gapPct=snapshot.target>0 ? clamp((snapshot.target-Math.max(snapshot.repeatableBest,snapshot.qualityAdjustedBest))/snapshot.target,0,1) : 0;
  const trendPressure=signal==='REGRESSING' ? 0.35 : signal==='PROGRESSING' ? 0.15 : signal==='PLATEAU' ? 0.10 : 0;
  const priorityScore=round(clamp(gapPct*0.65 + trendPressure + (1-snapshot.confidence)*0.20,0,1),2);
  return {goalId:snapshot.goal.id, signal, confidence:snapshot.confidence, priorityScore, progressPct:snapshot.progressPct, trendPct:snapshot.trendPct, exposures:snapshot.exposures, evidenceWindow, reasons};
}

export function prioritizeGoals(snapshots:GoalPerformanceSnapshot[]):GoalDecisionSignal[] { return snapshots.map(goalDecisionSignal).sort((a,b)=>b.priorityScore-a.priorityScore); }
