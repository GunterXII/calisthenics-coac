import type { ExerciseBlock, ProgressionCriteria, ProgressionSpec } from "./types";

export interface ProgressionRegistryEntry {
  current:string; next:string; rule:string; regression?:string; bandMode?:"assistance"|"resistance"|"none";
  targetMaxIncrement:number; variantMasteryNextVariantId:string; ladder:{id:string;name:string}[]; targetCriteria?: ProgressionCriteria; masteryCriteria?: ProgressionCriteria;
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

export const PROGRESSIONS:Record<string,Pick<ProgressionRegistryEntry,"current"|"next"|"rule"|"regression"|"bandMode">> =
  Object.fromEntries(Object.entries(PROGRESSION_SPECS).map(([k,v])=>[k,{
    current:v.current,next:v.next,rule:v.rule,regression:v.regression,bandMode:v.bandMode
  }])) as Record<string,Pick<ProgressionRegistryEntry,"current"|"next"|"rule"|"regression"|"bandMode">>;

export function progressionKeyForExerciseId(exerciseId:string):string {
  return PROGRESSION_SPECS[exerciseId] ? exerciseId
    : exerciseId==="pike-feet" ? "pike"
    : exerciseId==="diamond-feet" ? "diamond"
    : exerciseId==="archer-push" ? "archer-push"
    : exerciseId;
}

export function progressionEntryForBlock(block:ExerciseBlock):ProgressionRegistryEntry|undefined {
  const key=block.progressionSpecId || progressionKeyForExerciseId(block.id);
  return PROGRESSION_SPECS[key];
}

function parseTarget(target:string){
  const m=(target||"").match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(m)return {min:Number(m[1]),max:Number(m[2])};
  const one=(target||"").match(/(\d+(?:\.\d+)?)/);
  if(one)return {min:Number(one[1]),max:Number(one[1])};
  return {min:0,max:0};
}

export function criteriaForBlock(block:ExerciseBlock):ProgressionCriteria {
  const entry=progressionEntryForBlock(block);
  const target=parseTarget(block.target);
  const sets=Math.max(1,block.sets||3);
  const upper=target.max>0?target.max:1;

  if(entry?.targetCriteria) return {...entry.targetCriteria};
  if(block.id==="touch"||block.id==="front-lever-touch") return {type:"seconds",minHolds:sets,minSeconds:upper,minRir:1,requireClean:true,consecutiveSessions:2};
  if(block.id==="oap") return {type:"reps",minSets:Math.min(3,sets),minReps:2,minRir:2,requireClean:false,consecutiveSessions:2,side:"both",minQualifyingRepsPerSide:2};
  if(block.kind==="SKILL_STATIC") return {type:"seconds",minHolds:sets,minSeconds:upper,minRir:1,requireClean:true,consecutiveSessions:2};
  if(block.progressionMode==="hypertrophy_reps"){
    return {type:"reps",minSets:Math.min(3,sets),minReps:Math.max(1,target.max||1),minRir:1,requireClean:false,consecutiveSessions:2};
  }
  if(block.kind==="EMOM"){
    const minPerMinute=Math.max(1,Math.floor(target.min||upper));
    return {type:"emom",minutes:Math.max(1,block.minutes||10),minPerMinute,maxDropoffPct:15,maxCvPct:20,minLastVsFirstPct:85,consecutiveSessions:2,minRir:block.id.includes("dips")?2:undefined};
  }
  return {type:"reps",minSets:sets,minReps:upper,minRir:entry?.rule.includes("RIR 1")||entry?.rule.includes("RIR ≥1")||entry?.rule.includes("RIR 1–2")?1:undefined,requireClean:false,consecutiveSessions:2};
}

export function masteryCriteriaForBlock(block:ExerciseBlock):ProgressionCriteria {
  const entry=progressionEntryForBlock(block);
  if(entry?.masteryCriteria) return {...entry.masteryCriteria};
  const sets=Math.max(1,Math.min(block.sets||3,5));
  const target=parseTarget(block.target);
  if(block.id==="oap") return {type:"reps",minSets:Math.min(3,sets),minReps:2,minRir:1,requireClean:false,consecutiveSessions:3,side:"both",minQualifyingRepsPerSide:2};
  if(block.id==="flpu") return {type:"reps",minSets:Math.min(3,sets),minReps:Math.max(1,target.max-1),minRir:1,requireClean:true,consecutiveSessions:3};
  if(block.id==="touch"||block.id==="front-lever-touch") return {type:"seconds",minHolds:Math.min(3,sets),minSeconds:Math.min(8,target.max||4),minRir:1,requireClean:true,consecutiveSessions:3};
  if(block.kind==="EMOM") return {type:"emom",minutes:Math.max(1,Math.min(block.minutes||10,15)),minPerMinute:Math.max(1,target.min||1),maxDropoffPct:15,maxCvPct:20,minLastVsFirstPct:85,consecutiveSessions:3};
  if(block.progressionMode==="hypertrophy_reps") return {type:"reps",minSets:Math.min(3,sets),minReps:Math.max(1,target.max||1),minRir:1,requireClean:false,consecutiveSessions:2};
  return criteriaForBlock(block);
}

export function progressionGateForBlock(block:ExerciseBlock) {
  const mastery=masteryCriteriaForBlock(block);
  return {
    training:criteriaForBlock(block),
    mastery,
    consecutiveExposures:mastery.consecutiveSessions||2,
    reason:block.trainingRole==="skill"
      ?"Skill promotion requires repeated clean exposures; one good session is not enough."
      :"Use repeated comparable exposures before changing the dose."
  };
}

export function progressionSpecForBlock(block:ExerciseBlock,nextVariantId?:string):ProgressionSpec {
  const entry=progressionEntryForBlock(block);
  const targetCriteria=criteriaForBlock(block);
  const masteryCriteria=masteryCriteriaForBlock(block);
  return {
    current:entry?.current||block.name,
    next:entry?.next||block.name,
    rule:entry?.rule||"Exercise-specific progression criteria",
    bandMode:entry?.bandMode,
    regression:entry?.regression,
    targetProgression:{criteria:targetCriteria,maxIncrement:entry?.targetMaxIncrement},
    variantMastery:{
      criteria:masteryCriteria,
      nextVariantId:nextVariantId||entry?.variantMasteryNextVariantId||block.id
    }
  };
}

export function nextTargetFromSpec(currentTarget:string,spec:ProgressionSpec,kind:ExerciseBlock["kind"]):string {
  const m=currentTarget.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  if(!m)return currentTarget;
  const minV=Number(m[1]),maxV=Number(m[2]),inc=spec.targetProgression.maxIncrement??1;
  const isSeconds=currentTarget.toLowerCase().includes("sec")||kind==="SKILL_STATIC";
  if(isSeconds)return `${minV+inc}–${maxV+inc} sec`;
  return kind==="EMOM"?`${minV+inc}–${maxV+inc}/min`:`${minV+inc}–${maxV+inc}`;
}

export function getProgressionLadder(exerciseId:string){
  return PROGRESSION_SPECS[progressionKeyForExerciseId(exerciseId)]?.ladder||[];
}

export function getProgressionSpec(exerciseId:string){
  return PROGRESSION_SPECS[progressionKeyForExerciseId(exerciseId)];
}
