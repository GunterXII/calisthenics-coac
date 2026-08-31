import type {ExerciseBlock, TrainingPriority, TrainingRole, ProgressionMode, MuscleGroup, StimulusProfile} from "./types";

export interface TrainingProfile {
  role: TrainingRole;
  priority: TrainingPriority;
  progressionMode: ProgressionMode;
  fatigueCost: 1 | 2 | 3 | 4 | 5;
  muscleGroups: MuscleGroup[];
  /** Heuristic workload weight for internal planning only; not an anatomical "effective set" claim. */
  effectiveSetWeight: number;
  gripDemand: "none" | "low" | "moderate" | "high";
  /** Separate adaptation model: stimulus is not the same thing as workload/fatigue. */
  stimulus: StimulusProfile;
  notes?: string;
}

const STIMULUS_DEFAULTS: Record<TrainingRole, Omit<StimulusProfile, "fatigue">> = {
  skill: {skill:1, strength:0.45, hypertrophy:0.25, endurance:0.05, power:0.1},
  strength: {skill:0.2, strength:0.9, hypertrophy:0.6, endurance:0.15, power:0.2},
  hypertrophy: {skill:0.05, strength:0.35, hypertrophy:0.95, endurance:0.35, power:0.05},
  endurance: {skill:0.05, strength:0.2, hypertrophy:0.55, endurance:1, power:0.05},
  power: {skill:0.45, strength:0.7, hypertrophy:0.2, endurance:0.1, power:1},
  mobility: {skill:0.25, strength:0.05, hypertrophy:0, endurance:0.1, power:0},
};

const STIMULUS_OVERRIDES: Record<string, Partial<StimulusProfile>> = {
  oap: {skill:1, strength:0.95, hypertrophy:0.25, endurance:0.05, power:0.1},
  "oap-band": {skill:0.8, strength:0.9, hypertrophy:0.65, endurance:0.1, power:0.1},
  flpu: {skill:1, strength:0.95, hypertrophy:0.3, endurance:0.08, power:0.1},
  "flpu-band": {skill:0.82, strength:0.9, hypertrophy:0.65, endurance:0.1, power:0.1},
  touch: {skill:1, strength:0.65, hypertrophy:0.18, endurance:0.05, power:0.05},
  "touch-band": {skill:0.88, strength:0.6, hypertrophy:0.35, endurance:0.1, power:0.05},
  "high-pull": {skill:0.25, strength:0.9, hypertrophy:0.65, endurance:0.12, power:0.65},
  pullup: {skill:0.08, strength:0.4, hypertrophy:0.9, endurance:0.75, power:0.05},
  "close-chin": {skill:0.05, strength:0.4, hypertrophy:0.9, endurance:0.8, power:0.05},
  "close-pull": {skill:0.05, strength:0.4, hypertrophy:0.9, endurance:0.8, power:0.05},
  "pushup-emom-b": {skill:0.03, strength:0.25, hypertrophy:0.55, endurance:0.95, power:0.02},
  "pushup-emom-c": {skill:0.03, strength:0.25, hypertrophy:0.55, endurance:0.95, power:0.02},
  "dips-emom-b": {skill:0.03, strength:0.35, hypertrophy:0.6, endurance:0.95, power:0.02},
  "dips-emom-c": {skill:0.03, strength:0.35, hypertrophy:0.6, endurance:0.95, power:0.02},
  "pushup-long": {skill:0.03, strength:0.3, hypertrophy:0.6, endurance:0.95, power:0.02},
  "dips-long": {skill:0.03, strength:0.4, hypertrophy:0.65, endurance:0.95, power:0.02},
};

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
  const fatigueCost = block.kind === "EMOM" ? 4 : block.kind === "SKILL_REPS" ? 4 : 2;
  const baseStimulus = STIMULUS_DEFAULTS[role];
  return {
    role,
    priority,
    progressionMode,
    fatigueCost,
    muscleGroups,
    effectiveSetWeight: role === "hypertrophy" ? 1 : role === "strength" ? 0.8 : role === "skill" ? 0.35 : role === "power" ? 0.35 : 0,
    gripDemand: block.name.toLowerCase().includes("pull") || block.name.toLowerCase().includes("chin") || block.name.toLowerCase().includes("hang") ? "high" : "none",
    stimulus: { ...baseStimulus, fatigue: fatigueCost / 5 },
  };
}

