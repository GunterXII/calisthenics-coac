const ANALYTICS_KEY = "cc-v1-analytics-events";
const ANALYTICS_ID_KEY = "cc-v1-analytics-anonymous-id";
const MAX_EVENTS = 2000;

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsEvent = {
  id: string;
  name: string;
  timestamp: number;
  path: string;
  properties: Record<string, AnalyticsValue>;
};

function safeRandomId(){
  try{return crypto.randomUUID()}
  catch{return `${Date.now()}-${Math.random().toString(36).slice(2)}`}
}

function getAnonymousId(){
  try{
    const existing = localStorage.getItem(ANALYTICS_ID_KEY);
    if(existing) return existing;
    const id = safeRandomId();
    localStorage.setItem(ANALYTICS_ID_KEY,id);
    return id;
  }catch{return "local-anonymous"}
}

function getEvents():AnalyticsEvent[]{
  try{
    const value = JSON.parse(localStorage.getItem(ANALYTICS_KEY)||"[]");
    return Array.isArray(value) ? value : [];
  }catch{return []}
}

function isEnabled(){
  try{return import.meta.env?.VITE_ANALYTICS_ENABLED !== "false"}
  catch{return true}
}

async function sendPostHog(event:AnalyticsEvent){
  try{
    const apiKey = String(import.meta.env?.VITE_POSTHOG_KEY||"").trim();
    if(!apiKey) return;
    const host = String(import.meta.env?.VITE_POSTHOG_HOST||"https://us.i.posthog.com").replace(/\/$/,"");
    await fetch(`${host}/capture/`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      keepalive:true,
      body:JSON.stringify({
        api_key:apiKey,
        event:event.name,
        distinct_id:getAnonymousId(),
        properties:{...event.properties, path:event.path, source:"calisthenics-coach"},
        timestamp:new Date(event.timestamp).toISOString(),
      }),
    });
  }catch{}
}

export function track(name:string, properties:Record<string,AnalyticsValue>={}){
  if(!isEnabled() || typeof window === "undefined") return;
  const event:AnalyticsEvent={
    id:safeRandomId(),
    name,
    timestamp:Date.now(),
    path:window.location.pathname,
    properties,
  };
  try{
    const next=[...getEvents(),event].slice(-MAX_EVENTS);
    localStorage.setItem(ANALYTICS_KEY,JSON.stringify(next));
  }catch{}
  void sendPostHog(event);
}

export function trackScreen(screen:string){track("screen_viewed",{screen})}

export function analyticsEvents(){return getEvents()}

export function analyticsSummary(){
  const events=getEvents();
  const byEvent=new Map<string,number>();
  const byScreen=new Map<string,number>();
  for(const e of events){
    byEvent.set(e.name,(byEvent.get(e.name)||0)+1);
    if(e.name==="screen_viewed"){
      const screen=String(e.properties.screen||"unknown");
      byScreen.set(screen,(byScreen.get(screen)||0)+1);
    }
  }
  const top=(m:Map<string,number>)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  return {totalEvents:events.length,topEvents:top(byEvent),topScreens:top(byScreen),firstEvent:events[0]?.timestamp,lastEvent:events.at(-1)?.timestamp};
}

export function exportAnalytics(){
  return JSON.stringify({schemaVersion:1,anonymousId:getAnonymousId(),exportedAt:Date.now(),events:getEvents()},null,2);
}

export function clearAnalytics(){
  try{localStorage.removeItem(ANALYTICS_KEY)}catch{}
}


export type AnalyticsFunnelStep = {name:string; count:number; rate:number};
export type ExerciseFriction = {
  exerciseId:string;
  started:number;
  completed:number;
  skipped:number;
  substituted:number;
  terminal:number;
  completionRate:number;
  frictionRate:number;
};

function countBy(events:AnalyticsEvent[], predicate:(e:AnalyticsEvent)=>boolean){
  return events.reduce((n,e)=>n+(predicate(e)?1:0),0);
}

function mapCounts(events:AnalyticsEvent[], selector:(e:AnalyticsEvent)=>string|undefined){
  const out=new Map<string,number>();
  for(const e of events){
    const key=selector(e);
    if(key) out.set(key,(out.get(key)||0)+1);
  }
  return [...out.entries()].sort((a,b)=>b[1]-a[1]);
}

function inWindow(events:AnalyticsEvent[], days:number){
  const since=Date.now()-days*86400000;
  return events.filter(e=>e.timestamp>=since);
}

