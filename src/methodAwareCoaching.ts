import type {ExerciseBlock,WorkoutLog,CoachProposal} from "./types";

export function densityQualifies(log:WorkoutLog,block:ExerciseBlock):boolean{
 if(block.trainingMethod!=="DENSITY_5X70"||log.status!=="complete")return false;
 const rawTarget=String(log.prescription?.targetRange||block.target);
 const match=rawTarget.match(/\d+(?:\.\d+)?/);
 const target=match?Number(match[0]):NaN,values=log.result.reps||[];
 if(!Number.isFinite(target)||target<=0||values.length<(block.densityProtocol?.fixedSets||5))return false;
 const first=values[0]||0,last=values[values.length-1]||0,minValue=Math.min(...values),dropoff=first>0?((first-last)/first)*100:100;
 const rir=log.result.rir,fatigue=log.result.fatigue;
 return minValue>=target*0.90&&dropoff<=(block.densityProtocol?.maxDropoffPct||15)&&(rir===undefined||rir>=(block.densityProtocol?.minRir||1))&&(fatigue===undefined||fatigue<=3);
}

export function proposeDensityRestProgression(block:ExerciseBlock,log:WorkoutLog,history:WorkoutLog[]):Omit<CoachProposal,"id"|"date">|null{
 if(block.trainingMethod!=="DENSITY_5X70"||log.status!=="complete"||!block.densityProtocol)return null;
 const same=(x:WorkoutLog)=>x.exerciseId===log.exerciseId&&x.status==="complete"&&!x.skipped&&String(x.variantId||x.exerciseId)===String(log.variantId||log.exerciseId)&&String(x.prescription?.targetRange||"")===String(log.prescription?.targetRange||"")&&(x.prescription?.sets??null)===(log.prescription?.sets??null)&&(x.prescription?.restSec??null)===(log.prescription?.restSec??null)&&(x.prescription?.kind??"")===(log.prescription?.kind??"")&&String(x.result.band||"")===String(log.result.band||"");
 const prior=history.filter(same).sort((a,b)=>a.date-b.date),recent=[...prior.slice(-1),log];
 const unique=recent.filter((x,i,a)=>i===0||x.id!==a[i-1].id);
 if(unique.length<2||!unique.every(x=>densityQualifies(x,block)))return null;
 const currentRest=log.prescription?.restSec??block.rest,nextRest=Math.max(block.densityProtocol.minRestSec,currentRest-block.densityProtocol.restStepSec);
 if(nextRest>=currentRest)return null;
 return {type:"rest",exerciseId:block.id,title:"Riduci recupero — "+block.name,detail:"Due esposizioni comparabili hanno sostenuto la stessa dose. Riduci il recupero di "+block.densityProtocol.restStepSec+"s senza aumentare le reps.",from:currentRest+"s",to:nextRest+"s",reason:"La densità è la variabile di progressione: target stabile, drop-off e RIR entro i limiti.",status:"pending",sessionId:log.id};
}
