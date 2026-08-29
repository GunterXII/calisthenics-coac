import type {DayKey, ExerciseBlock, MuscleGroup} from "./types";
import {trainingProfileForBlock} from "./trainingModel";

export const PROGRAM_DAYS:DayKey[]=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export type ValidationSeverity="OK"|"WATCH"|"HIGH";
export type ValidationSignalKind="VOLUME"|"RECOVERY"|"GRIP"|"OVERLAP"|"SEQUENCING"|"BALANCE";

export interface PlannedBlockLoad {
  day:DayKey;
  blockId:string;
  name:string;
  role:string;
  priority:string;
  sets:number;
  adjustedSets:number;
  fatigueLoad:number;
  gripScore:number;
  muscles:Partial<Record<MuscleGroup,number>>;
}

export interface DaySimulation {
  day:DayKey;
  title:string;
  adjustedSets:number;
  fatigueLoad:number;
  gripScore:number;
  muscles:Partial<Record<MuscleGroup,number>>;
  blocks:PlannedBlockLoad[];
}

export interface ValidationSignal {
  kind:ValidationSignalKind;
  severity:ValidationSeverity;
  title:string;
  detail:string;
  days:DayKey[];
}

export interface ProgramValidationReport {
  score:number;
  severity:ValidationSeverity;
  days:DaySimulation[];
  muscleTotals:Record<MuscleGroup,number>;
  muscleExposureDays:Record<MuscleGroup,number>;
  signals:ValidationSignal[];
  strengths:string[];
  planningNotes:string[];
}

const MUSCLES:MuscleGroup[]=["chest","triceps","front_delts","side_delts","lats","upper_back","biceps","forearms","core","quads","glutes","hamstrings","calves"];
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number,d=2)=>Number(n.toFixed(d));

function blocksFor(day:DayKey,program:Record<DayKey,{title:string;blocks:ExerciseBlock[]}>){
  return program[day]?.blocks||[];
}

function blockPlanLoad(day:DayKey,block:ExerciseBlock):PlannedBlockLoad{
  const p=trainingProfileForBlock(block);
  const units=Math.max(1,block.sets||block.minutes||1);
  const adjustedSets=units*p.effectiveSetWeight;
  const fatigueLoad=adjustedSets*p.fatigueCost;
  const gripWeight={none:0,low:.35,moderate:.7,high:1}[p.gripDemand];
  const muscles:Partial<Record<MuscleGroup,number>>={};
  for(const m of p.muscleGroups) muscles[m]=(muscles[m]||0)+adjustedSets;
  return {day,blockId:block.id,name:block.name,role:p.role,priority:p.priority,sets:units,adjustedSets:round(adjustedSets),fatigueLoad:round(fatigueLoad),gripScore:round(units*gripWeight),muscles};
}

function severityFor(value:number,watch:number,high:number):ValidationSeverity{
  return value>=high?"HIGH":value>=watch?"WATCH":"OK";
}

function mergeDayLoads(day:DayKey,title:string,loads:PlannedBlockLoad[]):DaySimulation{
  const muscles:Partial<Record<MuscleGroup,number>>={};
  let adjustedSets=0,fatigueLoad=0,gripScore=0;
  for(const l of loads){
    adjustedSets+=l.adjustedSets;fatigueLoad+=l.fatigueLoad;gripScore+=l.gripScore;
    for(const m of MUSCLES) if(l.muscles[m]) muscles[m]=(muscles[m]||0)+(l.muscles[m]||0);
  }
  return {day,title,adjustedSets:round(adjustedSets),fatigueLoad:round(fatigueLoad),gripScore:round(gripScore),muscles,blocks:loads};
}

function recoveryPct(lastLoad:number,hours:number){
  // Conservative planning heuristic. It rewards elapsed recovery time and gently
  // discounts recovery when the previous planned load was large; it intentionally
  // avoids pretending to predict exact physiology.
  const timeFactor=1-Math.exp(-Math.max(0,hours)/36);
  const loadFactor=clamp(1-(Math.max(0,lastLoad)-8)/50,0.55,1);
  return clamp(100*timeFactor*loadFactor,0,100);
}

