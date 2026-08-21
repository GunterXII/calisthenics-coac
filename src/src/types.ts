
export type DayKey = "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday";
export type BlockKind = "HANDSTAND"|"SKILL_STATIC"|"SKILL_REPS"|"VOLUME_SKILL"|"PERFORMANCE"|"EMOM"|"ACCESSORY"|"CORE";
export type Band = "None"|"Blue 15–25 lb"|"Purple 25–40 lb"|"Yellow 40–80 lb"|"Red 50–125 lb"|"Black 60–170 lb";
export type BlockStatus = "complete"|"modified"|"incomplete"|"skipped";

export interface MicroStep { id:string; name:string; dose:string; timerSec?:number; }
export interface ProgressionSpec {
  current:string;
  next:string;
  rule:string;
  regression?:string;
  bandMode?:"assistance"|"resistance"|"none";
}
export interface ExerciseBlock {
  id:string; catalogExerciseId?:string; kind:BlockKind; name:string; detail:string; sets?:number; minutes?:number;
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
  id:string; date:number; day:DayKey; exerciseId:string; exerciseName:string; kind:BlockKind;
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

export interface SessionSummary {
  id:string; date:number; day:DayKey; durationSec:number; readiness:Readiness;
  logs:WorkoutLog[]; totalReps:number; emomReps:number; bestSkillSeconds:number;
  sessionNote?:string;
}

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
