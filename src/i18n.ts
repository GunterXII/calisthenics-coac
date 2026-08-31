export type Locale = 'it' | 'en';

export const IT: Record<string,string> = {
  today:'OGGI', plan:'PIANO', reports:'REPORT', coach:'COACH', settings:'IMPOSTAZIONI',
  start:'INIZIA', resume:'RIPRENDI', discard:'ELIMINA', close:'CHIUDI', save:'SALVA',
  cancel:'ANNULLA', back:'INDIETRO', next:'AVANTI', done:'FATTO', skip:'SALTA', edit:'MODIFICA',
  refresh:'AGGIORNA', export:'ESPORTA', copy:'COPIA', accept:'ACCETTA', reject:'RIFIUTA',
  workout:'ALLENAMENTO', completedSession:'SESSIONE COMPLETATA', sessionReport:'REPORT SESSIONE',
  sessionSaved:'Sessione salvata.', workoutComplete:'ALLENAMENTO COMPLETATO',
  phase:'FASE', week:'SETTIMANA', status:'STATO', current:'ATTUALE', proposed:'PROPOSTA',
  latest:'ULTIMO', best:'MIGLIORE', delta:'VARIAZIONE', exposures:'ESPOSIZIONI',
  reps:'RIPETIZIONI', time:'TEMPO', duration:'DURATA', notes:'NOTE', note:'NOTA',
  rir:'RIR', fatigue:'FATICA', effort:'SFORZO', quality:'QUALITÀ', recovery:'RECUPERO',
  hypertrophy:'IPERTROFIA', endurance:'RESISTENZA', strength:'FORZA', skill:'SKILL',
  questionCoach:'Chiedi al tuo Coach.', askCoach:'Chiedi al Coach',
  coachReview:'REVISIONE COACH', reviewLast:'Analizza l\'ultimo allenamento',
  reviewing:'Analisi in corso…', noRecent:'Non ci sono ancora abbastanza dati per una revisione affidabile.',
  focus:'FOCUS', reason:'MOTIVO', decision:'DECISIONE', recommendation:'RACCOMANDAZIONE',
  changes:'MODIFICHE', noChange:'Nessuna modifica necessaria.',
  rirQuestion:'Quante ripetizioni pulite avevi ancora?',
  fatigueQuestion:'Quanto ti ha pesato la serie?',
  rirHint:'0 = nessuna · 1 = una · 2 = due · 3+ = tre o più',
  fatigueHint:'1 = facile · 2 = leggera · 3 = impegnativa · 4 = molto dura · 5 = quasi esausto',
  noNeedExact:'Non serve azzeccare il numero perfetto: il Coach guarda soprattutto il trend.',
  noMajorRedFlags:'Nessun problema evidente.',
  localCoach:'Coach locale', aiCoach:'Coach AI', rulesFallback:'Risposta del motore Coach',
  send:'INVIA', clearChat:'CANCELLA CHAT', tryAsking:'PROVA A CHIEDERE',
  noCompletedSessions:'Nessuna sessione completata.', noProgramHistory:'Nessuna cronologia programma.',
  settingsTitle:'Impostazioni app.', settingsSub:'Profilo, collegamento Coach e dati locali sono separati dai report di performance.',
  synced:'SINCRONIZZATO', syncing:'SINCRONIZZAZIONE', localMode:'MODALITÀ LOCALE',
  phaseAccumulation:'ACCUMULO', phaseOap:'ENFASI OAP', phaseFl:'ENFASI FRONT LEVER', phaseEndurance:'ENFASI RESISTENZA',
  phaseRealization:'REALIZZAZIONE', phaseDeload:'SCARICO', coachToday:'OGGI DAL COACH', coachWhy:'PERCHÉ', coachChanges:'COSA È CAMBIATO', coachReviewSaved:'Revisione salvata', stimulus:'STIMOLO',
};

