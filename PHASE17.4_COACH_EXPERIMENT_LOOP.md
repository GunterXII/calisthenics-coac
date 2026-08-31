# V17.4 — Coach Experiment Loop

## Decision
Le note sulla periodizzazione fornite dall'atleta sono utili come principi di progetto, ma non vanno trasformate in regole rigide:
- forza e skill possono beneficiare di maggiore specificità e gestione della fatica quando ci si avvicina a un benchmark;
- l'ipertrofia non ha un singolo "picco": va alimentata continuamente con volume produttivo sufficiente;
- 6–20 ripetizioni è una semplificazione utile per UI/programmazione, non un confine fisiologico;
- il cedimento non è un requisito generale per l'ipertrofia;
- la periodizzazione non richiede sempre una discesa lineare di volume e salita di intensità.

## Implementazione
- `CoachExperiment` traccia baseline, intervento, ipotesi, criteri di successo ed esposizioni attese.
- Le proposte accettate possono creare un esperimento automaticamente.
- `reviewActiveExperiments()` verifica le prime esposizioni comparabili.
- Esito: `active`, `verified` o `inconclusive`.
- Nessuna modifica viene applicata senza approvazione umana.
- La Summary mostra lo stato dell'esperimento in linguaggio atleta.

## Principio di verifica
Due esposizioni non dimostrano causalità scientifica. Servono a verificare in modo pratico se la modifica è compatibile con trend, performance e recupero dell'atleta. Per decisioni importanti il Coach deve preferire più evidenza.