function addSignal(signals:ValidationSignal[],signal:ValidationSignal){
  const exists=signals.find(x=>x.kind===signal.kind&&x.title===signal.title);
  if(!exists) signals.push(signal);
}

export function validateProgramWeek(program:Record<DayKey,{title:string;blocks:ExerciseBlock[]}>,startHours=0):ProgramValidationReport{
  const days:DaySimulation[]=PROGRAM_DAYS.map(day=>{
    const loads=blocksFor(day,program).map(b=>blockPlanLoad(day,b));
    return mergeDayLoads(day,program[day]?.title||day,loads);
  });
  const muscleTotals={} as Record<MuscleGroup,number>;
  const muscleExposureDays={} as Record<MuscleGroup,number>;
  for(const m of MUSCLES){muscleTotals[m]=0;muscleExposureDays[m]=0;}
  for(const d of days){
    for(const m of MUSCLES){
      const v=d.muscles[m]||0;
      muscleTotals[m]=round(muscleTotals[m]+v);
      if(v>0) muscleExposureDays[m]+=1;
    }
  }

  const signals:ValidationSignal[]=[];
  const strengths:string[]=[];
  const planningNotes:string[]=[];

  for(const d of days){
    const highPriorityFatigue=d.blocks.filter(x=>x.priority==="primary"&&x.fatigueLoad>=10).length;
    if(d.adjustedSets>=24) addSignal(signals,{kind:"VOLUME",severity:"HIGH",title:`${d.title} is a high-workload day`,detail:`${d.adjustedSets.toFixed(1)} adjusted sets and ${d.fatigueLoad.toFixed(1)} fatigue load are planned. Watch performance decay late in the session.`,days:[d.day]});
    else if(d.adjustedSets>=18) addSignal(signals,{kind:"VOLUME",severity:"WATCH",title:`${d.title} has a dense workload`,detail:`${d.adjustedSets.toFixed(1)} adjusted sets are concentrated in one session. Keep later sets quality-controlled.`,days:[d.day]});
    if(d.gripScore>=28) addSignal(signals,{kind:"GRIP",severity:"HIGH",title:`${d.title} has high grip demand`,detail:`${d.gripScore.toFixed(1)} weighted grip units are planned. This can contaminate later pulling or hanging work.`,days:[d.day]});
    else if(d.gripScore>=20) addSignal(signals,{kind:"GRIP",severity:"WATCH",title:`${d.title} has notable grip demand`,detail:`${d.gripScore.toFixed(1)} weighted grip units are planned. Keep core choices grip-independent.`,days:[d.day]});
    if(highPriorityFatigue>=2) addSignal(signals,{kind:"SEQUENCING",severity:"WATCH",title:`${d.title} stacks high-cost primary work`,detail:`Multiple high-fatigue primary blocks compete for output in the same session. Skill quality should stay first.`,days:[d.day]});
  }

  // Recovery simulation: each planned day acts as if its load lands at the start of the day.
  const dayIndex=new Map(PROGRAM_DAYS.map((d,i)=>[d,i]));
  for(const m of MUSCLES){
    const exposureDays=days.filter(d=>(d.muscles[m]||0)>0);
    for(let i=0;i<exposureDays.length;i++){
      const current=exposureDays[i];
      const prev=exposureDays[i-1];
      if(!prev) continue;
      const currentIndex=dayIndex.get(current.day)!;
      const prevIndex=dayIndex.get(prev.day)!;
      const gap=((currentIndex-prevIndex+7)%7)||7;
      const previousLoad=prev.muscles[m]||0;
      const hours=gap*24;
      const recovery=recoveryPct(previousLoad,hours);
      if(recovery<55){
        addSignal(signals,{kind:"RECOVERY",severity:"HIGH",title:`${prettyMuscle(m)} may be under-recovered`,detail:`${prettyMuscle(m)} is loaded again after ${gap} day(s). Planning heuristic estimates ~${Math.round(recovery)}% recovery from the prior planned exposure.`,days:[prev.day,current.day]});
      } else if(recovery<70){
        addSignal(signals,{kind:"RECOVERY",severity:"WATCH",title:`${prettyMuscle(m)} recovery deserves monitoring`,detail:`${prettyMuscle(m)} returns after ${gap} day(s). Planning heuristic estimates ~${Math.round(recovery)}% recovery from the prior planned exposure.`,days:[prev.day,current.day]});
      }
    }
  }

  // Same-day antagonistic / repeated pattern overlap.
  for(const d of days){
    const pulls=d.blocks.filter(b=>String(b.name||"").toLowerCase().includes("pull")||String(b.name||"").toLowerCase().includes("chin")||String(b.blockId||"").includes("oap")||String(b.blockId||"").includes("flpu")||String(b.blockId||"").includes("archer-pull")).length;
    const highPulls=d.blocks.filter(b=>b.gripScore>=Math.max(1,b.sets*0.75)).length;
    if(pulls>=4 && highPulls>=3) addSignal(signals,{kind:"OVERLAP",severity:"WATCH",title:`${d.title} has repeated high-grip pulling`,detail:`${pulls} pulling blocks and ${highPulls} high-grip blocks are planned. Later pulling work may be limited by forearm fatigue rather than target muscles.`,days:[d.day]});
  }

  // Basic balance signals: identify under-emphasized muscles relative to the athlete's 6-day upper-body focus.
  const upperTotal= ["chest","triceps","front_delts","side_delts","lats","upper_back","biceps","forearms"] as MuscleGroup[];
  const lowerTotal= ["quads","glutes","hamstrings","calves"] as MuscleGroup[];
  const upperSum=upperTotal.reduce((a,m)=>a+muscleTotals[m],0);
  const lowerSum=lowerTotal.reduce((a,m)=>a+muscleTotals[m],0);
  if(upperSum>0 && lowerSum<upperSum*.18) addSignal(signals,{kind:"BALANCE",severity:"WATCH",title:"Lower-body work is mostly maintenance",detail:"The week is strongly upper-body dominant. That is coherent with an upper-body calisthenics priority, but lower-body volume is not a growth-focused allocation.",days:["Sunday"]});

  // Positive checks.
  const skillDays=days.filter(d=>d.blocks.some(b=>b.role==="skill"));
  if(skillDays.length>=2) strengths.push("Skill work is distributed across multiple exposures instead of being isolated to one day.");
  const emomDays=days.filter(d=>d.blocks.some(b=>String(b.blockId||"").includes("emom")||b.role==="hypertrophy"&&b.gripScore>0&&b.sets>=8));
  if(emomDays.length>=3) strengths.push("EMOM remains a consistent density tool across the week.");
  if(days.every(d=>d.blocks.filter(b=>b.priority==="primary").length>0)) strengths.push("Every training day has a clear primary focus.");

  planningNotes.push("Simulation is a planning heuristic: it estimates workload, overlap and recovery risk; it does not predict exact physiology.");
  planningNotes.push("A signal is a reason to review the plan, not an automatic command to delete or regress an exercise.");
  if(signals.some(s=>s.kind==="GRIP")) planningNotes.push("Use non-grip core choices on high-grip pull days to preserve forearm capacity for the main work.");
  if(signals.some(s=>s.kind==="RECOVERY")) planningNotes.push("When a repeated exposure is strategically important, consider reducing low-priority volume before reducing the primary skill/strength work.");

  const highCount=signals.filter(s=>s.severity==="HIGH").length;
  const watchCount=signals.filter(s=>s.severity==="WATCH").length;
  const penalty=Math.min(55,highCount*8+watchCount*2);
  const score=clamp(100-penalty,0,100);
  const severity:ValidationSeverity=score<70?"HIGH":score<88?"WATCH":"OK";
  return {score, severity, days, muscleTotals, muscleExposureDays, signals, strengths, planningNotes};
}

export function prettyMuscle(m:MuscleGroup){return m.split("_").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");}

export function summarizeDay(d:DaySimulation){
  return `${d.day}: ${d.adjustedSets.toFixed(1)} adjusted sets · ${d.fatigueLoad.toFixed(1)} fatigue · grip ${d.gripScore.toFixed(1)}`;
}
