import type { CoachContext } from './coachAdvisorEngine';
import type { CoachProposal, DayKey, ExerciseBlock, GoalId, MuscleGroup } from './types';
import { saveCoachProposal, getCoachProposals } from './storage';
import { buildAdaptivePeriodizedDay } from './adaptiveProgramEngine';
import { executeCoachTool } from './coachTools';
import { simulateProgramImpact, type GoalProtection, type ImpactAction, type ProgramImpact } from './coachImpactEngine';

export type ProposalAction = ImpactAction;

export interface ProposalEvidence {
  label: string;
  value: string;
}

export interface CoachProposalDraft {
  proposal: Omit<CoachProposal, 'id' | 'date'>;
  action: ProposalAction;
  exerciseId: string;
  evidence: ProposalEvidence[];
  confidence: number;
  warnings: string[];
  goalProtection: GoalProtection[];
  impact: ProgramImpact | null;
}

function dayOrder(context: CoachContext): DayKey[] {
  const fallback: DayKey[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  return (context.sessions.map(s => s.day).filter((x, i, a) => a.indexOf(x) === i) as DayKey[])
    .concat(fallback)
    .filter((x, i, a) => a.indexOf(x) === i);
}

function allBlocks(context: CoachContext): ExerciseBlock[] {
  const goals: GoalId[] = ['oap','flpu','front_lever_touch','pushups','dips'];
  return dayOrder(context).flatMap(day => buildAdaptivePeriodizedDay(context.phase, day, goals, context.sessions).program.blocks.map(b => ({ ...b, day })));
}

function isHypertrophyQuestion(q: string) {
  return /ipertrofi|massa|muscol|volume|serie|set|chest|petto|tricip|deltoid|spalla/.test(q);
}

function requestedMuscles(context: CoachContext, q: string): MuscleGroup[] {
  const explicit: Array<[RegExp, MuscleGroup]> = [
    [/side.?delt|deltoid.*later|spalla.*later/, 'side_delts'],
    [/front.?delt|deltoid.*front|spalla.*front/, 'front_delts'],
    [/triceps?|tricipit/, 'triceps'],
    [/chest|petto|pettorale/, 'chest'],
  ];
  const hit = explicit.filter(([re]) => re.test(q)).map(([, m]) => m);
  if (hit.length) return hit;
  return (context.hypertrophy || [])
    .filter(x => x.status === 'LOW')
    .sort((a,b) => a.currentSets - b.currentSets)
    .slice(0, 4)
    .map(x => x.muscle);
}

function chooseBlock(context: CoachContext, query = ''): ExerciseBlock | undefined {
  const blocks = allBlocks(context);
  const q = query.toLowerCase();
  const dayMatch = q.match(/push\s*([abc])|pull\s*([abc])/i);
  const requestedDay: DayKey | undefined = dayMatch
    ? (/^push/i.test(dayMatch[0]) ? ({a:'Monday',b:'Wednesday',c:'Friday'} as const)[String(dayMatch[1]).toLowerCase() as 'a'|'b'|'c'] : ({a:'Tuesday',b:'Thursday',c:'Saturday'} as const)[String(dayMatch[2]).toLowerCase() as 'a'|'b'|'c'])
    : undefined;
  const scoped = requestedDay ? blocks.filter(b => b.day === requestedDay) : blocks;
  // Ignore protected-goal mentions such as "without compromising OAP" when
  // resolving the exercise the user actually wants to change.
  const targetText = q
    .replace(/senza\s+(?:compromettere|peggiorare|sacrificare)\s+(?:oap|flpu|front lever(?: touch| pull-up)?|push.?up|piegament|dip)[^.!?]*/gi, '')
    .replace(/protegg(?:ere|endo)\s+(?:oap|flpu|front lever(?: touch| pull-up)?|push.?up|piegament|dip)[^.!?]*/gi, '');
  const patterns: Array<[string, RegExp]> = [
    ['oap', /oap|one arm|trazione a un braccio/],
    ['flpu', /flpu|front lever pull/],
    ['front_lever_touch', /front lever touch|touch/],
    ['pushups', /push.?up|piegamenti/],
    ['dips', /dip/],
  ];

  // Explicit exercise/goal requests always win.
  for (const [, regex] of patterns) {
    if (regex.test(targetText)) {
      const hit = scoped.find(b => regex.test(b.name.toLowerCase()) || regex.test(b.id.toLowerCase()));
      if (hit) return hit;
    }
  }

  // For hypertrophy questions without a named exercise, choose the lowest-volume
  // muscle and prefer a support/accessory block that isolates it.
  if (isHypertrophyQuestion(q)) {
    const wanted = requestedMuscles(context, q);
    for (const muscle of wanted) {
      const candidates = scoped
        .filter(b => (b.muscleGroups || []).includes(muscle))
        .sort((a,b) => {
          const ar = a.trainingRole === 'hypertrophy' ? 0 : a.priority === 'support' ? 1 : a.trainingRole === 'strength' ? 2 : 3;
          const br = b.trainingRole === 'hypertrophy' ? 0 : b.priority === 'support' ? 1 : b.trainingRole === 'strength' ? 2 : 3;
          const order:Record<string,number>={Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
          return ar - br || (order[a.day||'Monday']??99) - (order[b.day||'Monday']??99);
        });
      if (candidates[0]) return candidates[0];
    }
  }

  return scoped.find(b => ['skill','strength'].includes(String(b.trainingRole))) || scoped[0] || blocks.find(b => ['skill','strength'].includes(String(b.trainingRole))) || blocks[0];
}

function numericTarget(target: string | undefined): { lo?: number; hi?: number } {
  if (!target) return {};
  const nums = target.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return nums.length >= 2 ? { lo: nums[0], hi: nums[1] } : nums.length === 1 ? { lo: nums[0], hi: nums[0] } : {};
}

function targetLowMuscle(context: CoachContext, block: ExerciseBlock, q: string): MuscleGroup | undefined {
  const wanted = requestedMuscles(context, q);
  const low = new Set((context.hypertrophy || []).filter(x => x.status === 'LOW').map(x => x.muscle));
  return (wanted.find(m => low.has(m)) || (block.muscleGroups || []).find(m => low.has(m)) || wanted[0]);
}

function suggest(context: CoachContext, question: string): CoachProposalDraft | null {
  const q = question.toLowerCase();
  const block = chooseBlock(context, q);
  if (!block) return null;

  const isAdd = /aument|aggiung|piu|\+\s*1|increase|more/.test(q);
  const isRemove = /riduc|togli|meno|decreas|remove/.test(q);
  const isVolume = /volume|serie|set/.test(q) || isHypertrophyQuestion(q);
  const isMinutes = /emom|minut/.test(q);
  if (!isAdd && !isRemove) return null;

  let action: ProposalAction;
  let from = '';
  let to = '';
  let detail = '';
  let title = '';
  const warnings: string[] = [];
  const evidence: ProposalEvidence[] = [];

  if (isMinutes && block.kind === 'EMOM') {
    action = 'CHANGE_MINUTES';
    const current = block.minutes || 10;
    const delta = isAdd ? 1 : -1;
    const next = Math.max(5, Math.min(15, current + delta));
    from = `${current} min`;
    to = `${next} min`;
    title = `${isAdd ? 'Aumenta' : 'Riduci'} EMOM — ${block.name}`;
    detail = 'Modifica di 1 minuto sull’EMOM, mantenendo il resto della seduta invariato.';
  } else if (isVolume || block.kind !== 'EMOM') {
    action = isAdd ? 'ADD_SET' : 'REMOVE_SET';
    const current = Math.max(1, block.sets || 1);
    if (isRemove && current <= 1) return null;
    const next = Math.max(1, current + (isAdd ? 1 : -1));
    from = `${current} serie`;
    to = `${next} serie`;
    title = `${isAdd ? 'Aumenta' : 'Riduci'} volume — ${block.name}`;
    detail = 'Variazione di una sola serie; nessun altro parametro viene cambiato.';
  } else {
    const target = numericTarget(block.target);
    if (target.hi == null) return null;
    action = 'CHANGE_TARGET';
    const next = Math.max(1, target.hi + (isAdd ? 1 : -1));
    from = block.target || String(target.hi);
    to = `${next}`;
    title = `${isAdd ? 'Aumenta' : 'Riduci'} target — ${block.name}`;
    detail = 'Modifica conservativa del target, senza cambiare la variante.';
  }

  const requestedValue = action === 'ADD_SET' || action === 'REMOVE_SET'
    ? 1
    : action === 'CHANGE_MINUTES'
      ? Number(to.replace(/\D/g,''))
      : Number(to);

  const impact = simulateProgramImpact(context, block.id, action, requestedValue);
  const tool = executeCoachTool({ name: 'simulate_program_change', arguments: { exerciseId: block.id, kind: action, value: requestedValue } }, context);
  if (!tool.ok || !impact) warnings.push('La simulazione preventiva non è disponibile per questa modifica.');

  if (impact) {
    evidence.push({ label: 'Costo fatica stimato', value: `${impact.delta.fatigue > 0 ? '+' : ''}${impact.delta.fatigue}` });
    evidence.push({ label: 'Fatica settimanale stimata', value: `${impact.weekly.fatigueUtilizationPct.toFixed(0)}% del budget` });
    evidence.push({ label: 'Impatto', value: impact.verdict === 'LOW_IMPACT' ? 'Basso' : impact.verdict === 'WATCH' ? 'Da monitorare' : 'Alto' });
    if (impact.delta.hypertrophy > 0) evidence.push({ label: 'Stimolo ipertrofico', value: `+${impact.delta.hypertrophy.toFixed(2)} dose interna` });
    warnings.push(...impact.warnings.slice(0, 2));
  }

  const requestedMuscle = targetLowMuscle(context, block, q);
  if (requestedMuscle) {
    const row = (context.hypertrophy || []).find(x => x.muscle === requestedMuscle);
    if (row) evidence.push({ label: 'Gap ipertrofico', value: `${row.muscle.replaceAll('_',' ')} · ${row.currentSets.toFixed(1)} serie produttive · ${row.status}` });
  }

  const goal = context.goals.find(g => q.includes(g.goal.id) || q.includes(String(g.goal.label || g.goal.id).toLowerCase()));
  if (goal) evidence.push({ label: 'Goal', value: `${goal.goal.label}: ${goal.current}/${goal.target}` });
  evidence.push({ label: 'Fase', value: context.phase.type });
  evidence.push({ label: 'Recupero', value: context.recoveryStatus });

  let confidence = 0.58;
  if (goal?.status === 'PROGRESSING') confidence += 0.12;
  if (context.recoveryStatus === 'FRESH' || context.recoveryStatus === 'RECOVERING') confidence += 0.08;
  if (context.recoveryStatus === 'FATIGUED' || context.recoveryStatus === 'HIGH_FATIGUE') {
    confidence -= 0.18;
    warnings.push('Recupero basso: il Coach dovrebbe preferire mantenimento o riduzione dei secondari.');
  }
  if (block.priority === 'primary') warnings.push('Questa è una parte prioritaria del programma: aumentala solo se performance e tecnica sono stabili.');

  const goalProtection = impact?.goalProtection || [];
  for (const gp of goalProtection.filter(x => x.status !== 'PROTECTED')) warnings.push(gp.reason);

  return {
    proposal: {
      type: 'program_review',
      exerciseId: block.id,
      title,
      detail,
      from,
      to,
      reason: `Proposta generata con contesto ${context.phase.type}: ${requestedMuscle ? `priorità al gap ${requestedMuscle.replaceAll('_',' ')}` : 'modifica una sola variabile'} e verifica preventiva dell'impatto.`,
      status: 'pending',
      sessionId: context.sessions[0]?.id,
    },
    action,
    exerciseId: block.id,
    evidence,
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings: [...new Set(warnings)],
    goalProtection,
    impact,
  };
}

export function buildCoachProposalDraft(context: CoachContext, question: string): CoachProposalDraft | null {
  return suggest(context, question);
}

export function saveCoachProposalDraft(draft: CoachProposalDraft): CoachProposal {
  const existing = getCoachProposals().find(p => p.status === 'pending' && p.exerciseId === draft.exerciseId && p.from === draft.proposal.from && p.to === draft.proposal.to);
  if (existing) return existing;
  return saveCoachProposal(draft.proposal);
}
