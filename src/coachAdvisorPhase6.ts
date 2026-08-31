import { answerCoachQuestion, buildCoachContext, deterministicCoachBrief, type CoachContext, type CoachInsight } from './coachAdvisorEngine';

export interface CoachAdvisorView {
  headline: string;
  primary: CoachInsight;
  secondary: CoachInsight[];
  context: CoachContext;
}

/**
 * Phase 6 adapter: turns the deterministic coaching context into a stable
 * presentation contract. It does not mutate workouts, prescriptions or data.
 */
export function buildCoachAdvisorView(sessions?: Parameters<typeof buildCoachContext>[0]): CoachAdvisorView {
  const context = buildCoachContext(sessions);
  const [primary, ...secondary] = context.insights;
  return {
    headline: primary?.title || 'Nessun problema prioritario',
    primary: primary || { id: 'steady', title: 'Nessun problema prioritario', body: 'Continua il piano.', tone: 'GOOD', priority: 0 },
    secondary: secondary.slice(0, 2),
    context,
  };
}

export function coachAnswer(question: string, sessions?: Parameters<typeof buildCoachContext>[0]): string {
  const context = buildCoachContext(sessions);
  return answerCoachQuestion(question, context);
}

export function coachBrief(sessions?: Parameters<typeof buildCoachContext>[0]): string {
  return deterministicCoachBrief(buildCoachContext(sessions));
}
