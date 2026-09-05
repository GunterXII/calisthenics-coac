import type {ExerciseBlock} from './types';

/** Remove static prescription prefixes from prose so adaptive values are shown only once. */
export function stripPrescriptionPrefix(value:string|undefined):string{
  if(!value)return '';
  return value
    .replace(/^\s*\d+\s*[×x]\s*[^•·]+\s*[•·]\s*/i,'')
    .replace(/^\s*\d+\s*min\s+EMOM\s*•\s*/i,'')
    .replace(/\s*·\s*Coach:.*$/i,'')
    .trim();
}

export function displayBlockDetail(block:ExerciseBlock,uiCopy:(value:string|undefined)=>string):string{
  return stripPrescriptionPrefix(uiCopy(block.detail));
}

export function coachNoteForBlock(block:ExerciseBlock,uiCopy:(value:string|undefined)=>string):string|undefined{
  if(block.coachNote)return block.coachNote;
  const legacy=uiCopy(block.detail).match(/(?:^|\s)Coach:\s*(.+)$/i);
  return legacy?.[1]?.trim();
}
