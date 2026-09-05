
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

export interface ProgressionRegistryEntry {
  current:string; next:string; rule:string; regression?:string; bandMode?:"assistance"|"resistance"|"none";
  targetMaxIncrement:number; variantMasteryNextVariantId:string; ladder:{id:string;name:string}[];
}
export const PROGRESSION_SPECS:Record<string,ProgressionRegistryEntry> = {
  "pike": {
    "current": "Pike Push-up",
    "next": "Feet-Elevated Pike Push-up",
    "rule": "3×10 with RIR 1–2 and clean full ROM for 2 consecutive exposures",
    "regression": "Standard Pike Push-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "pike-feet",
    "ladder": [
      {
        "id": "pike",
        "name": "Pike Push-up"
      },
      {
        "id": "pike-feet",
        "name": "Feet-Elevated Pike Push-up"
      },
      {
        "id": "wall-hspu",
        "name": "Wall HSPU"
      },
      {
        "id": "deficit-wall-hspu",
        "name": "Deficit Wall HSPU"
      },
      {
        "id": "freestanding-hspu",
        "name": "Freestanding HSPU"
      }
    ]
  },
  "diamond": {
    "current": "Diamond Push-up",
    "next": "Feet-Elevated Diamond Push-up",
    "rule": "3×18 with RIR 1–2 and full ROM for 2 consecutive exposures",
    "regression": "Standard Push-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "diamond-feet",
    "ladder": [
      {
        "id": "diamond",
        "name": "Diamond Push-up"
      },
      {
        "id": "diamond-feet",
        "name": "Feet-Elevated Diamond Push-up"
      },
      {
        "id": "diamond-deep-feet",
        "name": "Deep Feet-Elevated Diamond Push-up"
      }
    ]
  },
  "archer-push": {
    "current": "Archer Push-up",
    "next": "Assisted One-Arm Push-up",
    "rule": "3×8/side with balanced ROM for 2 sessions",
    "regression": "Diamond Push-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "assisted-oap-push",
    "ladder": [
      {
        "id": "archer-push",
        "name": "Archer Push-up"
      },
      {
        "id": "assisted-oap-push",
        "name": "Assisted One-Arm Push-up"
      },
      {
        "id": "oap-push",
        "name": "One-Arm Push-up"
      }
    ]
  },
  "deep": {
    "current": "Deep Push-up",
    "next": "Feet-Elevated Deep Push-up",
    "rule": "10-min EMOM reaches coach upper range with <15% drop-off for 2 sessions",
    "regression": "Standard Deep Push-up",
    "bandMode": "resistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "deep",
    "ladder": [
      {
        "id": "deep",
        "name": "Deep Push-up"
      },
      {
        "id": "deep",
        "name": "Feet-Elevated Deep Push-up"
      }
    ]
  },
  "dips": {
    "current": "Dips",
    "next": "Band-Resisted / Deeper Dips",
    "rule": "10-min EMOM reaches 30/min with stable form and RIR ≥2",
    "regression": "Standard Dips",
    "bandMode": "resistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "dips",
    "ladder": [
      {
        "id": "dips",
        "name": "Dips"
      },
      {
        "id": "dips",
        "name": "Band-Resisted / Deeper Dips"
      }
    ]
  },
  "high-pull": {
    "current": "High Pull-up",
    "next": "Higher Chest-to-Bar High Pull",
    "rule": "4×5 with explosive height maintained",
    "regression": "Chest-to-Bar Pull-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "higher-high-pull",
    "ladder": [
      {
        "id": "high-pull",
        "name": "High Pull-up"
      },
      {
        "id": "higher-high-pull",
        "name": "Higher Chest-to-Bar High Pull"
      },
      {
        "id": "sternum-high-pull",
        "name": "Sternum High Pull"
      }
    ]
  },
  "pullup": {
    "current": "Pull-up",
    "next": "Chest-to-Bar Pull-up",
    "rule": "10-min EMOM reaches 7/min with stable ROM and <15% drop-off for 2 sessions",
    "regression": "Band Pull-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "chest-pull",
    "ladder": [
      {
        "id": "pullup",
        "name": "Pull-up"
      },
      {
        "id": "chest-pull",
        "name": "Chest-to-Bar Pull-up"
      },
      {
        "id": "high-pull-prog",
        "name": "High Pull-up"
      }
    ]
  },
  "close-chin": {
    "current": "Close-Grip Chin-up",
    "next": "Chest-to-Bar Chin-up",
    "rule": "10-min EMOM reaches 7/min with stable ROM for 2 sessions",
    "regression": "Close-Grip Chin-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "chest-chin",
    "ladder": [
      {
        "id": "close-chin",
        "name": "Close-Grip Chin-up"
      },
      {
        "id": "chest-chin",
        "name": "Chest-to-Bar Chin-up"
      }
    ]
  },
  "close-pull": {
    "current": "Close-Grip Pull-up",
    "next": "Chest-to-Bar Close Pull-up",
    "rule": "10-min EMOM reaches 7/min with stable ROM and <15% drop-off for 2 sessions",
    "regression": "Close-Grip Pull-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "close-chest",
    "ladder": [
      {
        "id": "close-pull",
        "name": "Close-Grip Pull-up"
      },
      {
        "id": "close-chest",
        "name": "Chest-to-Bar Close Pull-up"
      }
    ]
  },
  "archer-pull": {
    "current": "Archer Pull-up",
    "next": "Reduced-Assistance Archer / OAP Transition",
    "rule": "3×8/side clean and symmetric",
    "regression": "Assisted Archer Pull-up",
    "bandMode": "assistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "archer-pull",
    "ladder": [
      {
        "id": "archer-pull",
        "name": "Archer Pull-up"
      },
      {
        "id": "archer-pull",
        "name": "Reduced-Assistance Archer / OAP Transition"
      }
    ]
  },
  "oap": {
    "current": "One Arm Pull-up",
    "next": "Strict BW OAP / Higher Consistency",
    "rule": "6 quality attempts with ≥2 successful reps per arm",
    "regression": "Assisted OAP",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "oap",
    "ladder": [
      {
        "id": "oap",
        "name": "One Arm Pull-up"
      },
      {
        "id": "oap",
        "name": "Strict BW OAP / Higher Consistency"
      }
    ]
  },
  "oap-band": {
    "current": "Assisted One Arm Pull-up",
    "next": "Lighter Band OAP",
    "rule": "3×5/arm with current band and RIR ≥1",
    "regression": "Heavier Band OAP",
    "bandMode": "assistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "oap-band-blue",
    "ladder": [
      {
        "id": "oap-band-purple",
        "name": "Assisted OAP — Purple"
      },
      {
        "id": "oap-band-blue",
        "name": "Assisted OAP — Blue"
      },
      {
        "id": "oap-band-none",
        "name": "Bodyweight OAP"
      }
    ]
  },
  "touch": {
    "current": "Front Touch",
    "next": "Wide Front Lever Touch",
    "rule": "8 sec clean free hold for 2 consecutive exposures, with body line and touch position maintained",
    "regression": "Assisted Front Touch",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "touch",
    "ladder": [
      {
        "id": "touch",
        "name": "Front Touch"
      },
      {
        "id": "touch",
        "name": "Wide Front Lever Touch"
      }
    ]
  },
  "touch-band": {
    "current": "Assisted Front Touch",
    "next": "Lighter Band Front Touch",
    "rule": "3×8 sec clean holds with current band and consistent touch position",
    "regression": "Heavier Band Front Touch",
    "bandMode": "assistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "touch-band-blue",
    "ladder": [
      {
        "id": "touch-band-purple",
        "name": "Assisted Front Touch — Purple"
      },
      {
        "id": "touch-band-blue",
        "name": "Assisted Front Touch — Blue"
      },
      {
        "id": "touch-band-none",
        "name": "Free Front Touch"
      }
    ]
  },
  "flpu": {
    "current": "Full Front Lever Pull-up",
    "next": "5+ Rep Full FL Pull-up",
    "rule": "5×5 strict full-position reps with no form loss across 2 exposures",
    "regression": "Band-Assisted FL Pull-up",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "flpu-clean",
    "ladder": [
      {
        "id": "flpu",
        "name": "Full Front Lever Pull-up"
      },
      {
        "id": "flpu-clean",
        "name": "Full FL Pull-up — Cleaner / Higher"
      },
      {
        "id": "flpu-slow",
        "name": "Full FL Pull-up — Slower Eccentric"
      }
    ]
  },
  "wide-touch": {
    "current": "Wide Front Lever Touch",
    "next": "Straight Arm Touch (SAT)",
    "rule": "3×5 sec clean wide-touch holds with progressively wider grip and no shape loss",
    "regression": "Front Touch",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "wide-touch",
    "ladder": [
      {
        "id": "wide-touch",
        "name": "Wide Front Lever Touch"
      },
      {
        "id": "wide-touch",
        "name": "Straight Arm Touch (SAT)"
      }
    ]
  },
  "sat": {
    "current": "Straight Arm Touch (SAT)",
    "next": "Longer / Cleaner SAT",
    "rule": "3×3 sec strict straight-arm holds with locked elbows and clean line",
    "regression": "Wide Front Lever Touch",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "sat",
    "ladder": [
      {
        "id": "sat",
        "name": "Straight Arm Touch (SAT)"
      },
      {
        "id": "sat",
        "name": "Longer / Cleaner SAT"
      }
    ]
  },
  "flpu-band": {
    "current": "Band-Assisted FL Pull-up",
    "next": "Lighter Band FL Pull-up",
    "rule": "3×6 clean reps with current band",
    "regression": "Heavier Band FL Pull-up",
    "bandMode": "assistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "flpu-band-blue",
    "ladder": [
      {
        "id": "flpu-band-purple",
        "name": "Band FL Pull-up — Purple"
      },
      {
        "id": "flpu-band-blue",
        "name": "Band FL Pull-up — Blue"
      },
      {
        "id": "flpu-band-none",
        "name": "Full FL Pull-up"
      }
    ]
  },
  "curl-a": {
    "current": "Band Curl",
    "next": "Heavier Band Curl",
    "rule": "3×30 with RIR ≥1 and strict ROM",
    "regression": "Lighter Band Curl",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "curl-a",
    "ladder": [
      {
        "id": "curl-a",
        "name": "Band Curl"
      },
      {
        "id": "curl-a",
        "name": "Heavier Band Curl"
      }
    ]
  },
  "curl-b": {
    "current": "Band Curl",
    "next": "Heavier Band Curl",
    "rule": "3×30 with RIR ≥1 and strict ROM",
    "regression": "Lighter Band Curl",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "curl-b",
    "ladder": [
      {
        "id": "curl-b",
        "name": "Band Curl"
      },
      {
        "id": "curl-b",
        "name": "Heavier Band Curl"
      }
    ]
  },
  "curl-c": {
    "current": "Band Curl",
    "next": "Heavier Band Curl",
    "rule": "3×30 with RIR ≥1 and strict ROM",
    "regression": "Lighter Band Curl",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "curl-c",
    "ladder": [
      {
        "id": "curl-c",
        "name": "Band Curl"
      },
      {
        "id": "curl-c",
        "name": "Heavier Band Curl"
      }
    ]
  },
  "lat-a": {
    "current": "Band Lateral Raise",
    "next": "Heavier Band / Strict Higher Tension",
    "rule": "3×25 with no swing and RIR ≥1",
    "regression": "Lighter Band",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "lat-a",
    "ladder": [
      {
        "id": "lat-a",
        "name": "Band Lateral Raise"
      },
      {
        "id": "lat-a",
        "name": "Heavier Band / Strict Higher Tension"
      }
    ]
  },
  "lat-b": {
    "current": "Band Lateral Raise",
    "next": "Heavier Band / Strict Higher Tension",
    "rule": "3×25 with no swing and RIR ≥1",
    "regression": "Lighter Band",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "lat-b",
    "ladder": [
      {
        "id": "lat-b",
        "name": "Band Lateral Raise"
      },
      {
        "id": "lat-b",
        "name": "Heavier Band / Strict Higher Tension"
      }
    ]
  },
  "lat-c": {
    "current": "Band Lateral Raise",
    "next": "Heavier Band / Strict Higher Tension",
    "rule": "3×25 with no swing and RIR ≥1",
    "regression": "Lighter Band",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "lat-c",
    "ladder": [
      {
        "id": "lat-c",
        "name": "Band Lateral Raise"
      },
      {
        "id": "lat-c",
        "name": "Heavier Band / Strict Higher Tension"
      }
    ]
  },
  "tri-a": {
    "current": "Band Triceps Pressdown",
    "next": "Heavier Band Pressdown",
    "rule": "3×30 with RIR ≥1",
    "regression": "Lighter Band Pressdown",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "tri-a",
    "ladder": [
      {
        "id": "tri-a",
        "name": "Band Triceps Pressdown"
      },
      {
        "id": "tri-a",
        "name": "Heavier Band Pressdown"
      }
    ]
  },
  "tri-b": {
    "current": "Band Overhead Triceps Extension",
    "next": "Heavier Band Extension",
    "rule": "3×30 with RIR ≥1",
    "regression": "Lighter Band Extension",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "tri-b",
    "ladder": [
      {
        "id": "tri-b",
        "name": "Band Overhead Triceps Extension"
      },
      {
        "id": "tri-b",
        "name": "Heavier Band Extension"
      }
    ]
  },
  "tri-c": {
    "current": "Band Triceps Pressdown",
    "next": "Heavier Band Pressdown",
    "rule": "3×30 with RIR ≥1",
    "regression": "Lighter Band Pressdown",
    "bandMode": "resistance",
    "targetMaxIncrement": 5,
    "variantMasteryNextVariantId": "tri-c",
    "ladder": [
      {
        "id": "tri-c",
        "name": "Band Triceps Pressdown"
      },
      {
        "id": "tri-c",
        "name": "Heavier Band Pressdown"
      }
    ]
  },
  "bulgarian": {
    "current": "Bulgarian Split Squat",
    "next": "Band-Resisted Bulgarian Split Squat",
    "rule": "4×10/leg with RIR 1–2 and stable depth",
    "regression": "Bodyweight Bulgarian",
    "bandMode": "resistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "bulgarian-band",
    "ladder": [
      {
        "id": "bulgarian",
        "name": "Bulgarian Split Squat — Bodyweight"
      },
      {
        "id": "bulgarian-band",
        "name": "Band-Resisted Bulgarian Split Squat"
      },
      {
        "id": "bulgarian-deficit",
        "name": "Deficit Band Bulgarian Split Squat"
      }
    ]
  },
  "pistol": {
    "current": "Assisted Pistol",
    "next": "Strict Pistol Squat",
    "rule": "3×10/leg with minimal assistance and controlled depth",
    "regression": "Box/Assisted Pistol",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "pistol",
    "ladder": [
      {
        "id": "pistol-assisted",
        "name": "Assisted Pistol"
      },
      {
        "id": "pistol",
        "name": "Strict Pistol Squat"
      },
      {
        "id": "pistol-deficit",
        "name": "Deficit Pistol Squat"
      }
    ]
  },
  "sl-rdl": {
    "current": "Single-Leg RDL",
    "next": "Heavier-Band Single-Leg RDL",
    "rule": "3×12/leg with slow eccentric and balance",
    "regression": "Bodyweight Single-Leg Hinge",
    "bandMode": "resistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "sl-rdl",
    "ladder": [
      {
        "id": "sl-rdl",
        "name": "Single-Leg RDL"
      },
      {
        "id": "sl-rdl",
        "name": "Heavier-Band Single-Leg RDL"
      }
    ]
  },
  "calf": {
    "current": "Single-Leg Calf Raise",
    "next": "Deficit Single-Leg Calf Raise",
    "rule": "3×20/leg with 2-sec peak hold",
    "regression": "Two-Leg Calf Raise",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "calf",
    "ladder": [
      {
        "id": "calf",
        "name": "Single-Leg Calf Raise"
      },
      {
        "id": "calf",
        "name": "Deficit Single-Leg Calf Raise"
      }
    ]
  },
  "band-legcurl": {
    "current": "Band Leg Curl",
    "next": "Heavier-Band Leg Curl",
    "rule": "3×20/leg with full squeeze",
    "regression": "Lighter Band Leg Curl",
    "bandMode": "resistance",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "band-legcurl",
    "ladder": [
      {
        "id": "band-legcurl",
        "name": "Band Leg Curl"
      },
      {
        "id": "band-legcurl",
        "name": "Heavier-Band Leg Curl"
      }
    ]
  },
  "jump-lunge": {
    "current": "Jump Lunge",
    "next": "Higher / Faster Split Jump",
    "rule": "3×8/leg with contacts staying crisp",
    "regression": "Reverse Lunge",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "jump-lunge",
    "ladder": [
      {
        "id": "jump-lunge",
        "name": "Jump Lunge"
      },
      {
        "id": "jump-lunge",
        "name": "Higher / Faster Split Jump"
      }
    ]
  },
  "broad-jump": {
    "current": "Broad Jump",
    "next": "Higher-Quality / Longer Broad Jump",
    "rule": "4×3 with consistent landing and distance",
    "regression": "Low Intensity Broad Jump",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "broad-jump",
    "ladder": [
      {
        "id": "broad-jump",
        "name": "Broad Jump"
      },
      {
        "id": "broad-jump",
        "name": "Higher-Quality / Longer Broad Jump"
      }
    ]
  },
  "cmj": {
    "current": "Countermovement Jump",
    "next": "Higher-Quality / Higher Vertical Jump",
    "rule": "4×3 with consistent take-off mechanics",
    "regression": "Snap-down + Jump",
    "bandMode": "none",
    "targetMaxIncrement": 1,
    "variantMasteryNextVariantId": "cmj",
    "ladder": [
      {
        "id": "cmj",
        "name": "Countermovement Jump"
      },
      {
        "id": "cmj",
        "name": "Higher-Quality / Higher Vertical Jump"
      }
    ]
  }
} as const;

export const PROGRESSIONS:Record<string,Pick<ProgressionRegistryEntry,"current"|"next"|"rule"|"regression"|"bandMode">> = Object.fromEntries(Object.entries(PROGRESSION_SPECS).map(([k,v])=>[k,{current:v.current,next:v.next,rule:v.rule,regression:v.regression,bandMode:v.bandMode}])) as Record<string,Pick<ProgressionRegistryEntry,"current"|"next"|"rule"|"regression"|"bandMode">>;

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
