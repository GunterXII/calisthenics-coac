import type { SessionSummary } from './types';

export interface FrontLeverTouchEvidence {
  depthScore: number;
  holdSeconds: number;
  qualityPct: number;
  scapularScore: number;
}

export interface FrontLeverTouchState extends FrontLeverTouchEvidence {
  exposures: number;
  repeatableScore: number;
  readiness: 'PROGRESS'|'CONSOLIDATE'|'REGRESS'|'UNKNOWN';
  explanation: string;
}

function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n));}
function round(n:number,d=1){return Number(n.toFixed(d));}

function logs(sessions:SessionSummary[]){
  return sessions.flatMap(s=>s.logs.filter(l=>/front.?lever.?touch|touch/i.test(l.exerciseId)||/front.?lever.?touch|touch/i.test(l.exerciseName)));
}

export function analyzeFrontLeverTouch(sessions:SessionSummary[]):FrontLeverTouchState {
  const ls=logs(sessions).slice(-8);
  const holds=ls.flatMap(l=>l.result.seconds||[]).filter(v=>Number.isFinite(v));
  const quality=ls.flatMap(l=>l.result.quality||[]).map(q=>q==='Clean'?100:q==='Shaky'?70:35);
  const best=holds.length?Math.max(...holds):0;
  const clean=ls.flatMap(l=>l.result.seconds||[]).map((v,i)=>({v,q:quality[i]??70})).filter(x=>x.q>=70);
  const repeat=clean.length?clean.filter(x=>x.v>=best*0.9).length/clean.length:0;
  const q=quality.length?quality.reduce((a,b)=>a+b,0)/quality.length:0;
  const depth=best>0?100:0;
  const readiness=ls.length<3?'UNKNOWN':(q>=80&&repeat>=0.5)?'PROGRESS':q>=60?'CONSOLIDATE':'REGRESS';
  const explanation=readiness==='PROGRESS'?'Prestazione specifica, qualità e ripetibilità sono allineate.':readiness==='CONSOLIDATE'?'La skill è presente ma la qualità non è ancora abbastanza stabile per aumentare la difficoltà.':readiness==='REGRESS'?'La qualità del Touch è il limite principale.':'Servono più esposizioni specifiche.';
  return {depthScore:depth,holdSeconds:round(best),qualityPct:round(clamp(q)),scapularScore:round(clamp(q)),exposures:ls.length,repeatableScore:round(repeat*100),readiness,explanation};
}
