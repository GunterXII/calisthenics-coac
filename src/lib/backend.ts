import { supabase, supabaseConfigured } from './supabase';
import { EXERCISE_CATALOG, type ExerciseCatalogItem, type ExerciseKind } from '../exercises';
import type { MobilitySession, SessionSummary, WorkoutLog, AthleteGoals, AthleteBaseline } from '../types';
import {
  getCoachDecisions,
  getMobilitySessions,
  getProgramOverrides,
  mergeProgramLayer,
  mergeSessions,
  saveMobilitySession,
  clearProgramOverride,
} from '../storage';

export type BackendStatus = 'disabled' | 'signed_out' | 'signed_in' | 'error';

export type RemoteProgramBlock = {
  id: string;
  program_id: string;
  day: string;
  exercise_id: string;
  name: string;
  kind: string;
  detail?: string | null;
  target?: string | null;
  sets?: number | null;
  rest_sec?: number | null;
  minutes?: number | null;
  band_options?: string[] | null;
  sort_order?: number;
  override_payload?: Record<string, unknown>;
};

export type RemoteProgramDecision = {
  id: string;
  athlete_id: string;
  program_id?: string | null;
  exercise_id?: string | null;
  type: string;
  title: string;
  detail?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  created_by?: string | null;
  created_at: string;
};

export type ProgramLayerSyncResult = {
  uploadedOverrides: number;
  pulledOverrides: number;
  uploadedDecisions: number;
  pulledDecisions: number;
  programId: string | null;
};



export type UserProfile = {
  id: string;
  display_name: string | null;
  role: 'athlete' | 'coach';
  height_cm?: number | null;
  weight_kg?: number | null;
  coach_code?: string | null;
};

export type CoachAthlete = UserProfile & { linked_at: string };


export type AthleteCoachingProfile = AthleteGoals & {
  athlete_id: string;
  baseline?: AthleteBaseline;
  schedule_days?: number | null;
  equipment?: string[] | null;
  preferences?: Record<string, unknown> | null;
  updated_at?: string | null;
};

export async function fetchAthleteCoachingProfile(athleteId: string): Promise<AthleteCoachingProfile | null> {
  if (!supabase || !supabaseConfigured) return null;
  const { data, error } = await supabase.from('athlete_coaching_profiles').select('*').eq('athlete_id', athleteId).maybeSingle();
  if (error) throw error;
  return data ? ({
    ...(data as AthleteCoachingProfile),
    baseline: ((data as any).preferences?.baseline || (data as any).baseline || undefined),
  }) : null;
}

export async function saveAthleteCoachingProfile(athleteId: string, profile: AthleteCoachingProfile): Promise<AthleteCoachingProfile> {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_save_athlete_profile', {
    p_athlete_id: athleteId,
    p_primary_goal: profile.primaryGoal || null,
    p_secondary_goals: profile.secondaryGoals || [],
    p_priority_skills: profile.prioritySkills || [],
    p_target_date: profile.targetDate || null,
    p_notes: profile.notes || null,
    p_schedule_days: profile.schedule_days ?? null,
    p_equipment: profile.equipment || [],
    p_preferences: { ...(profile.preferences || {}), baseline: profile.baseline || (profile.preferences as any)?.baseline || {} },
  });
  if (error) throw error;
  return {
    ...(data as AthleteCoachingProfile),
    baseline: ((data as any)?.preferences?.baseline || profile.baseline || undefined),
  };
}

export async function fetchMyCoachingProfile(): Promise<AthleteCoachingProfile | null> {
  if (!supabase || !supabaseConfigured) return null;
  const userId = await requireUserId();
  const { data, error } = await supabase.from('athlete_coaching_profiles').select('*').eq('athlete_id', userId).maybeSingle();
  if (error) throw error;
  return data ? ({
    ...(data as AthleteCoachingProfile),
    baseline: ((data as any).preferences?.baseline || (data as any).baseline || undefined),
  }) : null;
}

