
import type { GoalId, PhasePlan, SessionSummary, WorkoutLog } from "./types";
import { analyzeAllGoals, type GoalPerformanceSnapshot } from "./goalAnalyticsEngine";
import { weeklyWorkload, type RecoveryStatus } from "./workloadEngine";
import { weeklyStimulusActual, compareStimulusToBudget, phaseStimulusTarget } from "./adaptiveStimulusEngine";
import { allSkillReadiness } from "./skillPerformanceEngine";
import { detectPlateaus } from "./plateauEngine";

export interface WeeklyGoalSignal {
  goalId: GoalId;
  label: string;
  status: GoalPerformanceSnapshot["status"];
  best: number;
  target: number;
  trendPct: number;
  weekBest: number;
  previousBest: number;
  delta: number;
  qualityCoveragePct: number;
  confidence: number;
  interpretation: string;
}

export interface WeeklyCoachAction {
  priority: "HIGH"|"MEDIUM"|"LOW";
  title: string;
  detail: string;
  exerciseId?: string;
}

export interface CoachWeeklyReport {
  start: number;
  end: number;
  phase?: { id:string; type:string; week:number; totalWeeks:number };
  sessions: number;
  plannedSessions: number;
  adherencePct: number;
  totalReps: number;
  totalEmomReps: number;
  totalAdjustedSets: number;
  totalFatigueLoad: number;
  averageRir?: number;
  averageFatigue?: number;
  effortCoveragePct: number;
  recoveryStatus: RecoveryStatus;
  headline: string;
  summary: string;
  wins: string[];
  concerns: string[];
  goals: WeeklyGoalSignal[];
  plateauCount: number;
  plateauSummary: string[];
  actions: WeeklyCoachAction[];
  stimulus: {
    primary?: string;
    primaryAttainmentPct?: number;
    totalFatigue: number;
    lowHypertrophyMuscles: string[];
  };
}

const round=(n:number,d=1)=>Number(n.toFixed(d));
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:undefined;

function weekBounds(end:number){ return {start:end-7*86400000,end}; }

function completedLogs(sessions:SessionSummary[]){
  return sessions.flatMap(s=>s.logs||[]).filter(l=>l.status==="complete"&&!l.skipped);
}

function valueForGoal(log:WorkoutLog,goal:GoalPerformanceSnapshot){
  if(!goal.goal.benchmarkExerciseIds.includes(log.exerciseId)) return [];
  return goal.goal.metric==="seconds"?(log.result.seconds||[]):(log.result.reps||[]);
}

function goalSignal(goal:GoalPerformanceSnapshot,weekSessions:SessionSummary[],previousSessions:SessionSummary[]):WeeklyGoalSignal{
  const weekValues=weekSessions.flatMap(s=>s.logs||[]).flatMap(log=>valueForGoal(log,goal)).filter(v=>Number.isFinite(v)&&v>0);
  const prevValues=previousSessions.flatMap(s=>s.logs||[]).flatMap(log=>valueForGoal(log,goal)).filter(v=>Number.isFinite(v)&&v>0);
  const weekBest=weekValues.length?Math.max(...weekValues):0;
  const previousBest=prevValues.length?Math.max(...prevValues):0;
  const delta=weekBest>0&&previousBest>0?round(weekBest-previousBest,goal.goal.metric==="seconds"?1:0):(weekBest||0);
  return {goalId:goal.goal.id,label:goal.goal.label,status:goal.status,best:goal.best,target:goal.target,trendPct:goal.trendPct,weekBest,previousBest,delta,qualityCoveragePct:goal.qualityCoveragePct,confidence:goal.confidence,interpretation:goal.interpretation};
}

function primaryAdaptation(phase?:PhasePlan):"skill"|"strength"|"hypertrophy"|"endurance"|"power"|undefined{
  if(!phase) return undefined;
  if(phase.type==="OAP_EMPHASIS"||phase.type==="FL_EMPHASIS") return "skill";
  if(phase.type==="ENDURANCE_EMPHASIS") return "endurance";
  if(phase.type==="REALIZATION") return "strength";
  return "hypertrophy";
}

