import type { ExerciseCatalogItem } from "./exercises";

export type SkillGraphStatus = "CURRENT" | "READY" | "LOCKED" | "UNAVAILABLE";

export interface SkillGraphNode {
  id: string;
  exerciseId: string;
  name: string;
  difficulty: 1|2|3|4|5;
  prerequisiteIds?: string[];
}

export interface SkillGraph {
  id: string;
  name: string;
  pattern: "push" | "pull" | "balance" | "core";
  nodes: SkillGraphNode[];
}

export interface SkillGraphView extends SkillGraph {
  currentIndex: number;
  current?: SkillGraphNode;
  next?: SkillGraphNode;
  status: SkillGraphStatus;
  completion: number;
  note: string;
}

// A graph is deliberately a prerequisite map, not a simple difficulty sort.
// This keeps the Coach from suggesting a harder-looking exercise that bypasses
// the actual mechanical requirement of the skill.
export const SKILL_GRAPHS: SkillGraph[] = [
  {
    id: "planche",
    name: "Planche",
    pattern: "push",
    nodes: [
      {id:"planche-lean", exerciseId:"planche-lean", name:"Planche Lean", difficulty:2},
      {id:"tuck-planche", exerciseId:"tuck-planche", name:"Tuck Planche", difficulty:3, prerequisiteIds:["planche-lean"]},
      {id:"advanced-tuck-planche", exerciseId:"advanced-tuck-planche", name:"Advanced Tuck Planche", difficulty:4, prerequisiteIds:["tuck-planche"]},
      {id:"straddle-planche", exerciseId:"straddle-planche", name:"Straddle Planche", difficulty:5, prerequisiteIds:["advanced-tuck-planche"]},
      {id:"full-planche", exerciseId:"full-planche", name:"Full Planche", difficulty:5, prerequisiteIds:["straddle-planche"]},
    ]
  },
  {
    id: "front-lever",
    name: "Front Lever",
    pattern: "pull",
    nodes: [
      {id:"tuck-front-lever", exerciseId:"tuck-front-lever", name:"Tuck Front Lever", difficulty:2},
      {id:"advanced-tuck-front-lever", exerciseId:"advanced-tuck-front-lever", name:"Advanced Tuck Front Lever", difficulty:3, prerequisiteIds:["tuck-front-lever"]},
      {id:"one-leg-front-lever", exerciseId:"one-leg-front-lever", name:"One-Leg Front Lever", difficulty:4, prerequisiteIds:["advanced-tuck-front-lever"]},
      {id:"straddle-front-lever", exerciseId:"straddle-front-lever", name:"Straddle Front Lever", difficulty:5, prerequisiteIds:["one-leg-front-lever"]},
      {id:"full-front-lever", exerciseId:"full-front-lever", name:"Full Front Lever", difficulty:5, prerequisiteIds:["straddle-front-lever"]},
      {id:"front-lever-touch", exerciseId:"front-lever-touch", name:"Front Touch", difficulty:5, prerequisiteIds:["full-front-lever"]},
      {id:"wide-front-lever-touch", exerciseId:"wide-front-lever-touch", name:"Wide Front Lever Touch", difficulty:5, prerequisiteIds:["front-lever-touch"]},
      {id:"straight-arm-touch", exerciseId:"straight-arm-touch", name:"Straight Arm Touch (SAT)", difficulty:5, prerequisiteIds:["wide-front-lever-touch"]},
    ]
  },
  {
    id: "oap",
    name: "One-Arm Pull-up",
    pattern: "pull",
    nodes: [
      {id:"archer-pullup", exerciseId:"archer-pullup", name:"Archer Pull-up", difficulty:4},
      {id:"assisted-oap", exerciseId:"assisted-oap", name:"Assisted One-Arm Pull-up", difficulty:3, prerequisiteIds:["archer-pullup"]},
      {id:"oap-negative", exerciseId:"oap-negative", name:"One-Arm Pull-up Negative", difficulty:4, prerequisiteIds:["assisted-oap"]},
      {id:"oap-isometric", exerciseId:"oap-isometric", name:"One-Arm Pull-up Isometric", difficulty:4, prerequisiteIds:["oap-negative"]},
      {id:"one-arm-pullup", exerciseId:"one-arm-pullup", name:"One-Arm Pull-up", difficulty:5, prerequisiteIds:["oap-isometric"]},
    ]
  },
  {
    id: "muscle-up",
    name: "Muscle-up",
    pattern: "pull",
    nodes: [
      {id:"chest-to-bar", exerciseId:"chest-to-bar", name:"Chest-to-Bar Pull-up", difficulty:3},
      {id:"high-pullup", exerciseId:"high-pullup", name:"High Pull-up", difficulty:4, prerequisiteIds:["chest-to-bar"]},
      {id:"low-bar-transition", exerciseId:"low-bar-transition", name:"Low-Bar Transition", difficulty:2, prerequisiteIds:["high-pullup"]},
      {id:"muscle-up-negative", exerciseId:"muscle-up-negative", name:"Muscle-up Negative", difficulty:3, prerequisiteIds:["low-bar-transition"]},
      {id:"strict-muscle-up", exerciseId:"strict-muscle-up", name:"Strict Muscle-up", difficulty:5, prerequisiteIds:["muscle-up-negative"]},
    ]
  },
  {
    id: "hspu",
    name: "Handstand Push-up",
    pattern: "balance",
    nodes: [
      {id:"wall-handstand", exerciseId:"wall-handstand", name:"Wall Handstand", difficulty:2},
      {id:"pike-pushup", exerciseId:"pike-pushup", name:"Pike Push-up", difficulty:2, prerequisiteIds:["wall-handstand"]},
      {id:"feet-elevated-pike", exerciseId:"feet-elevated-pike", name:"Feet-Elevated Pike Push-up", difficulty:3, prerequisiteIds:["pike-pushup"]},
      {id:"wall-hspu", exerciseId:"wall-hspu", name:"Wall HSPU", difficulty:4, prerequisiteIds:["feet-elevated-pike"]},
      {id:"deficit-wall-hspu", exerciseId:"deficit-wall-hspu", name:"Deficit Wall HSPU", difficulty:5, prerequisiteIds:["wall-hspu"]},
      {id:"freestanding-hspu", exerciseId:"freestanding-hspu", name:"Freestanding HSPU", difficulty:5, prerequisiteIds:["deficit-wall-hspu"]},
    ]
  }
];

