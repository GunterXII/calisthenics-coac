import type {DayKey} from './types';

export type MobilityKind = 'static' | 'dynamic';
export type MobilitySide = 'both' | 'left' | 'right' | 'alternating';

export interface MobilityExercise {
  id: string;
  name: string;
  kind: MobilityKind;
  durationSec?: number;
  reps?: number;
  side?: MobilitySide;
  description: string;
  cue?: string;
}

const UPPER: MobilityExercise[] = [
  {id:'wrist-extension',name:'Wrist Extension Stretch',kind:'static',durationSec:30,side:'both',description:'With the elbow straight, gently extend the wrist until you feel a mild forearm stretch.',cue:'Gentle tension only. Do not force the range.'},
  {id:'wrist-flexion',name:'Wrist Flexion Stretch',kind:'static',durationSec:30,side:'both',description:'With the palm facing down, gently flex the wrist and guide the fingers toward the forearm.',cue:'Keep the shoulder relaxed.'},
  {id:'thread-needle',name:'Thread the Needle',kind:'dynamic',reps:6,durationSec:60,side:'alternating',description:'From quadruped, slide one arm underneath the body, rotate through the upper back, then return and switch sides.',cue:'Move slowly through the thoracic spine.'},
  {id:'childs-pose-lat',name:"Child's Pose + Lat Reach",kind:'static',durationSec:45,side:'alternating',description:'Sit hips toward heels and reach both arms forward. Walk the hands gently to one side to bias the opposite lat, then switch halfway.',cue:'Breathe into the side of the ribcage.'},
  {id:'wall-slides',name:'Scapular Wall Slides',kind:'dynamic',reps:8,durationSec:45,side:'both',description:'Stand tall against a wall and slowly slide the forearms upward while keeping the ribs controlled.',cue:'Prioritize clean scapular movement over height.'},
  {id:'chin-tuck',name:'Chin Tuck',kind:'dynamic',reps:8,durationSec:45,side:'both',description:'Gently draw the chin straight back as if making a double chin, then release without looking down.',cue:'Small, controlled movement.'},
];

const PULL_EXTRA: MobilityExercise[] = [
  {id:'thoracic-rotation',name:'Open Book Rotation',kind:'dynamic',reps:6,durationSec:60,side:'alternating',description:'Lie on your side with knees stacked and rotate the top arm open while following the hand with your eyes.',cue:'Rotate from the upper back, not the lower back.'},
  {id:'lats-hang',name:'Lat Prayer Stretch',kind:'static',durationSec:45,side:'both',description:'Kneel or stand and place the hands high on a support, then sink the chest down to lengthen the lats and shoulders.',cue:'Keep the breath slow and easy.'},
];

const LOWER: MobilityExercise[] = [
  {id:'couch-stretch',name:'Couch Stretch',kind:'static',durationSec:45,side:'alternating',description:'Place the rear shin against a wall or couch and bring the front leg into a comfortable lunge position.',cue:'Keep the pelvis tucked gently; do not force the backbend.'},
  {id:'lizard-lunge',name:'Lizard Lunge',kind:'static',durationSec:45,side:'alternating',description:'Step into a deep lunge with the front foot outside the hand and sink gradually into the hip.',cue:'Stay controlled and keep the front knee tracking well.'},
  {id:'pike-hamstring',name:'Pike Hamstring Stretch',kind:'static',durationSec:45,side:'both',description:'Sit with the legs extended and hinge forward from the hips while keeping the spine long.',cue:'Aim for a smooth posterior-chain stretch, not maximum depth.'},
  {id:'ankle-knee-wall',name:'Ankle Knee-to-Wall',kind:'dynamic',reps:8,durationSec:45,side:'alternating',description:'Drive the knee toward the wall while keeping the heel down, then return and repeat on the other side.',cue:'Track the knee over the foot without collapsing the arch.'},
];

export const POST_WORKOUT_MOBILITY: Record<DayKey, MobilityExercise[]> = {
  Monday: UPPER,
  Tuesday: [...UPPER.slice(0,4), ...PULL_EXTRA, UPPER[4], UPPER[5]],
  Wednesday: UPPER,
  Thursday: [...UPPER.slice(0,3), ...PULL_EXTRA, UPPER[4], UPPER[5]],
  Friday: UPPER,
  Saturday: [...UPPER.slice(0,3), ...PULL_EXTRA, UPPER[4], UPPER[5]],
  Sunday: LOWER,
};