export function buildCoachWeeklyReport(sessions:SessionSummary[],phase?:PhasePlan,end=Date.now()):CoachWeeklyReport{
  const bounds=weekBounds(end);
  const weekSessions=sessions.filter(s=>s.date>=bounds.start&&s.date<=bounds.end).sort((a,b)=>a.date-b.date);
  const previousSessions=sessions.filter(s=>s.date>=bounds.start-7*86400000&&s.date<bounds.start).sort((a,b)=>a.date-b.date);
  const allToEnd=sessions.filter(s=>s.date<=end);
  const logs=completedLogs(weekSessions);
  const goals=analyzeAllGoals(allToEnd);
  const goalSignals=goals.map(g=>goalSignal(g,weekSessions,previousSessions));
  const workload=weeklyWorkload(weekSessions,end);
  const stimulus=weeklyStimulusActual(weekSessions,end);
  const skill=allSkillReadiness(allToEnd);
  const primary=primaryAdaptation(phase);
  const compared=phase?compareStimulusToBudget(stimulus,phaseStimulusTarget(phase)):undefined;
  const plateaus=detectPlateaus(allToEnd).filter(signal=>{
    const hasWeekExposure=weekSessions.some(s=>s.logs.some(l=>l.exerciseId===signal.exerciseId&&l.status==="complete"&&!l.skipped));
    return hasWeekExposure;
  });

  const totalReps=weekSessions.reduce((n,s)=>n+s.totalReps,0);
  const totalEmom=weekSessions.reduce((n,s)=>n+s.emomReps,0);
  const rir=avg(logs.map(l=>l.result.rir).filter((x):x is number=>typeof x==="number"));
  const fatigue=avg(logs.map(l=>l.result.fatigue).filter((x):x is number=>typeof x==="number"));
  const effortCoverage=logs.length?logs.filter(l=>l.result.rir!==undefined&&l.result.fatigue!==undefined).length/logs.length*100:0;
  const lowMuscles=Object.values(stimulus.hypertrophyByMuscle).filter(x=>x.status==="LOW").sort((a,b)=>a.productiveSets-b.productiveSets).slice(0,4).map(x=>x.muscle.replaceAll("_"," "));
  const wins:string[]=[];
  const concerns:string[]=[];
  const actions:WeeklyCoachAction[]=[];

  if(weekSessions.length>=5) wins.push("Adherence strong: "+weekSessions.length+"/7 planned training days completed.");
  if(logs.length&&effortCoverage>=80) wins.push("Effort tracking is complete on "+Math.round(effortCoverage)+"% of completed exposures.");
  const improving=goalSignals.filter(g=>g.delta>0||g.trendPct>=5);
  if(improving.length) wins.push("Progress detected on "+improving.slice(0,2).map(g=>g.label).join(" and ")+".");
  if(!wins.length) wins.push("The week established useful training evidence; keep building comparable exposures.");

  if(workload.overallRecovery==="HIGH_FATIGUE"||workload.overallRecovery==="FATIGUED"){
    concerns.push("Recovery status: "+workload.overallRecovery.toLowerCase().replace("_"," ")+"." );
    actions.push({priority:"HIGH",title:"Protect recovery",detail:"Do not add intensity and volume together. Reduce lower-priority work first."});
  }

  if(plateaus.length){
    concerns.push(plateaus.length+" genuine plateau signal"+(plateaus.length>1?"s":"")+" detected after comparable exposures.");
    plateaus.slice(0,3).forEach(p=>actions.push({
      priority:p.recommendation==="CONSIDER_CLUSTER"?"HIGH":"MEDIUM",
      title:p.exerciseId+" · "+(p.recommendation==="CONSIDER_CLUSTER"?"test cluster method":"review variant"),
      detail:p.reason,
      exerciseId:p.exerciseId
    }));
  }

  const stalled=goalSignals.filter(g=>g.status==="STALLED"||g.status==="REGRESSING");
  stalled.slice(0,2).forEach(g=>{
    concerns.push(g.label+" is "+g.status.toLowerCase()+".");
    actions.push({priority:"HIGH",title:"Review "+g.label,detail:"Check recovery, execution quality and comparable dose before increasing difficulty.",exerciseId:g.goalId});
  });

  if(lowMuscles.length){
    concerns.push("Low productive hypertrophy stimulus: "+lowMuscles.slice(0,3).join(", ")+".");
    actions.push({priority:"MEDIUM",title:"Fill the hypertrophy floor",detail:"Add volume only to low-priority work when recovery is fresh."});
  }

  skill.filter(x=>x.canProgress).slice(0,2).forEach(x=>{
    actions.push({priority:"LOW",title:x.goalId+" is progression-ready",detail:x.reason,exerciseId:x.goalId});
  });

  if(!actions.length) actions.push({priority:"LOW",title:"Stay the course",detail:"No high-confidence intervention is justified this week. Accumulate another comparable exposure."});

  const primaryPct=primary&&compared?compared.adaptations[primary].attainmentPct:undefined;
  const headline=workload.overallRecovery==="HIGH_FATIGUE"?"Recovery is the main limiter"
    :plateaus.length?"A method change needs testing"
    :stalled.length?"A goal needs review"
    :improving.length?"Progress is moving in the right direction"
    :"Build another week of evidence";

  const summary=[
    weekSessions.length+"/7 sessions completed",
    rir!==undefined?"RIR avg "+round(rir,1):undefined,
    fatigue!==undefined?"fatigue avg "+round(fatigue,1)+"/5":undefined,
    workload.overallRecovery.replace("_"," ")+" recovery",
    primaryPct!==undefined?primary+" stimulus "+Math.round(primaryPct)+"% of phase target":undefined
  ].filter(Boolean).join(" · ");

  return {
    start:bounds.start,end,
    phase:phase?{id:phase.id,type:phase.type,week:phase.week,totalWeeks:phase.totalWeeks}:undefined,
    sessions:weekSessions.length,plannedSessions:7,adherencePct:round(Math.min(100,weekSessions.length/7*100),0),
    totalReps,totalEmomReps:totalEmom,totalAdjustedSets:workload.totalAdjustedSets,totalFatigueLoad:workload.totalFatigueLoad,
    averageRir:rir===undefined?undefined:round(rir,1),averageFatigue:fatigue===undefined?undefined:round(fatigue,1),
    effortCoveragePct:round(effortCoverage,0),recoveryStatus:workload.overallRecovery,headline,summary,
    wins:wins.slice(0,4),concerns:concerns.slice(0,5),goals:goalSignals,
    plateauCount:plateaus.length,
    plateauSummary:plateaus.slice(0,4).map(p=>p.exerciseId+": "+p.values.join(" → ")+" · "+p.recommendation),
    actions:actions.sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.priority]-{HIGH:0,MEDIUM:1,LOW:2}[b.priority])).slice(0,6),
    stimulus:{primary,primaryAttainmentPct:primaryPct===undefined?undefined:round(primaryPct,0),totalFatigue:stimulus.totalFatigue,lowHypertrophyMuscles:lowMuscles}
  };
}