export async function saveMyCoachingProfile(profile: AthleteCoachingProfile): Promise<AthleteCoachingProfile> {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const userId = await requireUserId();
  const { data, error } = await supabase.rpc('athlete_save_own_profile', {
    p_primary_goal: profile.primaryGoal || null,
    p_secondary_goals: profile.secondaryGoals || [],
    p_priority_skills: profile.prioritySkills || [],
    p_target_date: profile.targetDate || null,
    p_notes: profile.notes || null,
    p_schedule_days: profile.schedule_days ?? null,
    p_equipment: profile.equipment || [],
    p_preferences: { ...(profile.preferences || {}), baseline: profile.baseline || (profile.preferences as any)?.baseline || {} },
  });
  if (error) throw error;
  return {
    ...(data as AthleteCoachingProfile),
    athlete_id: userId,
    baseline: ((data as any)?.preferences?.baseline || profile.baseline || undefined),
  };
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  if (!supabase || !supabaseConfigured) return null;
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,role,height_cm,weight_kg,coach_code')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data as UserProfile : null;
}

export async function fetchCoachAthletes(): Promise<CoachAthlete[]> {
  if (!supabase || !supabaseConfigured) return [];
  const coachId = await requireUserId();
  const { data: relationships, error: relError } = await supabase
    .from('coach_relationships')
    .select('athlete_id,created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true });
  if (relError) throw relError;
  const ids = (relationships || []).map((r: any) => String(r.athlete_id));
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,display_name,role,height_cm,weight_kg,coach_code')
    .in('id', ids);
  if (profileError) throw profileError;
  const byId = new Map<string, UserProfile>((profiles || []).map((p: any) => [String(p.id), p as UserProfile] as [string, UserProfile]));
  return (relationships || []).map((r: any) => {
    const profile = byId.get(String(r.athlete_id));
    return profile ? { ...profile, linked_at: r.created_at } : null;
  }).filter(Boolean) as CoachAthlete[];
}

async function getActiveProgramForAthlete(athleteId: string, createIfMissing = false) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: existing, error } = await supabase
    .from('programs')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing || !createIfMissing) return existing;
  const actorId = await requireUserId();
  const { data: created, error: createError } = await supabase
    .from('programs')
    .insert({
      athlete_id: athleteId,
      name: 'Calisthenics Coach Program',
      version: 1,
      is_active: true,
      created_by: actorId,
    })
    .select('*')
    .single();
  if (createError) throw createError;
  return created;
}

export async function fetchCoachAthleteProgram(athleteId: string) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const program = await getActiveProgramForAthlete(athleteId, false);
  if (!program) return { program: null, blocks: [], decisions: [] as RemoteProgramDecision[] };
  const [{ data: blocks, error: blocksError }, { data: decisions, error: decisionsError }] = await Promise.all([
    supabase.from('program_blocks').select('*').eq('program_id', program.id).order('sort_order', { ascending: true }),
    supabase.from('program_decisions').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(200),
  ]);
  if (blocksError) throw blocksError;
  if (decisionsError) throw decisionsError;
  return { program, blocks: blocks || [], decisions: (decisions || []) as RemoteProgramDecision[] };
}

export async function fetchCoachAthleteSessions(athleteId: string, limit = 30) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, exercise_logs(*)')
    .eq('user_id', athleteId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getMyCoachCode(): Promise<string | null> {
  if (!supabase || !supabaseConfigured) return null;
  await requireUserId();
  const { data, error } = await supabase.rpc('get_or_create_my_coach_code');
  if (error) throw error;
  return data ? String(data) : null;
}

export async function linkMyAthleteAccountToCoach(code: string) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('link_me_to_coach', { p_coach_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}

export async function fetchMyCoach(): Promise<CoachAthlete|null> {
  if (!supabase || !supabaseConfigured) return null;
  const athleteId = await requireUserId();
  const { data: rel, error: relError } = await supabase.from('coach_relationships').select('coach_id,created_at').eq('athlete_id', athleteId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (relError) throw relError;
  if (!rel) return null;
  const { data: coach, error: coachError } = await supabase.from('profiles').select('id,display_name,role,height_cm,weight_kg,coach_code').eq('id', rel.coach_id).maybeSingle();
  if (coachError) throw coachError;
  return coach ? {...coach as UserProfile, linked_at: rel.created_at} : null;
}

export async function unlinkMyCoach(coachId: string) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('unlink_me_from_coach', { p_coach_id: coachId });
  if (error) throw error;
}

export async function saveCoachProgramBlock(params: {
  athleteId: string;
  block: ExerciseBlockLike;
  catalogExerciseId: string;
  reason?: string;
}) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_publish_program_change', {
    p_athlete_id: params.athleteId,
    p_exercise_id: params.block.id,
    p_day: params.block.day || 'unknown',
    p_catalog_exercise_id: params.catalogExerciseId,
    p_name: params.block.name,
    p_kind: params.block.kind,
    p_detail: params.block.detail || null,
    p_target: params.block.target || null,
    p_sets: params.block.sets ?? null,
    p_rest_sec: params.block.rest ?? null,
    p_minutes: params.block.minutes ?? null,
    p_band_options: params.block.bandOptions ?? null,
    p_sort_order: params.block.sortOrder ?? 0,
    p_reason: params.reason || 'Coach published a program change'
  });
  if (error) throw error;
  return data;
}

