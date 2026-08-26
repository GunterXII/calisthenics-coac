
import type {Band,DayKey,DayProgram} from "./types";
export const BAND_OPTIONS:Band[]=["None","Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"];
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

export const PROGRESSIONS:Record<string,{current:string;next:string;rule:string;regression?:string;bandMode?:"assistance"|"resistance"|"none"}>= {
 "pike":{current:"Pike Push-up",next:"Feet-Elevated Pike Push-up",rule:"3×10 with RIR 1–2 and clean full ROM for 2 consecutive exposures",regression:"Standard Pike Push-up",bandMode:"none"},
 "diamond":{current:"Diamond Push-up",next:"Feet-Elevated Diamond Push-up",rule:"3×18 with RIR 1–2 and full ROM for 2 consecutive exposures",regression:"Standard Push-up",bandMode:"none"},
 "archer-push":{current:"Archer Push-up",next:"Assisted One-Arm Push-up",rule:"3×8/side with balanced ROM for 2 sessions",regression:"Diamond Push-up",bandMode:"none"},
 "deep":{current:"Deep Push-up",next:"Feet-Elevated Deep Push-up",rule:"10-min EMOM reaches coach upper range with <15% drop-off for 2 sessions",regression:"Standard Deep Push-up",bandMode:"resistance"},
 "dips":{current:"Dips",next:"Band-Resisted / Deeper Dips",rule:"10-min EMOM reaches 30/min with stable form and RIR ≥2",regression:"Standard Dips",bandMode:"resistance"},
 "high-pull":{current:"High Pull-up",next:"Higher Chest-to-Bar High Pull",rule:"4×5 with explosive height maintained",regression:"Chest-to-Bar Pull-up",bandMode:"none"},
 "pullup":{current:"Pull-up",next:"Chest-to-Bar Pull-up",rule:"10-min EMOM reaches coach upper range with <15% drop-off",regression:"Band Pull-up",bandMode:"none"},
 "close-chin":{current:"Close-Grip Chin-up",next:"Chest-to-Bar Chin-up",rule:"10-min EMOM reaches 10/min with stable ROM",regression:"Close-Grip Chin-up",bandMode:"none"},
 "close-pull":{current:"Close-Grip Pull-up",next:"Chest-to-Bar Close Pull-up",rule:"10-min EMOM reaches 9/min with <15% drop-off",regression:"Close-Grip Pull-up",bandMode:"none"},
 "archer-pull":{current:"Archer Pull-up",next:"Reduced-Assistance Archer / OAP Transition",rule:"3×8/side clean and symmetric",regression:"Assisted Archer Pull-up",bandMode:"assistance"},
 "oap":{current:"One Arm Pull-up",next:"Strict BW OAP / Higher Consistency",rule:"6 quality attempts with ≥2 successful reps per arm",regression:"Assisted OAP",bandMode:"none"},
 "oap-band":{current:"Assisted One Arm Pull-up",next:"Lighter Band OAP",rule:"3×5/arm with current band and RIR ≥1",regression:"Heavier Band OAP",bandMode:"assistance"},
 "touch":{current:"Front Touch",next:"Wide Front Lever Touch",rule:"8 sec clean free hold for 2 consecutive exposures, with body line and touch position maintained",regression:"Assisted Front Touch",bandMode:"none"},
 "touch-band":{current:"Assisted Front Touch",next:"Lighter Band Front Touch",rule:"3×8 sec clean holds with current band and consistent touch position",regression:"Heavier Band Front Touch",bandMode:"assistance"},
 "flpu":{current:"Full Front Lever Pull-up",next:"5+ Rep Full FL Pull-up",rule:"5×5 strict full-position reps with no form loss across 2 exposures",regression:"Band-Assisted FL Pull-up",bandMode:"none"},
 "wide-touch":{current:"Wide Front Lever Touch",next:"Straight Arm Touch (SAT)",rule:"3×5 sec clean wide-touch holds with progressively wider grip and no shape loss",regression:"Front Touch",bandMode:"none"},
 "sat":{current:"Straight Arm Touch (SAT)",next:"Longer / Cleaner SAT",rule:"3×3 sec strict straight-arm holds with locked elbows and clean line",regression:"Wide Front Lever Touch",bandMode:"none"},
 "flpu-band":{current:"Band-Assisted FL Pull-up",next:"Lighter Band FL Pull-up",rule:"3×6 clean reps with current band",regression:"Heavier Band FL Pull-up",bandMode:"assistance"},
 "curl-a":{current:"Band Curl",next:"Heavier Band Curl",rule:"3×30 with RIR ≥1 and strict ROM",regression:"Lighter Band Curl",bandMode:"resistance"},
 "curl-b":{current:"Band Curl",next:"Heavier Band Curl",rule:"3×30 with RIR ≥1 and strict ROM",regression:"Lighter Band Curl",bandMode:"resistance"},
 "curl-c":{current:"Band Curl",next:"Heavier Band Curl",rule:"3×30 with RIR ≥1 and strict ROM",regression:"Lighter Band Curl",bandMode:"resistance"},
 "lat-a":{current:"Band Lateral Raise",next:"Heavier Band / Strict Higher Tension",rule:"3×25 with no swing and RIR ≥1",regression:"Lighter Band",bandMode:"resistance"},
 "lat-b":{current:"Band Lateral Raise",next:"Heavier Band / Strict Higher Tension",rule:"3×25 with no swing and RIR ≥1",regression:"Lighter Band",bandMode:"resistance"},
 "lat-c":{current:"Band Lateral Raise",next:"Heavier Band / Strict Higher Tension",rule:"3×25 with no swing and RIR ≥1",regression:"Lighter Band",bandMode:"resistance"},
 "tri-a":{current:"Band Triceps Pressdown",next:"Heavier Band Pressdown",rule:"3×30 with RIR ≥1",regression:"Lighter Band Pressdown",bandMode:"resistance"},
 "tri-b":{current:"Band Overhead Triceps Extension",next:"Heavier Band Extension",rule:"3×30 with RIR ≥1",regression:"Lighter Band Extension",bandMode:"resistance"},
 "tri-c":{current:"Band Triceps Pressdown",next:"Heavier Band Pressdown",rule:"3×30 with RIR ≥1",regression:"Lighter Band Pressdown",bandMode:"resistance"},
 "bulgarian":{current:"Bulgarian Split Squat",next:"Band-Resisted Bulgarian Split Squat",rule:"4×10/leg with RIR 1–2 and stable depth",regression:"Bodyweight Bulgarian",bandMode:"resistance"},
 "pistol":{current:"Assisted Pistol",next:"Strict Pistol Squat",rule:"3×10/leg with minimal assistance and controlled depth",regression:"Box/Assisted Pistol",bandMode:"none"},
 "sl-rdl":{current:"Single-Leg RDL",next:"Heavier-Band Single-Leg RDL",rule:"3×12/leg with slow eccentric and balance",regression:"Bodyweight Single-Leg Hinge",bandMode:"resistance"},
 "calf":{current:"Single-Leg Calf Raise",next:"Deficit Single-Leg Calf Raise",rule:"3×20/leg with 2-sec peak hold",regression:"Two-Leg Calf Raise",bandMode:"none"},
 "band-legcurl":{current:"Band Leg Curl",next:"Heavier-Band Leg Curl",rule:"3×20/leg with full squeeze",regression:"Lighter Band Leg Curl",bandMode:"resistance"},
 "jump-lunge":{current:"Jump Lunge",next:"Higher / Faster Split Jump",rule:"3×8/leg with contacts staying crisp",regression:"Reverse Lunge",bandMode:"none"},
 "broad-jump":{current:"Broad Jump",next:"Higher-Quality / Longer Broad Jump",rule:"4×3 with consistent landing and distance",regression:"Low Intensity Broad Jump",bandMode:"none"},
 "cmj":{current:"Countermovement Jump",next:"Higher-Quality / Higher Vertical Jump",rule:"4×3 with consistent take-off mechanics",regression:"Snap-down + Jump",bandMode:"none"}
};


