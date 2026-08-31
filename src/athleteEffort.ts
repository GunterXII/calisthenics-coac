export const RIR_OPTIONS = [0,1,2,3] as const;
export const FATIGUE_OPTIONS = [1,2,3,4,5] as const;

export function rirLabel(value:number){
  return ({0:"Nessuna",1:"1 rep",2:"2 reps",3:"3+ reps"} as Record<number,string>)[value] ?? "—";
}
export function fatigueLabel(value:number){
  return ({1:"Facile",2:"Leggera",3:"Impegnativa",4:"Molto dura",5:"Quasi esausto"} as Record<number,string>)[value] ?? "—";
}
export function effortHint(rir?:number, fatigue?:number){
  if(rir==null && fatigue==null) return "Tocca un valore solo se ti senti in grado di stimarlo.";
  return [rir==null?"":`RIR ${rir}: ${rirLabel(rir)}`, fatigue==null?"":`Fatica ${fatigue}/5: ${fatigueLabel(fatigue)}`].filter(Boolean).join(" · ");
}