export async function resetCoachProgramBlock(athleteId: string, blockId: string, day: string, defaultBlock: ExerciseBlockLike) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_reset_program_change', {
    p_athlete_id: athleteId,
    p_exercise_id: blockId,
    p_day: day || defaultBlock.day || 'unknown',
    p_default_name: defaultBlock.name,
    p_reason: 'Coach restored the default prescription'
  });
  if (error) throw error;
  return data;
}

type ExerciseBlockLike = {
  id: string;
  day?: string;
  name: string;
  kind: string;
  detail?: string;
  target?: string;
  sets?: number;
  rest?: number;
  minutes?: number;
  bandOptions?: string[];
  sortOrder?: number;
};

export async function fetchExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  if (!supabase || !supabaseConfigured) return EXERCISE_CATALOG;
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select('id,name,category,skill,pattern,kind,difficulty,equipment,side_mode,rep_min,rep_max,hold_min,hold_max,rest_sec,default_target,detail,cue')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  if (!data?.length) return EXERCISE_CATALOG;
  const remote: ExerciseCatalogItem[] = data.map((row:any): ExerciseCatalogItem => ({
    id: String(row.id),
    name: row.name,
    category: row.category,
    skill: row.skill,
    pattern: row.pattern,
    kind: row.kind as ExerciseKind,
    difficulty: Number(row.difficulty) as 1|2|3|4|5,
    equipment: row.equipment || [],
    sideMode: row.side_mode === 'left_right' ? 'left_right' : 'bilateral',
    repMin: row.rep_min ?? undefined,
    repMax: row.rep_max ?? undefined,
    holdMin: row.hold_min ?? undefined,
    holdMax: row.hold_max ?? undefined,
    restSec: row.rest_sec ?? undefined,
    defaultTarget: row.default_target ?? undefined,
    detail: row.detail ?? undefined,
    cue: row.cue ?? undefined,
  }));
  const byId = new Map(EXERCISE_CATALOG.map(item => [item.id, item]));
  remote.forEach((item: ExerciseCatalogItem) => byId.set(item.id, { ...byId.get(item.id)!, ...item }));
  return [...byId.values()];
}


export async function coachAddProgramBlock(params: {
  athleteId: string; exerciseId: string; day: string; catalogExerciseId: string; name: string; kind: string;
  detail?: string; target?: string; sets?: number; rest?: number; minutes?: number; bandOptions?: string[]; sortOrder?: number; reason?: string;
}) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_add_program_block', {
    p_athlete_id: params.athleteId, p_exercise_id: params.exerciseId, p_day: params.day, p_catalog_exercise_id: params.catalogExerciseId,
    p_name: params.name, p_kind: params.kind, p_detail: params.detail ?? null, p_target: params.target ?? null, p_sets: params.sets ?? null,
    p_rest_sec: params.rest ?? null, p_minutes: params.minutes ?? null, p_band_options: params.bandOptions ?? null, p_sort_order: params.sortOrder ?? 0, p_reason: params.reason ?? null
  });
  if (error) throw error; return data;
}

