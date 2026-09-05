
import type {Band,DayKey,DayProgram} from "./types";
import {trainingProfileForBlock} from "./trainingModel";
export const BAND_OPTIONS:Band[]=["None","Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"];
export const HANDSTAND_CYCLES={
  1:[
    {id:"c1-1",name:"Floor Shoulder Opening",dose:"3 × 30 sec",timerSec:30},
    {id:"c1-2",name:"Frog Stand",dose:"3 × max sec"},
    {id:"c1-3",name:"Scapula Push-up",dose:"3 × 6–12 reps"},
    {id:"c1-4",name:"Pike Hold",dose:"3 × max sec"},
    {id:"c1-5",name:"Tucked Hollow Hold",dose:"3 × max sec"},
  ],
  2:[
    {id:"c2-1",name:"Band Dislocator",dose:"3 × 5 reps"},
    {id:"c2-2",name:"Reverse Wall HS Taps",dose:"3 × max sec"},
    {id:"c2-3",name:"Scapula Pike Push-up",dose:"3 × 6–12 reps"},
    {id:"c2-4",name:"Wall HS Hold",dose:"3 × max sec"},
    {id:"c2-5",name:"Diagonal Hollow Hold",dose:"3 × max sec"},
  ],
  3:[
    {id:"c3-1",name:"Wall Shoulder Opening",dose:"3 × 5 reps"},
    {id:"c3-2",name:"Handstand Practice",dose:"5–10 × max sec"},
    {id:"c3-3",name:"Scapula Wall HS Push-up",dose:"3 × 6–12 reps"},
    {id:"c3-4",name:"Reverse Wall HS Hold",dose:"3 × max sec"},
    {id:"c3-5",name:"Hollow Hold",dose:"3 × max sec"},
  ]
} as const;
const pushWarmup=[
 {id:"pw1",name:"General pulse + wrist flow",dose:"2 min",timerSec:120},
 {id:"pw2",name:"Wrist extension rocks",dose:"2 × 8–10 / side"},
 {id:"pw3",name:"Band external rotation",dose:"2 × 12–15"},
 {id:"pw4",name:"Scapular push-up",dose:"2 × 8–10"},
 {id:"pw5",name:"Pike shoulder lean",dose:"2 × 6–8 slow reps"},
];
const pullWarmup=[
 {id:"pl1",name:"Active hang + scap depression",dose:"2 × 15–20 sec"},
 {id:"pl2",name:"Scapular pull-up",dose:"2 × 6–8"},
 {id:"pl3",name:"Band straight-arm pulldown",dose:"2 × 12–15"},
 {id:"pl4",name:"Light high-pull rehearsal",dose:"2 × 3",timerSec:20},
 {id:"pl5",name:"Light band curl + elbow prep",dose:"1–2 × 15–20"},
];