export function analyticsIntelligence(days=30){
  const events=inWindow(getEvents(),days);
  const started=countBy(events,e=>e.name==="workout_started");
  const resumed=countBy(events,e=>e.name==="workout_resumed");
  const completed=countBy(events,e=>e.name==="workout_completed");
  const draftSaved=countBy(events,e=>e.name==="workout_draft_saved");
  const discarded=countBy(events,e=>e.name==="workout_discarded");
  const readinessSubmitted=countBy(events,e=>e.name==="readiness_submitted");
  const readinessSkipped=countBy(events,e=>e.name==="readiness_skipped");
  const proposalAccepted=countBy(events,e=>e.name==="coach_proposal_accepted");
  const proposalRejected=countBy(events,e=>e.name==="coach_proposal_rejected");
  const proposalDecisions=proposalAccepted+proposalRejected;
  const programEdits=countBy(events,e=>e.name==="program_edit_saved");
  const timerSkips=countBy(events,e=>e.name==="timer_skipped");

  const workoutRate=started?Math.min(100,(completed/started)*100):0;
  const resumeRate=started?Math.min(100,(resumed/started)*100):0;
  const draftRate=started?Math.min(100,(draftSaved/started)*100):0;
  const discardRate=started?Math.min(100,(discarded/started)*100):0;
  const readinessRate=(readinessSubmitted+readinessSkipped)?(readinessSubmitted/(readinessSubmitted+readinessSkipped))*100:0;
  const proposalAcceptRate=proposalDecisions?(proposalAccepted/proposalDecisions)*100:0;

  const stepDefs:[string,(e:AnalyticsEvent)=>boolean][]=[
    ["WORKOUT STARTED",e=>e.name==="workout_started"],
    ["FIRST EXERCISE",e=>e.name==="exercise_started"],
    ["EXERCISE COMPLETED",e=>e.name==="exercise_completed"],
    ["WORKOUT COMPLETED",e=>e.name==="workout_completed"],
  ];
  const funnel:AnalyticsFunnelStep[]=stepDefs.map(([name,predicate],i)=>{
    const count=countBy(events,predicate);
    const prev=i===0?started:countBy(events,stepDefs[i-1][1]);
    return {name,count,rate:prev?Math.min(100,(count/prev)*100):0};
  });

  const exerciseRows=mapCounts(events,e=>e.name==="exercise_started"?String(e.properties.exerciseId||"unknown"):undefined).map(([exerciseId,startedCount])=>{
    const completedCount=countBy(events,e=>e.name==="exercise_completed"&&String(e.properties.exerciseId||"")===exerciseId);
    const skippedCount=countBy(events,e=>e.name==="exercise_skipped"&&String(e.properties.exerciseId||"")===exerciseId);
    const substitutedCount=countBy(events,e=>e.name==="exercise_substituted"&&String(e.properties.exerciseId||"")===exerciseId);
    const terminal=completedCount+skippedCount+substitutedCount;
    return {
      exerciseId,started:startedCount,completed:completedCount,skipped:skippedCount,substituted:substitutedCount,
      terminal,completionRate:startedCount?(completedCount/startedCount)*100:0,
      frictionRate:startedCount?((skippedCount+substitutedCount)/startedCount)*100:0,
    } as ExerciseFriction;
  });

  const topScreens=mapCounts(events,e=>e.name==="screen_viewed"?String(e.properties.screen||"unknown"):undefined).slice(0,8);
  const featureEvents=[
    "workout_started","workout_completed","exercise_started","exercise_skipped","exercise_substituted",
    "coach_proposal_accepted","coach_proposal_rejected","program_edit_saved","mobility_completed",
    "session_report_exported","coach_handoff_copied","timer_skipped"
  ];
  const featureAdoption=featureEvents.map(name=>[name,countBy(events,e=>e.name===name)] as [string,number]).sort((a,b)=>b[1]-a[1]);

  return {
    windowDays:days,
    eventCount:events.length,
    funnel,
    topScreens,
    featureAdoption,
    exercises:exerciseRows.sort((a,b)=>b.started-a.started),
    completion:{started,completed,rate:workoutRate},
    recovery:{resumed,draftSaved,discarded,resumeRate,draftRate,discardRate},
    readiness:{submitted:readinessSubmitted,skipped:readinessSkipped,completionRate:readinessRate},
    coach:{accepted:proposalAccepted,rejected:proposalRejected,decisionRate:proposalAcceptRate},
    program:{edits:programEdits},
    timer:{skips:timerSkips},
    generatedAt:Date.now(),
  };
}