export const EN: Record<string,string> = {
  today:'TODAY', plan:'PLAN', reports:'REPORTS', coach:'COACH', settings:'SETTINGS', start:'START', resume:'RESUME', discard:'DISCARD', close:'CLOSE', save:'SAVE', cancel:'CANCEL', back:'BACK', next:'NEXT', done:'DONE', skip:'SKIP', edit:'EDIT', refresh:'REFRESH', export:'EXPORT', copy:'COPY', accept:'ACCEPT', reject:'REJECT', workout:'WORKOUT', completedSession:'COMPLETED SESSION', sessionReport:'SESSION REPORT', sessionSaved:'Session saved.', workoutComplete:'WORKOUT COMPLETE', phase:'PHASE', week:'WEEK', status:'STATUS', current:'CURRENT', proposed:'PROPOSED', latest:'LATEST', best:'BEST', delta:'DELTA', exposures:'EXPOSURES', reps:'REPS', time:'TIME', duration:'DURATION', notes:'NOTES', note:'NOTE', rir:'RIR', fatigue:'FATIGUE', effort:'EFFORT', quality:'QUALITY', recovery:'RECOVERY', hypertrophy:'HYPERTROPHY', endurance:'ENDURANCE', strength:'STRENGTH', skill:'SKILL', questionCoach:'Ask your Coach.', askCoach:'Ask Coach', coachReview:'COACH REVIEW', reviewLast:'Review latest workout', reviewing:'Reviewing…', noRecent:'Not enough data for a reliable review yet.', focus:'FOCUS', reason:'REASON', decision:'DECISION', recommendation:'RECOMMENDATION', changes:'CHANGES', noChange:'No change needed.', rirQuestion:'How many clean reps did you have left?', fatigueQuestion:'How hard did the set feel?', rirHint:'0 = none · 1 = one · 2 = two · 3+ = three or more', fatigueHint:'1 = easy · 2 = light · 3 = challenging · 4 = very hard · 5 = near exhausted', noNeedExact:'You do not need perfect precision: the Coach looks mainly at the trend.', noMajorRedFlags:'No major red flags.', localCoach:'Local Coach', aiCoach:'AI Coach', rulesFallback:'Coach engine response', send:'SEND', clearChat:'CLEAR CHAT', tryAsking:'TRY ASKING', noCompletedSessions:'No completed sessions.', noProgramHistory:'No program history.', settingsTitle:'App settings.', settingsSub:'Profile, coach connection and local data stay outside performance reports.', synced:'SYNCED', syncing:'SYNCING', localMode:'LOCAL MODE', phaseAccumulation:'ACCUMULATION', phaseOap:'OAP EMPHASIS', phaseFl:'FRONT LEVER EMPHASIS', phaseEndurance:'ENDURANCE EMPHASIS', phaseRealization:'REALIZATION', phaseDeload:'DELOAD',
};

export function t(key:string, locale:Locale='it'):string { return (locale==='it'?IT:EN)[key] ?? key; }
export function dayLabel(day:string, locale:Locale='it') {
  const map:Record<string,string> = locale==='it'
    ? {Monday:'Lunedì',Tuesday:'Martedì',Wednesday:'Mercoledì',Thursday:'Giovedì',Friday:'Venerdì',Saturday:'Sabato',Sunday:'Domenica'}
    : {Monday:'Monday',Tuesday:'Tuesday',Wednesday:'Wednesday',Thursday:'Thursday',Friday:'Friday',Saturday:'Saturday',Sunday:'Sunday'};
  return map[day] ?? day;
}
export function phaseLabel(type:string, locale:Locale='it') {
  const map:Record<string,string> = locale==='it'
    ? {ACCUMULATION:t('phaseAccumulation'),OAP_EMPHASIS:t('phaseOap'),FL_EMPHASIS:t('phaseFl'),ENDURANCE_EMPHASIS:t('phaseEndurance'),REALIZATION:t('phaseRealization'),DELOAD:t('phaseDeload')}
    : {ACCUMULATION:t('phaseAccumulation','en'),OAP_EMPHASIS:t('phaseOap','en'),FL_EMPHASIS:t('phaseFl','en'),ENDURANCE_EMPHASIS:t('phaseEndurance','en'),REALIZATION:t('phaseRealization','en'),DELOAD:t('phaseDeload','en')};
  return map[type] ?? type.replaceAll('_',' ');
}
