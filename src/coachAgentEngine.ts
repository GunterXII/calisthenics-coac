import { answerCoachQuestion, type CoachContext } from './coachAdvisorEngine';
import { executeCoachTool, type CoachToolCall, type CoachToolResult } from './coachTools';
import { buildCoachProposalDraft, type CoachProposalDraft } from './coachProposalEngine';

export interface CoachAgentRun {
  facts: CoachToolResult[];
  recommendation: string;
  proposal?: CoachProposalDraft;
}

/** Deterministic orchestration layer used before/alongside the LLM gateway.
 * It prevents the natural-language layer from making claims without refreshed data.
 */
export function runCoachAgent(question: string, context: CoachContext): CoachAgentRun {
  const facts:CoachToolResult[]=[];
  const q=question.toLowerCase();
  const calls:CoachToolCall[]=[
    {name:'get_recent_sessions',arguments:{limit:6}},
    {name:'get_weekly_workload'},
    {name:'get_hypertrophy_status'},
    {name:'get_active_experiments'},
  ];
  if(/oap|one arm|trazione a un braccio/.test(q)) calls.unshift({name:'get_goal_status',arguments:{goalId:'oap'}});
  else if(/front lever pull|flpu/.test(q)) calls.unshift({name:'get_goal_status',arguments:{goalId:'flpu'}});
  else if(/touch|front lever touch/.test(q)) calls.unshift({name:'get_goal_status',arguments:{goalId:'front_lever_touch'}});
  else if(/push.?up|piegamenti/.test(q)) calls.unshift({name:'get_goal_status',arguments:{goalId:'pushups'}});
  else if(/dip/.test(q)) calls.unshift({name:'get_goal_status',arguments:{goalId:'dips'}});
  for(const call of calls) facts.push(executeCoachTool(call,context));
  const recommendation=answerCoachQuestion(question,context);
  const proposal=buildCoachProposalDraft(context,question)||undefined;
  return {facts,recommendation,proposal};
}