export const PROGRESSION_LADDERS:Record<string,{id:string;name:string}[]>={
  pike:[
    {id:"pike",name:"Pike Push-up"},
    {id:"pike-feet",name:"Feet-Elevated Pike Push-up"},
    {id:"wall-hspu",name:"Wall HSPU"},
    {id:"deficit-wall-hspu",name:"Deficit Wall HSPU"},
    {id:"freestanding-hspu",name:"Freestanding HSPU"}
  ],
  diamond:[
    {id:"diamond",name:"Diamond Push-up"},
    {id:"diamond-feet",name:"Feet-Elevated Diamond Push-up"},
    {id:"diamond-deep-feet",name:"Deep Feet-Elevated Diamond Push-up"}
  ],
  "archer-push":[
    {id:"archer-push",name:"Archer Push-up"},
    {id:"assisted-oap-push",name:"Assisted One-Arm Push-up"},
    {id:"oap-push",name:"One-Arm Push-up"}
  ],
  pullup:[
    {id:"pullup",name:"Pull-up"},
    {id:"chest-pull",name:"Chest-to-Bar Pull-up"},
    {id:"high-pull-prog",name:"High Pull-up"}
  ],
  "high-pull":[
    {id:"high-pull",name:"High Pull-up"},
    {id:"higher-high-pull",name:"Higher Chest-to-Bar High Pull"},
    {id:"sternum-high-pull",name:"Sternum High Pull"}
  ],
  "close-chin":[
    {id:"close-chin",name:"Close-Grip Chin-up"},
    {id:"chest-chin",name:"Chest-to-Bar Chin-up"}
  ],
  "close-pull":[
    {id:"close-pull",name:"Close-Grip Pull-up"},
    {id:"close-chest",name:"Chest-to-Bar Close Pull-up"}
  ],
  "oap-band":[
    {id:"oap-band-purple",name:"Assisted OAP — Purple"},
    {id:"oap-band-blue",name:"Assisted OAP — Blue"},
    {id:"oap-band-none",name:"Bodyweight OAP"}
  ],
  "touch-band":[
    {id:"touch-band-purple",name:"Assisted Front Touch — Purple"},
    {id:"touch-band-blue",name:"Assisted Front Touch — Blue"},
    {id:"touch-band-none",name:"Free Front Touch"}
  ],
  "front-lever-touch":[
    {id:"front-lever-touch",name:"Front Touch"},
    {id:"wide-front-lever-touch",name:"Wide Front Lever Touch"},
    {id:"straight-arm-touch",name:"Straight Arm Touch (SAT)"}
  ],
  flpu:[
    {id:"flpu",name:"Full Front Lever Pull-up"},
    {id:"flpu-clean",name:"Full FL Pull-up — Cleaner / Higher"},
    {id:"flpu-slow",name:"Full FL Pull-up — Slower Eccentric"}
  ],
  "flpu-band":[
    {id:"flpu-band-purple",name:"Band FL Pull-up — Purple"},
    {id:"flpu-band-blue",name:"Band FL Pull-up — Blue"},
    {id:"flpu-band-none",name:"Full FL Pull-up"}
  ],
  bulgarian:[
    {id:"bulgarian",name:"Bulgarian Split Squat — Bodyweight"},
    {id:"bulgarian-band",name:"Band-Resisted Bulgarian Split Squat"},
    {id:"bulgarian-deficit",name:"Deficit Band Bulgarian Split Squat"}
  ],
  pistol:[
    {id:"pistol-assisted",name:"Assisted Pistol"},
    {id:"pistol",name:"Strict Pistol Squat"},
    {id:"pistol-deficit",name:"Deficit Pistol Squat"}
  ]
};

