
export type DayKey = "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday";
export type BlockKind = "HANDSTAND"|"SKILL_STATIC"|"SKILL_REPS"|"VOLUME_SKILL"|"PERFORMANCE"|"EMOM"|"ACCESSORY"|"CORE";
export type Band = "None"|"Blue 15–25 lb"|"Purple 25–40 lb"|"Yellow 40–80 lb"|"Red 50–125 lb"|"Black 60–170 lb";
export type BlockStatus = "complete"|"modified"|"incomplete"|"skipped";
export type TrainingRole = "skill"|"strength"|"hypertrophy"|"endurance"|"power"|"mobility";
export type BandMode = "assistance"|"resistance"|"none";
export type TrainingPriority = "primary"|"secondary"|"support";

export type ProgressionCriteria =
  | { type:"reps"; minSets:number; minReps:number; minRir?:number; requireClean?:boolean; consecutiveSessions?:number; side?:"R"|"L"|"both"; minQualifyingRepsPerSide?:number }
  | { type:"seconds"; minHolds:number; minSeconds:number; minRir?:number; requireClean?:boolean; consecutiveSessions?:number }
  | { type:"emom"; minutes:number; minPerMinute:number; maxDropoffPct?:number; maxCvPct?:number; minLastVsFirstPct?:number; minRir?:number; consecutiveSessions?:number }
  | { type:"skill_quality"; minExposures:number; minQualityPct:number; consecutiveSessions?:number; minRir?:number };


export interface MicroStep { id:string; name:string; dose:string; timerSec?:number; }
export interface ProgressionSpec {
  current:string;
  next:string;
  rule:string;
  criteria?:ProgressionCriteria;
  regression?:string;
  bandMode?:BandMode;
}
export interface ExerciseBlock {
  id:string; catalogExerciseId?:string; kind:BlockKind; trainingRole?:TrainingRole; priority?:TrainingPriority; name:string; detail:string; sets?:number; minutes?:number;
  target:string; rest:number; bandOptions?:Band[]; countdown?:boolean;
  previousMode?:"reps"|"seconds"|"emom"; microSteps?:readonly MicroStep[];
  defaultBand?:Band; day?:DayKey; sortOrder?:number;
}
export interface DayProgram { title:string; subtitle:string; warmup:MicroStep[]; blocks:ExerciseBlock[]; }

export type MobilityStatus = "complete"|"skipped"|"incomplete";
export interface MobilityLog {
  id:string; exerciseId:string; exerciseName:string; kind:"static"|"dynamic"; status:"complete"|"skipped";
  durationSec?:number; reps?:number; skipped?:boolean;
}
export interface MobilitySession {
  id:string; workoutSessionId:string; date:number; day:DayKey; status:MobilityStatus; durationSec:number; logs:MobilityLog[];
}

export interface Readiness {
  sleepHours?:number; weightKg?:number; energy?:number; wristPain?:number; elbowPain?:number;
}
export interface WorkoutLog {
  id:string; date:number; day:DayKey; exerciseId:string; exerciseName:string; variantName?:string; kind:BlockKind;
  status:BlockStatus; skipped?:boolean; modification?:string;
  result:{
    reps?:number[]; seconds?:number[]; emom?:number[]; sides?:("R"|"L")[];
    band?:Band; rir?:number; fatigue?:number; note?:string;
  };
}
export interface AthleteGoals {
  primaryGoal?: string;
  secondaryGoals?: string[];
  prioritySkills?: string[];
  targetDate?: string;
  notes?: string;
}

export interface AthleteBaseline { pushups?:number; dips?:number; pullups?:number; oap?:number; flPullups?:number; frontTouchSec?:number; }
export interface ReadinessAnalysis {
  score:number;
  status:"READY"|"CAUTION"|"RECOVERY"|"PAIN_REVIEW";
  reasons:string[];
  allowProgression:boolean;
  recommendedLoadMultiplier:number;
}
export interface SidePerformance {
  rightBest:number;
  leftBest:number;
  rightQualifying:number;
  leftQualifying:number;
  balanced:boolean;
}
export interface BodyweightPerformance {
  currentWeightKg?:number;
  referenceWeightKg?:number;
  rawValue:number;
  normalizedValue:number;
  normalizedDeltaPct?:number;
  interpretation:"IMPROVING"|"STABLE"|"DECLINING"|"NO_WEIGHT_DATA";
}
export interface ProgressionEvaluation {
  qualifies:boolean;
  qualityScore:number;
  stabilityScore:number;
  reasons:string[];
  sidePerformance?:SidePerformance;
  bodyweightPerformance?:BodyweightPerformance;
}

export interface SessionSummary {
  id:string; date:number; day:DayKey; durationSec:number; readiness:Readiness;
  logs:WorkoutLog[]; totalReps:number; emomReps:number; bestSkillSeconds:number;
  sessionNote?:string;
}

export interface ProgramOverride { exerciseId:string; catalogExerciseId?:string; name?:string; detail?:string; kind?:BlockKind; trainingRole?:TrainingRole; priority?:TrainingPriority; target?:string; sets?:number; rest?:number; minutes?:number; bandOptions?:Band[]; defaultBand?:Band; updatedAt:number; previous?:ProgramOverride|null; }
export interface CoachDecision { id:string; date:number; type:"program"|"progression"|"coach"; exerciseId?:string; title:string; detail:string; from?:string; to?:string; }

export interface CurrentVariantState {
  exerciseId:string;
  variantId:string;
  variantName:string;
  step:number;
  status:"active"|"promoted"|"held";
  updatedAt:number;
  lastCoachAction:"none"|"promote"|"hold";
}
export interface WorkoutDraft {
  id:string;
  startedAt:number;
  updatedAt:number;
  day:DayKey;
  index:number;
  logs:WorkoutLog[];
  readiness:Readiness;
  sessionNote?:string;
}