import { PROGRESSION_SPECS, PROGRESSIONS, getProgressionLadder, getProgressionSpec } from './progressionRegistry';
export const PROGRAM:Record<DayKey,DayProgram>={
 Monday:{title:"PUSH A",subtitle:"Pike strength • Push volume",warmup:pushWarmup,blocks:[
  {id:"pike",kind:"PERFORMANCE",trainingRole:"strength",priority:"primary",name:"Pike Push-up",detail:"3 × 6–10 • RIR 1–2 • use the current progression rung",sets:3,target:"6–10",rest:180,previousMode:"reps"},
  {id:"pushup-volume",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"primary",trainingMethod:"DENSITY_5X70",name:"Push-up",detail:"5 × ~70% del massimale • mantieni la stessa dose e riduci il recupero solo quando la performance è stabile",sets:5,target:"0–0",rest:120,densityProtocol:{referenceMaxFraction:0.70,referenceMaxReps:40,fixedSets:5,initialRestSec:120,minRestSec:30,restStepSec:15,maxDropoffPct:15,minRir:1},previousMode:"reps"},
  {id:"dips-volume-a",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"primary",trainingMethod:"DENSITY_5X70",name:"Dips",detail:"5 × ~70% del massimale • mantieni la stessa dose e riduci il recupero solo quando la performance è stabile",sets:5,target:"0–0",rest:120,densityProtocol:{referenceMaxFraction:0.70,referenceMaxReps:45,fixedSets:5,initialRestSec:120,minRestSec:30,restStepSec:15,maxDropoffPct:15,minRir:1},previousMode:"reps"},
  {id:"lat-a",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Lateral Raise",detail:"3 × 12–20 • strict ROM • progress band when the top of the range is repeatable",sets:3,target:"12–20",rest:120,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"tri-a",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Triceps Pressdown",detail:"3 × 12–20 • strict lockout",sets:3,target:"12–20",rest:120,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"core-a",kind:"CORE",trainingRole:"hypertrophy",priority:"support",name:"Hollow Body Hold",detail:"3 × 20–40 sec • stop before hip position breaks",sets:3,target:"20–40 sec",rest:120,previousMode:"seconds"}
 ]},
 Tuesday:{title:"PULL A",subtitle:"Front Touch • High Pull • Pull-up volume",warmup:pullWarmup,blocks:[
  {id:"touch",kind:"SKILL_STATIC",trainingRole:"skill",priority:"primary",trainingMethod:"STATIC_HOLD",name:"Front Touch",detail:"4 × 2–4 sec • stop before shape breaks",sets:4,target:"2–4 sec",rest:240,countdown:true,previousMode:"seconds"},
  {id:"touch-band",kind:"VOLUME_SKILL",trainingRole:"skill",priority:"secondary",trainingMethod:"STATIC_HOLD",name:"Assisted Front Touch",detail:"3 × 6–10 sec • use the lightest band that preserves the touch pattern",sets:3,target:"6–10 sec",rest:180,bandOptions:["Blue 15–25 lb","Purple 25–40 lb"],defaultBand:"Purple 25–40 lb",countdown:true,previousMode:"seconds"},
  {id:"high-pull",kind:"PERFORMANCE",trainingRole:"strength",priority:"primary",name:"High Pull-up",detail:"3 × 3–5 • explosive height, full reset, stop before height drops",sets:3,target:"3–5",rest:180,previousMode:"reps"},
  {id:"pullup",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Pull-up",detail:"10 min EMOM • 5–7 reps/min • build from a sustainable 5/min baseline, then earn 6 and 7/min",minutes:10,target:"5–7/min",rest:60,previousMode:"emom"},
  {id:"curl-a",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Curl",detail:"3 × 10–15 • RIR 1–2 • strict ROM",sets:3,target:"10–15",rest:120,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"}
 ]},
 Wednesday:{title:"PUSH B",subtitle:"Pike • Diamond • Push-up + dip EMOM",warmup:pushWarmup,blocks:[
  {id:"pike",kind:"PERFORMANCE",trainingRole:"strength",priority:"primary",name:"Pike Push-up",detail:"3 × 6–10 • RIR 1–2 • use the current progression rung",sets:3,target:"6–10",rest:180,previousMode:"reps"},
  {id:"diamond",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"primary",name:"Diamond Push-up",detail:"3 × 12–20 • RIR 1–2 • controlled full ROM",sets:3,target:"12–20",rest:120,previousMode:"reps"},
  {id:"pushup-emom-b",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Push-up",detail:"10 min EMOM • 10–12 reps/min • prioritize even output over a huge first minute",minutes:10,target:"10–12/min",rest:60,previousMode:"emom"},
  {id:"dips-emom-b",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Dips",detail:"10 min EMOM • 6–8 reps/min • keep the first and last minutes close",minutes:10,target:"6–8/min",rest:60,previousMode:"emom"},
  {id:"lat-b",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Lateral Raise",detail:"3 × 12–20 • strict ROM",sets:3,target:"12–20",rest:120,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"tri-b",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Overhead Triceps Extension",detail:"3 × 10–15 • RIR 1–2",sets:3,target:"10–15",rest:120,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"}
 ]},
 Thursday:{title:"PULL B",subtitle:"One-Arm Pull-up • Assisted strength • Chin EMOM",warmup:pullWarmup,blocks:[
  {id:"oap",kind:"SKILL_REPS",trainingRole:"skill",priority:"primary",name:"One Arm Pull-up",detail:"6 quality attempts • mostly singles until clean doubles are repeatable",sets:6,target:"1–2 / arm",rest:240,previousMode:"reps"},
  {id:"oap-band",kind:"VOLUME_SKILL",trainingRole:"strength",priority:"primary",name:"Assisted One Arm Pull-up",detail:"3 × 3–6 / arm • use the Red band for now; earn the lighter band through clean 6s",sets:3,target:"3–6 / arm",rest:180,bandOptions:["Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Red 50–125 lb",previousMode:"reps"},
  {id:"archer-pull",kind:"PERFORMANCE",trainingRole:"strength",priority:"secondary",name:"Archer Pull-up",detail:"3 × 4–6 / side • controlled transfer to the working arm",sets:3,target:"4–6 / side",rest:180,previousMode:"reps"},
  {id:"close-chin",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Close-Grip Chin-up",detail:"10 min EMOM • 5–7 reps/min • keep ROM consistent across all minutes",minutes:10,target:"5–7/min",rest:60,previousMode:"emom"},
  {id:"curl-b",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Curl",detail:"3 × 10–15 • RIR 1–2 • strict ROM",sets:3,target:"10–15",rest:120,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"leg-raise",kind:"CORE",trainingRole:"hypertrophy",priority:"support",name:"Dragon Flag",detail:"3 × 2–6 • no grip demand • controlled eccentric and clean body line",sets:3,target:"2–6",rest:150,previousMode:"reps"}
 ]},
 Friday:{title:"PUSH C",subtitle:"Long sets • Close grip • Push-up + dip density",warmup:pushWarmup,blocks:[
  {id:"pushup-long",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"secondary",trainingMethod:"LONG_SET",name:"Push-up Long Set",detail:"1 × 25–40 • fermati circa a RIR 2–3 • aumenta le reps senza inseguire il cedimento",sets:1,target:"25–40",rest:180,previousMode:"reps"},
  {id:"dips-long",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"secondary",trainingMethod:"LONG_SET",name:"Dips Long Set",detail:"1 × 25–40 • fermati circa a RIR 2 • ROM coerente",sets:1,target:"25–40",rest:180,previousMode:"reps"},
  {id:"close-pushup",kind:"PERFORMANCE",trainingRole:"hypertrophy",priority:"primary",name:"Close-Grip Push-up",detail:"3 × 12–20 • RIR 1–2 • triceps emphasis",sets:3,target:"12–20",rest:120,previousMode:"reps"},
  {id:"pushup-emom-c",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Push-up",detail:"10 min EMOM • 10–12 reps/min • keep output even from minute 1 to 10",minutes:10,target:"10–12/min",rest:60,previousMode:"emom"},
  {id:"dips-emom-c",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Dips",detail:"10 min EMOM • 7–9 reps/min • leave room for the final minutes",minutes:10,target:"7–9/min",rest:60,previousMode:"emom"},
  {id:"lat-c",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Lateral Raise",detail:"3 × 12–20 • strict ROM",sets:3,target:"12–20",rest:120,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"}
 ]},
 Saturday:{title:"PULL C",subtitle:"Front Lever Pull-up • High Pull • Pull density",warmup:pullWarmup,blocks:[
  {id:"flpu",kind:"SKILL_REPS",trainingRole:"skill",priority:"primary",name:"Full Front Lever Pull-up",detail:"5 quality sets • current range 1–3 reps • stop before body-line collapse",sets:5,target:"1–3",rest:240,previousMode:"reps"},
  {id:"flpu-band",kind:"VOLUME_SKILL",trainingRole:"strength",priority:"primary",name:"Band-Assisted FL Pull-up",detail:"3 × 3–6 • use the Red band for now; reduce assistance only after clean 6s",sets:3,target:"3–6",rest:180,bandOptions:["Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Red 50–125 lb",previousMode:"reps"},
  {id:"chest-high",kind:"PERFORMANCE",trainingRole:"strength",priority:"secondary",name:"Chest-to-Bar / High Pull-up",detail:"3 × 4–6 • chest-height target first, higher only when recovered",sets:3,target:"4–6",rest:180,previousMode:"reps"},
  {id:"close-pull",kind:"EMOM",trainingRole:"hypertrophy",priority:"primary",name:"Close-Grip Pull-up",detail:"10 min EMOM • 5–7 reps/min • prioritize consistent ROM over max output",minutes:10,target:"5–7/min",rest:60,previousMode:"emom"},
  {id:"curl-c",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Curl",detail:"3 × 10–15 • RIR 1–2 • strict ROM",sets:3,target:"10–15",rest:120,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"hollow-rocks",kind:"CORE",trainingRole:"hypertrophy",priority:"support",name:"Hollow-to-Arch Rocks",detail:"3 × 10–20 • floor-based core so grip can recover",sets:3,target:"10–20",rest:120,previousMode:"reps"}
 ]},
 Sunday:{title:"LEGS",subtitle:"Power • Unilateral strength • Maintenance hypertrophy",warmup:[
  {id:"leg-ankle",name:"Ankle rocks",dose:"2 × 10 / side"},
  {id:"leg-swings",name:"Leg swings",dose:"2 × 10 / side"},
  {id:"leg-squat",name:"Squat-to-stand",dose:"2 × 6"},
  {id:"leg-lunge",name:"Reverse lunge + reach",dose:"1 × 6 / side"},
  {id:"leg-pogo",name:"Pogo hops",dose:"2 × 15"},
  {id:"leg-snap",name:"Snap-down to athletic stance",dose:"2 × 5"},
  {id:"leg-jump-prep",name:"Low broad jump rehearsal",dose:"2 × 2"}
 ],blocks:[
  {id:"broad-jump",kind:"PERFORMANCE",trainingRole:"power",priority:"primary",name:"Broad Jump",detail:"3 × 3 • maximal quality • full reset",sets:3,target:"3",rest:180,previousMode:"reps"},
  {id:"cmj",kind:"PERFORMANCE",trainingRole:"power",priority:"primary",name:"Countermovement Jump",detail:"3 × 3 • maximal quality • full reset",sets:3,target:"3",rest:180,previousMode:"reps"},
  {id:"bulgarian",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"primary",name:"Bulgarian Split Squat",detail:"3 × 8–12 / leg • RIR 1–2 • add band resistance when BW is too easy",sets:3,target:"8–12 / leg",rest:150,bandOptions:["None","Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb"],defaultBand:"None",previousMode:"reps"},
  {id:"pistol",kind:"ACCESSORY",trainingRole:"strength",priority:"secondary",name:"Pistol Squat / Assisted Pistol",detail:"3 × 6–10 / leg • controlled depth",sets:3,target:"6–10 / leg",rest:150,previousMode:"reps"},
  {id:"sl-rdl",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"secondary",name:"Single-Leg RDL with Band",detail:"3 × 8–12 / leg • slow eccentric",sets:3,target:"8–12 / leg",rest:120,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"jump-lunge",kind:"PERFORMANCE",trainingRole:"power",priority:"secondary",name:"Split Jump / Jump Lunge",detail:"2 × 5–8 / leg • stop when speed drops",sets:2,target:"5–8 / leg",rest:120,previousMode:"reps"},
  {id:"calf",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Single-Leg Calf Raise",detail:"3 × 12–20 / leg • 2-sec peak hold",sets:3,target:"12–20 / leg",rest:120,previousMode:"reps"},
  {id:"band-legcurl",kind:"ACCESSORY",trainingRole:"hypertrophy",priority:"support",name:"Band Leg Curl",detail:"3 × 12–20 / leg • full squeeze",sets:3,target:"12–20 / leg",rest:120,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"}
 ]}
};

// Phase 7: attach the normalized training model to every programmed block so the
// Coach, Plan editor, analytics and reports all share the same classification.
for (const day of Object.keys(PROGRAM) as DayKey[]) {
  PROGRAM[day] = {
    ...PROGRAM[day],
    blocks: PROGRAM[day].blocks.map(block => ({ ...block, ...trainingProfileForBlock(block) })),
  };
}

export function getProgressionLadder(exerciseId:string){
  const key=exerciseId==="pike-feet"?"pike":exerciseId;
  return PROGRESSION_SPECS[key]?.ladder||[];
}
export function getProgressionSpec(exerciseId:string){
  const key=exerciseId==="pike-feet"?"pike":exerciseId;
  return PROGRESSION_SPECS[key];
}