function normalize(v: unknown){ return String(v ?? "").trim().toLowerCase(); }

export function buildSkillGraphViews(catalog: ExerciseCatalogItem[], activeExerciseIds: string[], qualifyingExerciseIds: string[] = []): SkillGraphView[] {
  const catalogIds = new Set(catalog.map(x => x.id));
  const active = new Set(activeExerciseIds.map(normalize));
  const qualifying = new Set(qualifyingExerciseIds.map(normalize));

  return SKILL_GRAPHS.map(graph => {
    const available = graph.nodes.filter(n => catalogIds.has(n.exerciseId));
    if (!available.length) return {...graph, currentIndex:-1, status:"UNAVAILABLE" as const, completion:0, note:"Catalog does not contain enough nodes for this pathway."};

    let currentIndex = -1;
    for (let i=0;i<available.length;i++) {
      if (active.has(normalize(available[i].exerciseId))) currentIndex = i;
    }

    if (currentIndex < 0) {
      return {...graph, currentIndex:-1, current:undefined, next:available[0], status:"LOCKED" as const, completion:0, note:`No active ${graph.name} exposure detected. Start with ${available[0].name}.`};
    }

    const next = available[currentIndex + 1];
    const completion = Math.round(((currentIndex + 1) / available.length) * 100);
    if (!next) return {...graph, currentIndex, current:available[currentIndex], next:undefined, status:"CURRENT" as const, completion, note:"Highest catalog rung reached. Progress through quality, consistency or a harder loading strategy."};

    return {
      ...graph,
      currentIndex,
      current:available[currentIndex],
      next,
      status: qualifying.has(normalize(available[currentIndex].exerciseId)) ? "READY" : "CURRENT",
      completion,
      note:qualifying.has(normalize(available[currentIndex].exerciseId))
        ? `Current rung: ${available[currentIndex].name}. Skill Intelligence has enough evidence to review ${next.name}; the Coach still makes the final decision.`
        : `Current rung: ${available[currentIndex].name}. Next mechanical step: ${next.name}. Build the evidence standard before considering promotion.`
    };
  });
}
