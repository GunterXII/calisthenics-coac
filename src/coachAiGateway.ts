import { supabase, supabaseConfigured } from './lib/supabase';
import type { CoachContext } from './coachAdvisorEngine';
import { COACH_TOOL_DEFINITIONS, buildCoachToolSnapshot } from './coachTools';
import { runCoachAgent } from './coachAgentEngine';

export type CoachMessage = { role:'user'|'assistant'; content:string; createdAt:number; source?:'ai'|'rules'; toolCalls?:string[] };

function selectCoachTools(question:string){
  const q=question.trim().toLowerCase();
  if(!q) return [];
  // Greetings/small talk should never spend a tool round.
  if(/^(ciao|hey|ehi|salve|buongiorno|buonasera)(?:\s+(?:come stai|tutto bene))?[!?.,\s]*$/i.test(q)) return [];

  const selected = new Set<string>();
  const add=(...names:string[])=>names.forEach(n=>selected.add(n));

  if(/fase|periodizz|accumulation|intensification|realization|settimana|mesociclo|blocco/.test(q)) {
    // Phase is already in deterministic context; no tool required.
  }
  if(/volume|ipertrofi|muscol|chest|petto|tricip|deltoid|spalla|serie produttive/.test(q)) add('get_hypertrophy_status');
  if(/fatica|fatigue|recuper|readiness|stanchezza|carico/.test(q)) add('get_weekly_workload');
  if(/ultim|session|allenament|workout|performance|prestaz|oggi|ieri|settimana scorsa|peggior|miglior|fallit|pers|linea|qualit|esecuzion/.test(q)) add('get_recent_sessions');
  if(/oap|one arm/.test(q)) add('get_goal_status');
  if(/front lever pull|flpu/.test(q)) add('get_goal_status');
  if(/front lever touch|touch/.test(q)) add('get_goal_status');
  if(/push.?up|piegament/.test(q)) add('get_goal_status');
  if(/dip/.test(q)) add('get_goal_status');
  if(/modific|cambiare|cambio|aument|ridurre|aggiung|togli|programma|scheda|prescrizion/.test(q)) {
    add('get_current_program','get_weekly_workload','get_hypertrophy_status','get_active_experiments');
    if(/oap|one arm|flpu|front lever|touch|push.?up|piegament|dip/.test(q)) add('get_goal_status');
  }
  if(/esperiment|experiment/.test(q)) add('get_active_experiments');
  if(/quanto|quante|quale|quali|trend|stato|progres|cosa ne pensi|analizza|valuta|consiglio/.test(q) && selected.size===0) {
    add('get_recent_sessions','get_weekly_workload','get_hypertrophy_status');
  }

  return COACH_TOOL_DEFINITIONS.filter(t=>selected.has(t.function.name) || (selected.has('get_current_program') && t.function.name==='simulate_program_change'));
}

function isSimpleGreeting(question:string){
  return /^(ciao|hey|ehi|salve|buongiorno|buonasera)(?:\\s+(?:come stai|tutto bene))?[!?.,\\s]*$/i.test(question.trim());
}

export async function askCoach(question:string, context:CoachContext, history:CoachMessage[] = []):Promise<CoachMessage>{
  // Small talk never enters the AI/tool pipeline: no latency, no tool calls, no fake "verified data".
  if(isSimpleGreeting(question)){
    return {role:'assistant',content:'Ciao! Sono pronto. Dimmi cosa vuoi analizzare o modificare del tuo allenamento.',createdAt:Date.now(),source:'rules',toolCalls:[]};
  }
  if(supabase && supabaseConfigured){
    try{
      const selectedTools=selectCoachTools(question);
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: {
          question,
          context: serializeCoachContext(context),
          toolSnapshot: buildCoachToolSnapshot(context),
          tools: selectedTools,
          history: history.filter(m=>m.role==='user'||m.role==='assistant').slice(-12).map(m=>({role:m.role,content:m.content})),
        },
      });
      if(!error && data?.answer){
        return {role:'assistant',content:String(data.answer),createdAt:Date.now(),source:'ai',toolCalls:Array.isArray(data.toolCalls)?data.toolCalls:[]};
      }
    }catch{}
  }
  const local = runCoachAgent(question, context);
  // Local facts are not OpenAI tool calls. Do not label deterministic rules as "dati verificati".
  return {role:'assistant',content:local.recommendation,createdAt:Date.now(),source:'rules',toolCalls:[]};
}

export function serializeCoachContext(context:CoachContext){
  return {
    phase:{id:context.phase.id,type:context.phase.type,week:context.phase.week,totalWeeks:context.phase.totalWeeks,weights:context.phase.adaptationWeights,fatigueBudget:context.phase.fatigueBudget},
    goals:context.goals.map(g=>({id:g.goal.id,current:g.current,target:g.target,best:g.best,status:g.status,trend:g.trendPct/100,confidence:g.confidence})),
    recentSessions:context.sessions.slice(0,6).map(s=>({date:s.date,day:s.day,totalReps:s.totalReps,bestSkillSeconds:s.bestSkillSeconds,readiness:s.readiness,logs:s.logs.map(l=>({exerciseId:l.exerciseId,name:l.exerciseName,kind:l.kind,status:l.status,result:l.result,prescription:l.prescription}))})),
    insights:context.insights,
    weeklyFatigue:context.weeklyFatigue,
    recoveryStatus:context.recoveryStatus,
  };
}

export const COACH_AI_SYSTEM_SPEC = `Sei il Coach di calisthenics integrato in un'app di allenamento. Ricevi contesto deterministico generato dall'app: fase corrente, obiettivi, sessioni recenti, recupero, fatica, qualità e volume ipertrofico. Spiega cosa indicano i dati e proponi modifiche conservative, specifiche e verificabili. Non inventare valori. Distingui RIR (ripetizioni pulite ancora disponibili) da fatica (quanto è pesata la serie). Proteggi le skill prioritarie e una dose sufficiente di ipertrofia. Quando suggerisci una modifica indica esercizio, prescrizione attuale se nota, nuova prescrizione, motivo e come verificheremo la scelta. Puoi consultare strumenti strutturati per verificare goal, sessioni, workload, ipertrofia, programma ed esperimenti. Usa gli strumenti prima di dare consigli che dipendono da dati non già presenti nel contesto. La simulazione del programma è sola lettura. Non creare una modifica strutturata se non puoi indicare l'evidenza che la sostiene. Non modificare mai il piano in silenzio. Non trasformare un singolo risultato in una certezza: usa trend, qualità, esposizioni comparabili e recupero. Se il dolore articolare è >=3/5, non spingere la progressione e suggerisci di ridurre/evitare il movimento provocativo e di rivolgersi a un professionista se persiste. Rispondi in italiano, in modo diretto e pratico.`;
