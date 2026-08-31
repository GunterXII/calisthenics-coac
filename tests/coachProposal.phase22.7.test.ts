import assert from 'node:assert/strict';
import { buildCoachProposalDraft } from '../src/coachProposalEngine';

const ctx:any = {
  phase:{id:'acc',type:'ACCUMULATION',week:1,totalWeeks:4,adaptationWeights:{skill:.3,strength:.2,hypertrophy:.4,endurance:.1,power:0},fatigueBudget:100},
  goals:[
    {goal:{id:'oap',label:'OAP'},current:2,target:5,status:'BUILDING',best:2,trendPct:0,confidence:.7},
    {goal:{id:'flpu',label:'Front Lever Pull-Up'},current:0,target:5,status:'BUILDING',best:0,trendPct:0,confidence:.7},
    {goal:{id:'front_lever_touch',label:'Front Lever Touch'},current:4,target:8,status:'REALIZING',best:4,trendPct:-40,confidence:.7},
    {goal:{id:'pushups',label:'Push-ups'},current:0,target:100,status:'BUILDING',best:0,trendPct:0,confidence:.7},
    {goal:{id:'dips',label:'Dips'},current:0,target:50,status:'BUILDING',best:0,trendPct:0,confidence:.7},
  ],
  sessions:[],insights:[],weeklyFatigue:3,recoveryStatus:'FRESH',
  hypertrophy:[
    {muscle:'chest',currentSets:1.6,status:'LOW',previousSets:5,trendPct:-67,currentStimulus:1,confidence:'LOW'},
    {muscle:'triceps',currentSets:1.6,status:'LOW',previousSets:5,trendPct:-67,currentStimulus:1,confidence:'LOW'},
    {muscle:'front_delts',currentSets:1.6,status:'LOW',previousSets:5,trendPct:-67,currentStimulus:1,confidence:'LOW'},
    {muscle:'side_delts',currentSets:0,status:'LOW',previousSets:0,trendPct:0,currentStimulus:0,confidence:'LOW'},
  ],
  skillReadiness:[
    {goalId:'oap',recoveryOk:true}, {goalId:'flpu',recoveryOk:true}, {goalId:'front_lever_touch',recoveryOk:true}, {goalId:'pushups',recoveryOk:true}, {goalId:'dips',recoveryOk:true}
  ]
};

const draft = buildCoachProposalDraft(ctx,'modifica il Push A per aumentare l ipertrofia senza compromettere OAP FL Pull-Up e Front Lever Touch');
assert(draft);
assert.equal(draft!.exerciseId,'lat-a');
assert(draft!.impact);
assert.equal(draft!.impact!.goalProtection.find((x:any)=>x.goalId==='oap')?.status,'PROTECTED');
assert((draft!.evidence||[]).some((x:any)=>x.label==='Gap ipertrofico'));
console.log('Phase 22.7 proposal quality: PASS');
