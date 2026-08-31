// Server-side Coach gateway. Keeps the OpenAI API key out of the browser.
// Deploy with Supabase Edge Functions and set OPENAI_API_KEY.

type ToolDef = { type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } };

type RequestBody = {
  question?: string;
  context?: Record<string, unknown>;
  toolSnapshot?: Record<string, unknown>;
  tools?: ToolDef[];
  history?: Array<{ role: 'user'|'assistant'; content: string }>;
};

const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-luna';
const apiKey = Deno.env.get('OPENAI_API_KEY');

const SYSTEM = `Sei il Coach di calisthenics di un atleta avanzato. Rispondi in italiano, direttamente e con prudenza. Usa gli strumenti per verificare i dati prima di dare consigli basati su dati non già presenti. Gli strumenti sono read-only: non puoi modificare il programma. Non inventare valori. Distingui RIR da fatica. Per OAP, FLPU e Front Lever Touch privilegia qualità, ripetibilità, specificità e recupero. Proteggi il volume ipertrofico per muscolo. Non trasformare un singolo risultato in una certezza. Se proponi una modifica, esplicita cosa cambierebbe, perché, come la verificheremo e quali guardrail useremo.`;

function cors(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } });
}

function normalizeTools(input: ToolDef[] | undefined) {
  return (input || []).map(t => ({
    type: 'function',
    name: t.function.name,
    description: t.function.description || '',
    parameters: t.function.parameters || { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  }));
}

function toolResult(name: string, args: Record<string, unknown>, snapshot: Record<string, any>) {
  switch (name) {
    case 'get_goal_status': {
      const goalId = String(args.goalId || '');
      const goal = (snapshot.goals || []).find((g: any) => g.id === goalId);
      return goal ? { ok: true, data: goal } : { ok: false, error: 'Goal non trovato nel contesto.' };
    }
    case 'get_recent_sessions': {
      const limit = Math.max(1, Math.min(12, Number(args.limit || 6)));
      return { ok: true, data: (snapshot.recentSessions || snapshot.sessions || []).slice(0, limit) };
    }
    case 'get_weekly_workload': return { ok: true, data: snapshot.workload || snapshot.weeklyWorkload || {} };
    case 'get_hypertrophy_status': {
      const muscle = String(args.muscle || '').trim().toLowerCase();
      const rows = snapshot.hypertrophy || [];
      return { ok: true, data: muscle ? rows.filter((r: any) => String(r.muscle).toLowerCase() === muscle) : rows };
    }
    case 'get_current_program': {
      const day = String(args.day || 'Monday');
      const program = snapshot.currentProgram || {};
      return { ok: true, data: program[day] ? { day, blocks: program[day] } : program };
    }
    case 'get_active_experiments': return { ok: true, data: snapshot.activeExperiments || [] };
    case 'simulate_program_change': {
      const key = `${String(args.exerciseId || '')}:${String(args.kind || '')}:${Number(args.value || 0)}`;
      const simulation = (snapshot.simulations || {})[key];
      return simulation ? { ok: true, data: simulation } : { ok: false, error: 'Simulazione non disponibile per questa modifica. Usa una variazione di ±1 set o ±1 minuto.' };
    }
    default: return { ok: false, error: `Tool non supportato: ${name}` };
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return cors({ error: 'Method not allowed' }, 405);
  if (!apiKey) return cors({ error: 'OPENAI_API_KEY non configurata.' }, 503);

  let body: RequestBody;
  try { body = await req.json(); } catch { return cors({ error: 'JSON non valido.' }, 400); }
  const question = String(body.question || '').trim();
  if (!question) return cors({ error: 'Domanda mancante.' }, 400);

  const tools = normalizeTools(body.tools);
  const contextText = JSON.stringify({ context: body.context || {}, toolSnapshot: body.toolSnapshot || {} });
  const history = Array.isArray(body.history) ? body.history.slice(-12).filter(m => m && typeof m.content === 'string') : [];
  const input: any[] = [
    { role: 'developer', content: SYSTEM },
    { role: 'developer', content: `Contesto deterministico dell'app (non modificarlo): ${contextText}` },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  try {
    // Responses API function-calling loop: execute only read-only local tools against the supplied snapshot.
    for (let turn = 0; turn < 4; turn += 1) {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, input, tools, store: false }),
      });
      const data = await r.json();
      if (!r.ok) return cors({ error: data?.error?.message || 'OpenAI request failed.' }, r.status);
      const outputs = Array.isArray(data?.output) ? data.output : [];
      let hadToolCall = false;
      for (const item of outputs) {
        if (item?.type === 'function_call') {
          hadToolCall = true;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(item.arguments || '{}'); } catch { args = {}; }
          const result = toolResult(item.name, args, body.toolSnapshot || body.context || {});
          input.push(item);
          input.push({ type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(result) });
        }
      }
      if (!hadToolCall) return cors({ answer: String(data?.output_text || ''), source: 'ai', model, toolCalls: outputs.filter((x:any)=>x?.type==='function_call').map((x:any)=>String(x.name)) });
    }
    return cors({ error: 'Il Coach ha superato il numero massimo di passaggi di verifica.' }, 422);
  } catch (e) {
    return cors({ error: e instanceof Error ? e.message : 'Errore Coach.' }, 500);
  }
});
