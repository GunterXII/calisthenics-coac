import type {ExerciseBlock, TrainingPriority, TrainingRole, ProgressionMode, MuscleGroup} from "./types";

export interface TrainingProfile {
  role: TrainingRole;
  priority: TrainingPriority;
  progressionMode: ProgressionMode;
  fatigueCost: 1 | 2 | 3 | 4 | 5;
  muscleGroups: MuscleGroup[];
  /** Heuristic workload weight for internal planning only; not an anatomical "effective set" claim. */
  effectiveSetWeight: number;
  gripDemand: "none" | "low" | "moderate" | "high";
  notes?: string;
}

const PROFILE: Record<string, Partial<TrainingProfile>> = {
  // Push strength / skill
  "hs-a": {role:"skill", priority:"primary", progressionMode:"skill_quality", fatigueCost:2, muscleGroups:["front_delts","triceps","core"], effectiveSetWeight:0.25, gripDemand:"low"},
  pike: {role:"strength", priority:"primary", progressionMode:"strength_reps", fatigueCost:3, muscleGroups:["front_delts","triceps","chest"], effectiveSetWeight:0.8, gripDemand:"low"},
  diamond: {role:"hypertrophy", priority:"primary", progressionMode:"hypertrophy_reps", fatigueCost:3, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:1, gripDemand:"none"},
  "pushup-volume": {role:"hypertrophy", priority:"primary", progressionMode:"hypertrophy_reps", fatigueCost:3, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:1, gripDemand:"none"},
  "dips-volume-a": {role:"hypertrophy", priority:"primary", progressionMode:"hypertrophy_reps", fatigueCost:4, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:1, gripDemand:"moderate"},
  "pushup-long": {role:"hypertrophy", priority:"secondary", progressionMode:"endurance", fatigueCost:3, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.75, gripDemand:"none"},
  "dips-long": {role:"hypertrophy", priority:"secondary", progressionMode:"endurance", fatigueCost:4, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.75, gripDemand:"moderate"},
  "close-pushup": {role:"hypertrophy", priority:"primary", progressionMode:"hypertrophy_reps", fatigueCost:3, muscleGroups:["chest","triceps"], effectiveSetWeight:1, gripDemand:"none"},
  "pushup-emom-b": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:4, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.9, gripDemand:"none"},
  "pushup-emom-c": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:4, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.9, gripDemand:"none"},
  "dips-emom-b": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:5, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.9, gripDemand:"moderate"},
  "dips-emom-c": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:5, muscleGroups:["chest","triceps","front_delts"], effectiveSetWeight:0.9, gripDemand:"moderate"},
  "lat-a": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["side_delts"], effectiveSetWeight:1, gripDemand:"low"},
  "lat-b": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["side_delts"], effectiveSetWeight:1, gripDemand:"low"},
  "lat-c": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["side_delts"], effectiveSetWeight:1, gripDemand:"low"},
  "tri-a": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["triceps"], effectiveSetWeight:1, gripDemand:"low"},
  "tri-b": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["triceps"], effectiveSetWeight:1, gripDemand:"low"},

  // Pull skill / strength / density
  touch: {role:"skill", priority:"primary", progressionMode:"static_hold", fatigueCost:3, muscleGroups:["lats","upper_back","core","forearms"], effectiveSetWeight:0.35, gripDemand:"high"},
  "touch-band": {role:"skill", priority:"secondary", progressionMode:"static_hold", fatigueCost:3, muscleGroups:["lats","upper_back","core","forearms"], effectiveSetWeight:0.45, gripDemand:"high"},
  "high-pull": {role:"strength", priority:"primary", progressionMode:"strength_reps", fatigueCost:4, muscleGroups:["lats","upper_back","biceps","forearms"], effectiveSetWeight:0.85, gripDemand:"high"},
  pullup: {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:4, muscleGroups:["lats","upper_back","biceps","forearms"], effectiveSetWeight:0.9, gripDemand:"high"},
  oap: {role:"skill", priority:"primary", progressionMode:"skill_quality", fatigueCost:5, muscleGroups:["lats","upper_back","biceps","forearms","core"], effectiveSetWeight:0.35, gripDemand:"high"},
  "oap-band": {role:"strength", priority:"primary", progressionMode:"strength_reps", fatigueCost:5, muscleGroups:["lats","upper_back","biceps","forearms","core"], effectiveSetWeight:0.75, gripDemand:"high"},
  "archer-pull": {role:"strength", priority:"secondary", progressionMode:"strength_reps", fatigueCost:4, muscleGroups:["lats","upper_back","biceps","forearms"], effectiveSetWeight:0.8, gripDemand:"high"},
  "close-chin": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:4, muscleGroups:["lats","biceps","upper_back","forearms"], effectiveSetWeight:0.9, gripDemand:"high"},
  "flpu": {role:"skill", priority:"primary", progressionMode:"skill_quality", fatigueCost:5, muscleGroups:["lats","upper_back","biceps","forearms","core"], effectiveSetWeight:0.35, gripDemand:"high"},
  "flpu-band": {role:"strength", priority:"primary", progressionMode:"strength_reps", fatigueCost:5, muscleGroups:["lats","upper_back","biceps","forearms","core"], effectiveSetWeight:0.75, gripDemand:"high"},
  "chest-high": {role:"strength", priority:"secondary", progressionMode:"strength_reps", fatigueCost:4, muscleGroups:["lats","upper_back","biceps","forearms"], effectiveSetWeight:0.8, gripDemand:"high"},
  "close-pull": {role:"hypertrophy", priority:"primary", progressionMode:"density_emom", fatigueCost:4, muscleGroups:["lats","upper_back","biceps","forearms"], effectiveSetWeight:0.9, gripDemand:"high"},
  "curl-a": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["biceps","forearms"], effectiveSetWeight:1, gripDemand:"low"},
  "curl-b": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["biceps","forearms"], effectiveSetWeight:1, gripDemand:"low"},
  "curl-c": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["biceps","forearms"], effectiveSetWeight:1, gripDemand:"low"},

  // Core
  "core-a": {role:"hypertrophy", priority:"support", progressionMode:"static_hold", fatigueCost:2, muscleGroups:["core"], effectiveSetWeight:0.8, gripDemand:"none"},
  "leg-raise": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["core"], effectiveSetWeight:0.8, gripDemand:"none", notes:"Floor-based in current program to spare pull-day grip."},
  "hollow-rocks": {role:"hypertrophy", priority:"support", progressionMode:"endurance", fatigueCost:2, muscleGroups:["core"], effectiveSetWeight:0.8, gripDemand:"none"},

  // Lower body
  "broad-jump": {role:"power", priority:"primary", progressionMode:"power_quality", fatigueCost:3, muscleGroups:["glutes","quads","calves"], effectiveSetWeight:0.35, gripDemand:"none"},
  cmj: {role:"power", priority:"primary", progressionMode:"power_quality", fatigueCost:3, muscleGroups:["glutes","quads","calves"], effectiveSetWeight:0.35, gripDemand:"none"},
  bulgarian: {role:"hypertrophy", priority:"primary", progressionMode:"hypertrophy_reps", fatigueCost:3, muscleGroups:["quads","glutes","hamstrings"], effectiveSetWeight:1, gripDemand:"none"},
  pistol: {role:"strength", priority:"secondary", progressionMode:"strength_reps", fatigueCost:3, muscleGroups:["quads","glutes"], effectiveSetWeight:0.8, gripDemand:"none"},
  "sl-rdl": {role:"hypertrophy", priority:"secondary", progressionMode:"hypertrophy_reps", fatigueCost:3, muscleGroups:["hamstrings","glutes"], effectiveSetWeight:1, gripDemand:"none"},
  "jump-lunge": {role:"power", priority:"secondary", progressionMode:"power_quality", fatigueCost:3, muscleGroups:["quads","glutes","calves"], effectiveSetWeight:0.35, gripDemand:"none"},
  calf: {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["calves"], effectiveSetWeight:1, gripDemand:"none"},
  "band-legcurl": {role:"hypertrophy", priority:"support", progressionMode:"hypertrophy_reps", fatigueCost:2, muscleGroups:["hamstrings"], effectiveSetWeight:1, gripDemand:"none"},
};

