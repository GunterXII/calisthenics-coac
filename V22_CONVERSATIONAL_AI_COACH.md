# V22 — Conversational AI Coach

## Obiettivo
Trasformare il pannello Coach da semplice fallback Q&A a un assistente conversazionale che mantiene il filo della conversazione e può verificare il contesto atletico tramite strumenti read-only.

## Flusso
1. L'atleta fa una domanda naturale.
2. Il client invia contesto deterministico + ultime interazioni.
3. Responses API può chiamare tool read-only.
4. I tool leggono goal, sessioni, workload, ipertrofia, programma ed esperimenti.
5. Le simulazioni vengono pre-calcolate dal motore locale e il modello può leggerle, ma non modificarle.
6. Il modello risponde in italiano spiegando evidenze, decisione e guardrail.
7. Una modifica resta una proposal separata e richiede approvazione.

## Guardrail
- Nessuna modifica diretta al programma.
- Nessun valore inventato.
- Una singola variabile per proposta.
- La simulazione è read-only.
- La cronologia conversazionale è limitata alle ultime 12 interazioni inviate.
- Il fallback locale continua a funzionare se Supabase/OpenAI non è disponibile.

## Dati esposti ai tool
- 5 obiettivi: OAP, FLPU, Front Lever Touch, push-up, dips.
- ultime 12 sessioni.
- workload e recovery.
- volume ipertrofico per muscolo.
- skill readiness.
- esperimenti attivi.
- programma corrente per giorno.
- simulazioni deterministiche limitate a +/- 1 set e +/- 1 minuto EMOM.