export async function coachPromoteSkillRung(params:{athleteId:string;day:string;currentExerciseId:string;currentCatalogExerciseId:string;nextCatalogExerciseId:string;name:string;kind:string;detail?:string;target?:string;sets?:number;rest?:number;minutes?:number;bandOptions?:string[];reason?:string}) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_promote_skill_rung', {
    p_athlete_id: params.athleteId, p_day: params.day, p_current_exercise_id: params.currentExerciseId,
    p_current_catalog_exercise_id: params.currentCatalogExerciseId, p_next_catalog_exercise_id: params.nextCatalogExerciseId,
    p_name: params.name, p_kind: params.kind, p_detail: params.detail ?? null, p_target: params.target ?? null,
    p_sets: params.sets ?? null, p_rest_sec: params.rest ?? null, p_minutes: params.minutes ?? null,
    p_band_options: params.bandOptions ?? null, p_reason: params.reason ?? null
  });
  if (error) throw error; return data;
}

export async function coachDeleteProgramBlock(athleteId: string, exerciseId: string, reason?: string) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_delete_program_block', { p_athlete_id: athleteId, p_exercise_id: exerciseId, p_reason: reason ?? null });
  if (error) throw error; return data;
}

export async function coachReorderProgramDay(athleteId: string, day: string, order: {exerciseId:string}[], reason?: string) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_reorder_program_day', { p_athlete_id: athleteId, p_day: day, p_order: order, p_reason: reason ?? null });
  if (error) throw error; return data;
}

export async function fetchCoachAthleteAudit(athleteId: string, limit = 30) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('program_audit_log').select('*').eq('athlete_id', athleteId).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error; return data || [];
}

export async function fetchCoachNotes(athleteId: string, limit = 20) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('coach_notes').select('*').eq('athlete_id', athleteId).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error; return data || [];
}

export async function fetchMyCoachNotes(limit = 10) {
  if (!supabase || !supabaseConfigured) return [];
  const athleteId = await requireUserId();
  const { data, error } = await supabase.from('coach_notes').select('*').eq('athlete_id', athleteId).eq('athlete_visible', true).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error; return data || [];
}

export async function coachRecordDecision(params:{athleteId:string;exerciseId?:string;title:string;detail:string;from?:string;to?:string;reason?:string}) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_record_decision', {
    p_athlete_id: params.athleteId, p_exercise_id: params.exerciseId ?? null, p_title: params.title, p_detail: params.detail,
    p_from_value: params.from ?? null, p_to_value: params.to ?? null, p_reason: params.reason ?? null
  });
  if (error) throw error; return data;
}