function defaultProfile(block: ExerciseBlock): TrainingProfile {
  const role = block.trainingRole || (block.kind === "EMOM" ? "hypertrophy" : block.kind === "CORE" ? "hypertrophy" : "strength");
  const priority = block.priority || "secondary";
  const progressionMode: ProgressionMode = role === "skill"
    ? (block.previousMode === "seconds" ? "static_hold" : "skill_quality")
    : role === "power" ? "power_quality"
    : role === "hypertrophy" ? (block.kind === "EMOM" ? "density_emom" : "hypertrophy_reps")
    : role === "strength" ? "strength_reps"
    : "none";
  const muscleGroups: MuscleGroup[] = block.kind === "CORE" ? ["core"] : [];
  return {
    role,
    priority,
    progressionMode,
    fatigueCost: block.kind === "EMOM" ? 4 : block.kind === "SKILL_REPS" ? 4 : 2,
    muscleGroups,
    effectiveSetWeight: role === "hypertrophy" ? 1 : role === "strength" ? 0.8 : role === "skill" ? 0.35 : role === "power" ? 0.35 : 0,
    gripDemand: block.name.toLowerCase().includes("pull") || block.name.toLowerCase().includes("chin") || block.name.toLowerCase().includes("hang") ? "high" : "none",
  };
}

export function trainingProfileForBlock(block: ExerciseBlock): TrainingProfile {
  const p = PROFILE[block.id];
  return {
    ...defaultProfile(block),
    ...p,
    muscleGroups: p?.muscleGroups || defaultProfile(block).muscleGroups,
  } as TrainingProfile;
}

export function effectiveWorkloadSets(block: ExerciseBlock, performedSetCount?: number): number {
  const profile = trainingProfileForBlock(block);
  const sets = performedSetCount ?? Math.max(1, block.sets || block.minutes || 1);
  return Number((sets * profile.effectiveSetWeight).toFixed(2));
}

export function sessionWorkloadByMuscle(blocks: ExerciseBlock[], completedSetCounts?: Record<string, number>) {
  const totals: Partial<Record<MuscleGroup, number>> = {};
  for (const block of blocks) {
    const profile = trainingProfileForBlock(block);
    const sets = completedSetCounts?.[block.id];
    const workload = effectiveWorkloadSets(block, sets);
    for (const muscle of profile.muscleGroups) totals[muscle] = Number(((totals[muscle] || 0) + workload).toFixed(2));
  }
  return totals;
}