export function trainingProfileForBlock(block: ExerciseBlock): TrainingProfile {
  const p = PROFILE[block.id];
  const base = defaultProfile(block);
  const role = p?.role || base.role;
  const roleStimulus = STIMULUS_DEFAULTS[role];
  const stimulus = {
    ...base.stimulus,
    ...roleStimulus,
    ...(STIMULUS_OVERRIDES[block.id] || {}),
    fatigue: (p?.fatigueCost ?? base.fatigueCost) / 5,
  };
  return {
    ...base,
    ...p,
    muscleGroups: p?.muscleGroups || base.muscleGroups,
    stimulus,
  } as TrainingProfile;
}

export interface StimulusSummary {
  skill: number;
  strength: number;
  hypertrophy: number;
  endurance: number;
  power: number;
  fatigue: number;
  muscles: Partial<Record<MuscleGroup, number>>;
}

/**
 * Returns a normalized profile for planning. The returned stimulus values are
 * heuristics for internal program design; they are not physiological measurements.
 */
export function normalizedTrainingProfile(block: ExerciseBlock): TrainingProfile {
  const profile = trainingProfileForBlock(block);
  const clamp01 = (n:number) => Math.max(0, Math.min(1, n));
  return {
    ...profile,
    effectiveSetWeight: clamp01(profile.effectiveSetWeight),
    stimulus: {
      skill: clamp01(profile.stimulus.skill),
      strength: clamp01(profile.stimulus.strength),
      hypertrophy: clamp01(profile.stimulus.hypertrophy),
      endurance: clamp01(profile.stimulus.endurance),
      power: clamp01(profile.stimulus.power),
      fatigue: Math.max(0, Math.min(5, profile.stimulus.fatigue)),
    },
  };
}

export function summarizeStimulus(blocks: ExerciseBlock[], completedSetsByBlock: Record<string, number> = {}): StimulusSummary {
  const out: StimulusSummary = {skill:0, strength:0, hypertrophy:0, endurance:0, power:0, fatigue:0, muscles:{}};
  for (const block of blocks) {
    const profile = normalizedTrainingProfile(block);
    const sets = Math.max(1, completedSetsByBlock[block.id] ?? block.sets ?? 1);
    out.skill += profile.stimulus.skill * sets;
    out.strength += profile.stimulus.strength * sets;
    out.hypertrophy += profile.stimulus.hypertrophy * sets;
    out.endurance += profile.stimulus.endurance * sets;
    out.power += profile.stimulus.power * sets;
    out.fatigue += profile.stimulus.fatigue * sets;
    for (const muscle of profile.muscleGroups) out.muscles[muscle] = (out.muscles[muscle] || 0) + profile.stimulus.hypertrophy * sets;
  }
  return out;
}

export function stimulusProfileForBlock(block: ExerciseBlock): StimulusProfile {
  return trainingProfileForBlock(block).stimulus;
}

export function sessionStimulusByAdaptation(blocks: ExerciseBlock[], performedSetCounts?: Record<string, number>) {
  const totals: Record<keyof StimulusProfile, number> = {
    skill:0,
    strength:0,
    hypertrophy:0,
    endurance:0,
    power:0,
    fatigue:0,
  };
  for (const block of blocks) {
    const profile = trainingProfileForBlock(block);
    const sets = performedSetCounts?.[block.id];
    const workloadSets = effectiveWorkloadSets(block, sets);
    for (const key of Object.keys(totals) as (keyof StimulusProfile)[]) {
      totals[key] += workloadSets * profile.stimulus[key];
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([k,v]) => [k, Number(v.toFixed(2))])) as Record<keyof StimulusProfile, number>;
}

export function sessionStimulusByMuscleAndAdaptation(blocks: ExerciseBlock[], performedSetCounts?: Record<string, number>) {
  const totals: Partial<Record<MuscleGroup, Record<"hypertrophy"|"strength"|"skill"|"endurance"|"power", number>>> = {};
  for (const block of blocks) {
    const profile = trainingProfileForBlock(block);
    const workloadSets = effectiveWorkloadSets(block, performedSetCounts?.[block.id]);
    for (const muscle of profile.muscleGroups) {
      const bucket = totals[muscle] || (totals[muscle] = {skill:0, strength:0, hypertrophy:0, endurance:0, power:0});
      bucket.skill += workloadSets * profile.stimulus.skill;
      bucket.strength += workloadSets * profile.stimulus.strength;
      bucket.hypertrophy += workloadSets * profile.stimulus.hypertrophy;
      bucket.endurance += workloadSets * profile.stimulus.endurance;
      bucket.power += workloadSets * profile.stimulus.power;
    }
  }
  for (const muscle of Object.keys(totals) as MuscleGroup[]) {
    const bucket = totals[muscle]!;
    for (const key of Object.keys(bucket) as Array<keyof typeof bucket>) bucket[key] = Number(bucket[key].toFixed(2));
  }
  return totals;
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