export async function createCoachNote(params:{athleteId:string;title:string;body:string;priority?:string;athleteVisible?:boolean}) {
  if (!supabase || !supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('coach_create_note', { p_athlete_id:params.athleteId, p_title:params.title, p_body:params.body, p_priority:params.priority ?? 'normal', p_athlete_visible:params.athleteVisible ?? true });
  if (error) throw error; return data;
}

export async function getBackendStatus(): Promise<BackendStatus> {
  if (!supabaseConfigured || !supabase) return 'disabled';
  const { data, error } = await supabase.auth.getSession();
  if (error) return 'error';
  return data.session ? 'signed_in' : 'signed_out';
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/`,
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

async function requireUserId() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You must be signed in to sync workouts.');
  return data.user.id;
}

export async function uploadWorkoutSession(session: SessionSummary) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const userId = await requireUserId();
  const { error: sessionError } = await supabase.from('workout_sessions').upsert({
    id: session.id,
    user_id: userId,
    day: session.day,
    status: 'completed',
    started_at: new Date(session.date - Math.round(session.durationSec * 1000)).toISOString(),
    completed_at: new Date(session.date).toISOString(),
    duration_sec: session.durationSec,
    total_reps: session.totalReps,
    emom_reps: session.emomReps,
    best_skill_seconds: session.bestSkillSeconds,
    session_note: session.sessionNote ?? null,
    readiness: session.readiness ?? null,
  }, { onConflict: 'id' });
  if (sessionError) throw sessionError;

  const rows = session.logs.map((log: WorkoutLog) => ({
    id: log.id,
    user_id: userId,
    workout_session_id: session.id,
    exercise_id: log.exerciseId,
    exercise_name: log.exerciseName,
    kind: log.kind,
    status: log.status,
    result: log.result,
    modification: log.modification ?? null,
    logged_at: new Date(log.date).toISOString(),
  }));

  if (rows.length) {
    const { error: logsError } = await supabase.from('exercise_logs').upsert(rows, { onConflict: 'id' });
    if (logsError) throw logsError;
  }
}

export async function fetchMySessions(limit = 200) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, exercise_logs(*)')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

function remoteToLocal(rows: any[]): SessionSummary[] {
  return rows.map((row: any) => {
    const date = row.completed_at ? Date.parse(row.completed_at) : Date.parse(row.created_at || new Date().toISOString());
    const logs: WorkoutLog[] = (row.exercise_logs || []).map((log: any) => ({
      id: String(log.id),
      date: Date.parse(log.logged_at || row.completed_at || new Date().toISOString()),
      day: row.day,
      exerciseId: log.exercise_id,
      exerciseName: log.exercise_name,
      kind: log.kind,
      status: log.status,
      result: log.result || {},
      modification: log.modification || undefined,
    }));
    return {
      id: String(row.id),
      date,
      day: row.day,
      durationSec: Number(row.duration_sec || 0),
      readiness: row.readiness || undefined,
      logs,
      totalReps: Number(row.total_reps || 0),
      emomReps: Number(row.emom_reps || 0),
      bestSkillSeconds: Number(row.best_skill_seconds || 0),
      sessionNote: row.session_note || undefined,
    } as SessionSummary;
  });
}

export async function syncLocalSessions(localSessions: SessionSummary[]) {
  if (!supabase || !supabaseConfigured) return { uploaded: 0, remote: 0, pulled: 0 };
  let remote = await fetchMySessions(200);
  const remoteById = new Map<string, any>(remote.map((x: any) => [String(x.id), x]));
  let uploaded = 0;
  for (const session of localSessions) {
    const remoteRow = remoteById.get(String(session.id));
    const remoteDate = remoteRow?.completed_at ? Date.parse(remoteRow.completed_at) : 0;
    if (!remoteRow || session.date >= remoteDate) {
      await uploadWorkoutSession(session);
      uploaded += remoteRow ? 0 : 1;
    }
  }
  remote = await fetchMySessions(200);
  const incoming = remoteToLocal(remote);
  const beforeCount = localSessions.length;
  mergeSessions(incoming);
  const afterCount = JSON.parse(localStorage.getItem('cc-v8-sessions') || '[]').length;
  return { uploaded, remote: remote.length, pulled: Math.max(0, afterCount - beforeCount) };
}

async function getOrCreateActiveProgram(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: existing, error: fetchError } = await supabase
    .from('programs')
    .select('*')
    .eq('athlete_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('programs')
    .insert({
      athlete_id: userId,
      name: 'Calisthenics Coach Program',
      version: 1,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single();
  if (createError) throw createError;
  return created;
}

function localOverrideToPayload(override: any) {
  return {
    ...override,
    syncedAt: Date.now(),
  };
}

function remoteBlockToLocalOverride(row: any) {
  const payload = row.override_payload || {};
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) return null;
  return {
    exerciseId: row.exercise_id,
    name: payload.name ?? row.name,
    detail: payload.detail ?? row.detail ?? undefined,
    kind: payload.kind ?? row.kind,
    target: payload.target ?? row.target ?? undefined,
    sets: payload.sets ?? row.sets ?? undefined,
    rest: payload.rest ?? row.rest_sec ?? undefined,
    minutes: payload.minutes ?? row.minutes ?? undefined,
    bandOptions: payload.bandOptions ?? row.band_options ?? undefined,
    defaultBand: payload.defaultBand ?? row.band_options?.find((b:string)=>b!=="None") ?? undefined,
    updatedAt: Number(payload.updatedAt || Date.parse(row.updated_at || row.created_at || new Date().toISOString())),
    previous: payload.previous ?? null,
    catalogExerciseId: payload.catalogExerciseId ?? row.exercise_id,
  };
}

export async function fetchProgramLayer() {
  if (!supabase || !supabaseConfigured) return null;
  const userId = await requireUserId();
  const program = await getOrCreateActiveProgram(userId);
  const [{ data: blocks, error: blocksError }, { data: decisions, error: decisionsError }] = await Promise.all([
    supabase.from('program_blocks').select('*').eq('program_id', program.id).order('sort_order', { ascending: true }),
    supabase.from('program_decisions').select('*').eq('athlete_id', userId).order('created_at', { ascending: false }).limit(200),
  ]);
  if (blocksError) throw blocksError;
  if (decisionsError) throw decisionsError;
  return { program, blocks: blocks || [], decisions: decisions || [] };
}

export async function syncProgramLayer() : Promise<ProgramLayerSyncResult> {
  if (!supabase || !supabaseConfigured) {
    return { uploadedOverrides: 0, pulledOverrides: 0, uploadedDecisions: 0, pulledDecisions: 0, programId: null };
  }

  const userId = await requireUserId();
  const program = await getOrCreateActiveProgram(userId);
  const localOverrides = getProgramOverrides();
  const localDecisions = getCoachDecisions();
  const remote = await fetchProgramLayer();
  const linkedCoach = await fetchMyCoach().catch(()=>null);

  let uploadedOverrides = 0;
  let pulledOverrides = 0;
  if (!linkedCoach) for (const override of Object.values(localOverrides)) {
    const payload = localOverrideToPayload(override);
    const existing = remote?.blocks?.find((b: any) => b.exercise_id === override.exerciseId);
    const remoteUpdated = Number(existing?.override_payload?.updatedAt || 0);
    if (!existing || Number(override.updatedAt || 0) >= remoteUpdated) {
      const { error } = await supabase.from('program_blocks').upsert({
        id: existing?.id,
        program_id: program.id,
        day: existing?.day || 'unknown',
        exercise_id: override.exerciseId,
        name: override.name || override.exerciseId,
        kind: override.kind || 'PERFORMANCE',
        detail: override.detail || null,
        target: override.target || null,
        sets: override.sets ?? null,
        rest_sec: override.rest ?? null,
        minutes: override.minutes ?? null,
        band_options: override.bandOptions ?? null,
        sort_order: Number(existing?.sort_order || 0),
        override_payload: payload,
      }, { onConflict: 'id' });
      if (error) throw error;
      if (!existing) uploadedOverrides++;
    }
  }

  const latestRemote = await fetchProgramLayer();
  const pulled: Record<string, any> = {};
  const resetIds = new Set<string>((latestRemote?.decisions || [])
    .filter((d:any)=>d.type==='program' && String(d.title||'').startsWith('Coach reset — '))
    .map((d:any)=>String(d.exercise_id || '')));
  for (const id of resetIds) {
    if (id && localOverrides[id]) { clearProgramOverride(id); }
  }
  if (linkedCoach) {
    // Coach-managed programs are server-authoritative. Never let a stale local override win.
    for (const localId of Object.keys(localOverrides)) {
      const remoteBlock=(latestRemote?.blocks || []).find((b:any)=>String(b.exercise_id)===localId);
      if (!remoteBlock || Number(remoteBlock?.override_payload?.updatedAt || 0) >= Number(localOverrides[localId]?.updatedAt || 0)) clearProgramOverride(localId);
    }
  }
  for (const block of latestRemote?.blocks || []) {
    const value = remoteBlockToLocalOverride(block);
    if (!value) continue;
    const local = localOverrides[value.exerciseId];
    if (!local || value.updatedAt >= local.updatedAt) {
      pulled[value.exerciseId] = value;
      if (!local) pulledOverrides++;
    }
  }
  if (Object.keys(pulled).length) mergeProgramLayer(pulled, []);

  let uploadedDecisions = 0;
  const remoteDecisionIds = new Set((latestRemote?.decisions || []).map((d: any) => String(d.id)));
  if (!linkedCoach) for (const decision of localDecisions) {
    if (!decision.id || remoteDecisionIds.has(String(decision.id))) continue;
    const { error } = await supabase.from('program_decisions').insert({
      id: decision.id,
      athlete_id: userId,
      program_id: program.id,
      exercise_id: decision.exerciseId || null,
      type: decision.type,
      title: decision.title,
      detail: decision.detail,
      from_value: decision.from || null,
      to_value: decision.to || null,
      created_by: userId,
      created_at: new Date(decision.date).toISOString(),
    });
    if (error) throw error;
    uploadedDecisions++;
  }

  const remoteDecisions = (latestRemote?.decisions || []).map((d: RemoteProgramDecision) => ({
    id: String(d.id),
    date: Date.parse(d.created_at),
    type: d.type === 'program' || d.type === 'progression' || d.type === 'coach' ? d.type : 'coach',
    exerciseId: d.exercise_id || undefined,
    title: d.title,
    detail: d.detail || '',
    from: d.from_value || undefined,
    to: d.to_value || undefined,
  }));
  const localIds = new Set(localDecisions.map((d) => String(d.id)));
  const newRemoteDecisions = remoteDecisions.filter((d: any) => !localIds.has(String(d.id)));
  if (newRemoteDecisions.length) {
    mergeProgramLayer({}, newRemoteDecisions as import('../storage').CoachDecision[]);
  }

  return {
    uploadedOverrides,
    pulledOverrides,
    uploadedDecisions,
    pulledDecisions: newRemoteDecisions.length,
    programId: String(program.id),
  };
}


export async function uploadMobilitySession(session: MobilitySession){
  if(!supabaseConfigured||!supabase)return {uploaded:false,reason:'disabled'} as const;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {uploaded:false,reason:'signed_out'} as const;
  const {error}=await supabase.from('mobility_sessions').upsert({
    id:session.id, athlete_id:user.id, workout_session_id:session.workoutSessionId, day:session.day,
    status:session.status, duration_sec:session.durationSec, completed_at:new Date(session.date).toISOString(),
  },{onConflict:'id'});
  if(error)throw error;
  if(session.logs.length){
    const rows=session.logs.map(l=>({id:l.id,mobility_session_id:session.id,athlete_id:user.id,workout_session_id:session.workoutSessionId,exercise_id:l.exerciseId,exercise_name:l.exerciseName,kind:l.kind,status:l.status==='complete'?'completed':'skipped',duration_sec:l.durationSec??0,reps:l.reps??null,skipped:!!l.skipped,completed_exercises:l.status==='complete'?1:0,total_exercises:1}));
    const {error:logError}=await supabase.from('mobility_logs').upsert(rows,{onConflict:'id'});
    if(logError)throw logError;
  }
  return {uploaded:true} as const;
}

export async function syncMobilitySessions(){
  if(!supabaseConfigured||!supabase)return {pulled:0,uploaded:0} as const;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {pulled:0,uploaded:0} as const;
  const local=getMobilitySessions();
  for(const s of local) await uploadMobilitySession(s);
  const {data:sessions,error}=await supabase.from('mobility_sessions').select('*').eq('athlete_id',user.id).order('completed_at',{ascending:true});
  if(error)throw error;
  let pulled=0;
  for(const row of sessions||[]){
    const existing=local.find(x=>x.id===row.id);
    if(existing&&existing.date>=Date.parse(row.completed_at))continue;
    const {data:logs,error:logError}=await supabase.from('mobility_logs').select('*').eq('mobility_session_id',row.id).order('created_at',{ascending:true});
    if(logError)throw logError;
    const mapped:MobilitySession={id:String(row.id),workoutSessionId:String(row.workout_session_id),date:Date.parse(row.completed_at),day:row.day,durationSec:Number(row.duration_sec||0),status:row.status,logs:(logs||[]).map((l:any)=>({id:String(l.id),exerciseId:l.exercise_id,exerciseName:l.exercise_name,kind:l.kind,status:l.status,durationSec:l.duration_sec??undefined,reps:l.reps??undefined,skipped:!!l.skipped}))};
    saveMobilitySession(mapped); pulled++;
  }
  return {pulled,uploaded:local.length};
}
