import type { MuscleGroup, SessionSummary } from './types';
import { weeklyStimulusActual } from './adaptiveStimulusEngine';
import { WORKLOAD_MUSCLES } from './workloadEngine';

export type HypertrophyResponseStatus = 'LOW'|'ADEQUATE'|'HIGH';

export interface MuscleHypertrophyResponse {
  muscle: MuscleGroup;
  currentSets: number;
  previousSets: number;
  trendPct: number;
  currentStimulus: number;
  fatigueSignal: number;
  status: HypertrophyResponseStatus;
  confidence: 'LOW'|'MEDIUM'|'HIGH';
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number,d=1)=>Number(n.toFixed(d));

function snapshotAt(sessions:SessionSummary[], now:number){ return weeklyStimulusActual(sessions,now); }

export function analyzeHypertrophyResponse(sessions:SessionSummary[], now=Date.now()): MuscleHypertrophyResponse[] {
  const current=snapshotAt(sessions,now);
  const previous=snapshotAt(sessions,now-7*86400000);
  return WORKLOAD_MUSCLES.map(m=>{
    const c=current.hypertrophyByMuscle[m];
    const p=previous.hypertrophyByMuscle[m];
    const prev=Math.max(0,p?.productiveSets||0);
    const cur=Math.max(0,c?.productiveSets||0);
    const trend=prev>0?((cur-prev)/prev)*100:(cur>0?100:0);
    const fatigue=current.totalFatigue;
    const status:HypertrophyResponseStatus=cur<5?'LOW':cur>16?'HIGH':'ADEQUATE';
    const confidence=(c?.exposures||0)>=4?'HIGH':(c?.exposures||0)>=2?'MEDIUM':'LOW';
    return { muscle:m, currentSets:round(cur), previousSets:round(prev), trendPct:round(trend), currentStimulus:round(c?.adjustedStimulus||0), fatigueSignal:round(clamp(fatigue/100,0,2),2), status, confidence };
  });
}

export function lowHypertrophyMuscles(sessions:SessionSummary[],now=Date.now()): MuscleHypertrophyResponse[] {
  return analyzeHypertrophyResponse(sessions,now).filter(x=>x.status==='LOW');
}