export const PROGRAM:Record<DayKey,DayProgram>={
 Monday:{title:"PUSH A",subtitle:"Pike progression • Push-up volume • Dips volume",warmup:pushWarmup,blocks:[
  {id:"pike",kind:"PERFORMANCE",name:"Pike Push-up",detail:"3 × 6–10 • RIR 1–2 • progress foot elevation over time",sets:3,target:"6–10",rest:150,previousMode:"reps"},
  {id:"pushup-volume",kind:"PERFORMANCE",name:"Push-up",detail:"4 × 18–28 • RIR 1–2 • standard grip",sets:4,target:"18–28",rest:120,previousMode:"reps"},
  {id:"dips-volume-a",kind:"PERFORMANCE",name:"Dips",detail:"4 × 15–25 • RIR 1–2 • controlled depth",sets:4,target:"15–25",rest:120,previousMode:"reps"},
  {id:"lat-a",kind:"ACCESSORY",name:"Band Lateral Raise",detail:"3 × 15–30 • choose band by RIR",sets:3,target:"15–30",rest:75,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"tri-a",kind:"ACCESSORY",name:"Band Triceps Pressdown",detail:"3 × 15–30 • controlled",sets:3,target:"15–30",rest:75,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"core-a",kind:"CORE",name:"Hollow Body Hold",detail:"3 × 20–40 sec",sets:3,target:"20–40 sec",rest:75,previousMode:"seconds"}
 ]},
 Tuesday:{title:"PULL A",subtitle:"Front Touch progression • Full FL strength • Pull-up endurance",warmup:pullWarmup,blocks:[
  {id:"touch",kind:"SKILL_STATIC",name:"Front Touch",detail:"4 × 2–4 sec • current free range based on 5-sec PB • stop before shape breaks",sets:4,target:"2–4 sec",rest:240,countdown:true,previousMode:"seconds"},
  {id:"touch-band",kind:"VOLUME_SKILL",name:"Assisted Front Touch",detail:"3 × 6–10 sec • use the lightest band that preserves the same touch pattern",sets:3,target:"6–10 sec",rest:150,bandOptions:["Blue 15–25 lb","Purple 25–40 lb"],defaultBand:"Purple 25–40 lb",countdown:true,previousMode:"seconds"},
  {id:"high-pull",kind:"PERFORMANCE",name:"High Pull-up",detail:"3 × 3–5 • explosive quality, full reset",sets:3,target:"3–5",rest:180,previousMode:"reps"},
  {id:"pullup",kind:"EMOM",name:"Pull-up",detail:"10 min EMOM • 8–12 reps/min • stay submaximal",minutes:10,target:"8–12/min",rest:60,previousMode:"emom"},
  {id:"curl-a",kind:"ACCESSORY",name:"Band Curl",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"}
 ]},
 Wednesday:{title:"PUSH B",subtitle:"Pike progression • Diamond grip • Push-up EMOM",warmup:pushWarmup,blocks:[
  {id:"pike",kind:"PERFORMANCE",name:"Pike Push-up",detail:"3 × 6–10 • RIR 1–2 • use the current progression rung",sets:3,target:"6–10",rest:150,previousMode:"reps"},
  {id:"diamond",kind:"PERFORMANCE",name:"Diamond Push-up",detail:"3 × 12–20 • RIR 1–2 • harder push variation",sets:3,target:"12–20",rest:120,previousMode:"reps"},
  {id:"pushup-emom-b",kind:"EMOM",name:"Push-up",detail:"10 min EMOM • 10–14 reps/min • accumulate quality volume",minutes:10,target:"10–14/min",rest:60,previousMode:"emom"},
  {id:"dips-emom-b",kind:"EMOM",name:"Dips",detail:"8–10 min EMOM • 5–8 reps/min • stay submaximal",minutes:10,target:"5–8/min",rest:60,previousMode:"emom"},
  {id:"lat-b",kind:"ACCESSORY",name:"Band Lateral Raise",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"tri-b",kind:"ACCESSORY",name:"Band Overhead Triceps Extension",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"}
 ]},
 Thursday:{title:"PULL B",subtitle:"OAP • Assisted volume • Chin endurance",warmup:pullWarmup,blocks:[
  {id:"oap",kind:"SKILL_REPS",name:"One Arm Pull-up",detail:"6 quality attempts • mostly singles until clean doubles are repeatable",sets:6,target:"1–2 / arm",rest:240,previousMode:"reps"},
  {id:"oap-band",kind:"VOLUME_SKILL",name:"Assisted One Arm Pull-up",detail:"3 × 3–6 / arm • use the lightest band that keeps the OAP pattern",sets:3,target:"3–6 / arm",rest:180,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"archer-pull",kind:"PERFORMANCE",name:"Archer Pull-up",detail:"3 × 5–8 / side • controlled transfer to the working arm",sets:3,target:"5–8 / side",rest:165,previousMode:"reps"},
  {id:"close-chin",kind:"EMOM",name:"Close-Grip Chin-up",detail:"10 min EMOM • 7–10 reps/min • leave room for quality",minutes:10,target:"7–10/min",rest:60,previousMode:"emom"},
  {id:"curl-b",kind:"ACCESSORY",name:"Band Curl",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"leg-raise",kind:"CORE",name:"Hanging Leg Raise",detail:"3 × 8–15",sets:3,target:"8–15",rest:90,previousMode:"reps"}
 ]},
 Friday:{title:"PUSH C",subtitle:"Long-set practice • Close grip • Dips density",warmup:pushWarmup,blocks:[
  {id:"pushup-long",kind:"PERFORMANCE",name:"Push-up Long Set",detail:"1 × 25–35 • stop around RIR 2 • build toward a 100-rep set",sets:1,target:"25–35",rest:180,previousMode:"reps"},
  {id:"dips-long",kind:"PERFORMANCE",name:"Dips Long Set",detail:"1 × 25–35 • stop around RIR 2 • build toward a 50-rep set",sets:1,target:"25–35",rest:180,previousMode:"reps"},
  {id:"close-pushup",kind:"PERFORMANCE",name:"Close-Grip Push-up",detail:"3 × 12–20 • RIR 1–2 • triceps emphasis",sets:3,target:"12–20",rest:120,previousMode:"reps"},
  {id:"pushup-emom-c",kind:"EMOM",name:"Push-up",detail:"8–12 min EMOM • 8–12 reps/min • accumulate clean volume",minutes:10,target:"8–12/min",rest:60,previousMode:"emom"},
  {id:"dips-emom-c",kind:"EMOM",name:"Dips",detail:"8–12 min EMOM • 5–7 reps/min • accumulate clean volume",minutes:10,target:"5–7/min",rest:60,previousMode:"emom"},
  {id:"lat-c",kind:"ACCESSORY",name:"Band Lateral Raise",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"}
 ]},
 Saturday:{title:"PULL C",subtitle:"FL Pull-up • Front Lever touch pathway • Pull-up density",warmup:pullWarmup,blocks:[
  {id:"flpu",kind:"SKILL_REPS",name:"Full Front Lever Pull-up",detail:"5 quality sets • current range 2–4 reps • build toward 5+ without shape loss",sets:5,target:"2–4",rest:240,previousMode:"reps"},
  {id:"flpu-band",kind:"VOLUME_SKILL",name:"Band-Assisted FL Pull-up",detail:"3 × 3–6 • add volume without degrading the full-position pattern",sets:3,target:"3–6",rest:180,bandOptions:["Blue 15–25 lb","Purple 25–40 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"chest-high",kind:"PERFORMANCE",name:"Chest-to-Bar / High Pull-up",detail:"3 × 5–8 • explosive but controlled",sets:3,target:"5–8",rest:180,previousMode:"reps"},
  {id:"close-pull",kind:"EMOM",name:"Close-Grip Pull-up",detail:"10 min EMOM • 7–10 reps/min • build pull endurance without maxing out",minutes:10,target:"7–10/min",rest:60,previousMode:"emom"},
  {id:"curl-c",kind:"ACCESSORY",name:"Band Curl",detail:"3 × 15–30",sets:3,target:"15–30",rest:75,bandOptions:["Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb","Black 60–170 lb"],defaultBand:"Purple 25–40 lb",previousMode:"reps"},
  {id:"hollow-rocks",kind:"CORE",name:"Hollow-to-Arch Rocks",detail:"3 × 10–20",sets:3,target:"10–20",rest:60,previousMode:"reps"}
 ]},
 Sunday:{title:"LEGS",subtitle:"Power • Unilateral strength • Hypertrophy",warmup:[
  {id:"leg-ankle",name:"Ankle rocks",dose:"2 × 10 / side"},
  {id:"leg-swings",name:"Leg swings",dose:"2 × 10 / side"},
  {id:"leg-squat",name:"Squat-to-stand",dose:"2 × 6"},
  {id:"leg-lunge",name:"Reverse lunge + reach",dose:"1 × 6 / side"},
  {id:"leg-pogo",name:"Pogo hops",dose:"2 × 15"},
  {id:"leg-snap",name:"Snap-down to athletic stance",dose:"2 × 5"},
  {id:"leg-jump-prep",name:"Low broad jump rehearsal",dose:"2 × 2"}
 ],blocks:[
  {id:"broad-jump",kind:"PERFORMANCE",name:"Broad Jump",detail:"4 × 3 • maximal horizontal power • full reset",sets:4,target:"3",rest:150,previousMode:"reps"},
  {id:"cmj",kind:"PERFORMANCE",name:"Countermovement Jump",detail:"4 × 3 • maximal vertical jump • full reset",sets:4,target:"3",rest:150,previousMode:"reps"},
  {id:"bulgarian",kind:"ACCESSORY",name:"Bulgarian Split Squat",detail:"4 × 6–10 / leg • RIR 1–2 • use band only if BW is too easy",sets:4,target:"6–10 / leg",rest:150,bandOptions:["None","Purple 25–40 lb","Yellow 40–80 lb","Red 50–125 lb"],defaultBand:"None",previousMode:"reps"},
  {id:"pistol",kind:"ACCESSORY",name:"Pistol Squat / Assisted Pistol",detail:"3 × 6–10 / leg • controlled depth",sets:3,target:"6–10 / leg",rest:120,previousMode:"reps"},
  {id:"sl-rdl",kind:"ACCESSORY",name:"Single-Leg RDL with Band",detail:"3 × 8–12 / leg • slow eccentric",sets:3,target:"8–12 / leg",rest:100,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"},
  {id:"jump-lunge",kind:"PERFORMANCE",name:"Split Jump / Jump Lunge",detail:"3 × 5–8 / leg • stop before speed drops",sets:3,target:"5–8 / leg",rest:120,previousMode:"reps"},
  {id:"calf",kind:"ACCESSORY",name:"Single-Leg Calf Raise",detail:"3 × 12–20 / leg • 2-sec peak hold",sets:3,target:"12–20 / leg",rest:75,previousMode:"reps"},
  {id:"band-legcurl",kind:"ACCESSORY",name:"Band Leg Curl",detail:"3 × 12–20 / leg",sets:3,target:"12–20 / leg",rest:75,bandOptions:["Blue 15–25 lb","Purple 25–40 lb","Yellow 40–80 lb"],defaultBand:"Blue 15–25 lb",previousMode:"reps"}
 ]}
};