export function formatCoachWeeklyReport(report:CoachWeeklyReport):string{
  const lines=[
    "CALISTHENICS COACH — WEEKLY INTELLIGENCE",
    report.phase?"Phase "+report.phase.type+" · Week "+report.phase.week+"/"+report.phase.totalWeeks:undefined,
    "Sessions: "+report.sessions+"/"+report.plannedSessions+" · adherence "+report.adherencePct.toFixed(0)+"%",
    "Total reps: "+report.totalReps+" · EMOM reps: "+report.totalEmomReps,
    "Workload: "+report.totalAdjustedSets.toFixed(1)+" adjusted sets · fatigue "+report.totalFatigueLoad.toFixed(1),
    report.averageRir!==undefined?"RIR avg: "+report.averageRir.toFixed(1):undefined,
    report.averageFatigue!==undefined?"Fatigue avg: "+report.averageFatigue.toFixed(1)+"/5":undefined,
    "Effort coverage: "+report.effortCoveragePct.toFixed(0)+"%",
    "Recovery: "+report.recoveryStatus,
    "",
    "COACH VERDICT: "+report.headline,
    report.summary,
    "",
    "WINS",
    ...report.wins.map(x=>"- "+x),
    "",
    "CONCERNS",
    ...(report.concerns.length?report.concerns.map(x=>"- "+x):["- None"]),
    "",
    "GOALS",
    ...report.goals.map(g=>"- "+g.label+": week "+(g.weekBest||"—")+(g.previousBest?" vs prev "+g.previousBest:"")+" · trend "+(g.trendPct>=0?"+":"")+g.trendPct.toFixed(1)+"% · "+g.status),
    "",
    "PLATEAUS",
    ...(report.plateauSummary.length?report.plateauSummary.map(x=>"- "+x):["- None"]),
    "",
    "NEXT WEEK ACTIONS",
    ...report.actions.map((a,i)=>(i+1)+". ["+a.priority+"] "+a.title+" — "+a.detail)
  ];
  return lines.filter(Boolean).join("\n");
}
