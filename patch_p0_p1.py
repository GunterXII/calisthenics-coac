from pathlib import Path
p=Path('src/types.ts')
s=p.read_text()
s=s.replace('export interface ProgressionSpec {\n  current:string;\n  next:string;\n  rule:string;\n  criteria?:ProgressionCriteria;\n  regression?:string;\n  bandMode?:BandMode;\n}', '''export interface TargetProgressionCriteria {\n  criteria:ProgressionCriteria;\n  maxIncrement?:number;\n}\nexport interface VariantMasteryCriteria {\n  criteria:ProgressionCriteria;\n  nextVariantId:string;\n}\nexport interface ProgressionSpec {\n  current:string;\n  next:string;\n  rule:string;\n  targetProgression:TargetProgressionCriteria;\n  variantMastery:VariantMasteryCriteria;\n  regression?:string;\n  bandMode?:BandMode;\n}''')
s=s.replace('  id:string; date:number; day:DayKey; exerciseId:string; exerciseName:string; variantName?:string; kind:BlockKind;', '  id:string; date:number; day:DayKey; exerciseId:string; exerciseName:string; variantId?:string; variantName?:string; kind:BlockKind;')
s=s.replace('  qualityScore:number;\n  stabilityScore:number;', '  qualityKnown:boolean;\n  qualityScore?:number;\n  stabilityScore:number;')
p.write_text(s)

# Patch coaching engine completely via focused replacements
p=Path('src/coachingEngine.ts')
s=p.read_text()
s=s.replace('export interface CoachingLogRecord {', '''export interface CoachingLogRecord {''')
s=s.replace('const num=(v:unknown):number=>typeof v==="number" && Number.isFinite(v)?v:Number.isFinite(Number(v))?Number(v):0;', 'const num=(v:unknown):number=>typeof v==="number" && Number.isFinite(v)?v:typeof v==="string" && v.trim()!=="" && Number.isFinite(Number(v))?Number(v):0;')
s=s.replace('export function qualityScore(log:CoachingLogRecord, expectedAttempts?:number){\n  const explicit=explicitQuality(log);\n  let score=explicit ?? 0;', '''export function qualityScore(log:CoachingLogRecord, expectedAttempts?:number){\n  const explicit=explicitQuality(log);\n  let score=explicit;''')
s=s.replace('  if(log.status!=="complete")score=Math.min(score,0.35);\n  if(typeof log.result.rir==="number")', '  if(log.status!=="complete" && score!==undefined)score=Math.min(score,0.35);\n  if(score===undefined)return undefined;\n  if(typeof log.result.rir==="number")')
s=s.replace('export function qualityIsKnown(log:CoachingLogRecord){\n  return explicitQuality(log) !== undefined;\n}', 'export function qualityIsKnown(log:CoachingLogRecord){ return explicitQuality(log) !== undefined; }')
# Replace evaluate signature result line and quality usage
s=s.replace('  const qualityKnown = qualityIsKnown(log);\n  const quality=qualityScore(log);', '  const qualityKnown = qualityIsKnown(log);\n  const quality=qualityScore(log);')
# replace cleanliness comparisons and push
s=s.replace('if(criteria.requireClean && (!qualityKnown || quality<0.8))qualifies=false;', 'if(criteria.requireClean && (!qualityKnown || (quality??0)<0.8))qualifies=false;')
s=s.replace('    const cleanEnough=quality>=criteria.minQualityPct/100;', '    const cleanEnough=qualityKnown && (quality??0)>=criteria.minQualityPct/100;')
s=s.replace('    if(!cleanEnough)reasons.push(`Quality ${Math.round(quality*100)}% is below ${criteria.minQualityPct}%.`);', '    if(!cleanEnough)reasons.push(qualityKnown?`Quality ${Math.round((quality??0)*100)}% is below ${criteria.minQualityPct}%.`:`Execution quality is not recorded; progression evidence is incomplete.`);')
s=s.replace('  if(qualifies)reasons.push(`Qualifies at ${Math.round(quality*100)}% quality.`);\n  return {qualifies,qualityScore:quality,stabilityScore,reasons,sidePerformance:side,bodyweightPerformance};', '  if(qualifies)reasons.push(`Qualifies with ${qualityKnown?`recorded quality ${Math.round((quality??0)*100)}%`:`no explicit quality requirement`}.`);\n  return {qualifies,qualityKnown,qualityScore:quality,stabilityScore,reasons,sidePerformance:side,bodyweightPerformance};')
# add structured criteria builder and replace criteriaForBlock through variantMasteryCriteria block
start=s.index('export function criteriaForBlock(')
end=len(s)
new=r'''export function criteriaForBlock(block:ExerciseBlock):ProgressionCriteria {
  const target=parseTargetRange(block.target);
  const sets=Math.max(1,block.sets||3);
  const upper=target.max>0?target.max:1;
  if(block.id==="touch" || block.id==="front-lever-touch") return {type:"seconds",minHolds:sets,minSeconds:upper,minRir:1,requireClean:true,consecutiveSessions:2};
  if(block.id==="oap") return {type:"reps",minSets:sets,minReps:2,minRir:2,requireClean:true,consecutiveSessions:2,side:"both",minQualifyingRepsPerSide:2};
  if(block.kind==="SKILL_STATIC") return {type:"seconds",minHolds:sets,minSeconds:upper,minRir:1,requireClean:true,consecutiveSessions:2};
  if(block.kind==="EMOM") return {type:"emom",minutes:Math.max(1,block.minutes||10),minPerMinute:Math.max(1,Math.floor(target.min||upper)),maxDropoffPct:15,maxCvPct:20,minLastVsFirstPct:85,consecutiveSessions:2,minRir:block.id.includes("dips")?2:undefined};
  return {type:"reps",minSets:sets,minReps:upper,minRir:undefined,requireClean:true,consecutiveSessions:2};
}

export function progressionStreak(block:ExerciseBlock, logs:CoachingLogRecord[], criteria:ProgressionCriteria):number {
  let streak=0;
  const required=criteria.consecutiveSessions||1;
  for(let i=logs.length-1;i>=0;i--){
    const ev=evaluateProgression(block,logs[i],criteria);
    if(!ev.qualifies) break;
    streak++;
    if(streak>=required) break;
  }
  return streak;
}

export function variantMasteryCriteria(block:ExerciseBlock):ProgressionCriteria {
  if(block.id==="touch" || block.id==="front-lever-touch") return {type:"seconds",minHolds:3,minSeconds:8,minRir:1,requireClean:true,consecutiveSessions:2};
  return criteriaForBlock(block);
}

export function progressionSpecForBlock(block:ExerciseBlock, nextVariantId:string):import("./types").ProgressionSpec {
  const targetCriteria=criteriaForBlock(block);
  const masteryCriteria=variantMasteryCriteria(block);
  const base=PROGRESSIONS[block.id];
  return {
    current: base?.current || block.name,
    next: base?.next || block.name,
    rule: base?.rule || "Exercise-specific progression criteria",
    bandMode: base?.bandMode,
    regression: base?.regression,
    targetProgression:{criteria:targetCriteria},
    variantMastery:{criteria:masteryCriteria,nextVariantId},
  };
}
'''
s=s[:start]+new
p.write_text(s)

# skillIntelligence: replace any with concrete aliases, remove quality parser dependence
p=Path('src/skillIntelligence.ts'); s=p.read_text()
s=s.replace('import type { ExerciseBlock } from "./types";', 'import type { ExerciseBlock, SessionSummary, WorkoutLog } from "./types";')
s=s.replace('type Log = any;\ntype Session = any;', 'type Log = WorkoutLog & { __session?: SessionSummary };\ntype Session = SessionSummary;')
s=s.replace('const sum = (v: unknown) => Array.isArray(v) ? v.reduce((a:number,b:any)=>a+n(b),0) : 0;', 'const sum = (v: unknown) => Array.isArray(v) ? v.reduce((a:number,b:unknown)=>a+n(b),0) : 0;')
s=s.replace('function qualities(log:Log): string[] {\n  const note=String(log?.result?.note||"");\n  const m=note.match(/qualities\\s+([^;]+)/i);\n  return m ? m[1].split("/").map((x:string)=>x.trim()) : [];\n}\n\nfunction cleanRatio(log:Log) {\n  const qs=qualities(log);\n  if (!qs.length) return 1;\n  return qs.filter(x=>x.toLowerCase()==="clean").length/qs.length;\n}', 'function cleanRatio(log:Log) {\n  const quality=log.result.quality;\n  if(!quality?.length) return undefined;\n  return quality.filter(x=>x==="Clean").length/quality.length;\n}')
s=s.replace('    const quality=cleanRatio(latest);', '    const quality=cleanRatio(latest);')
s=s.replace('(quality>=.8?10:0)', '(quality===undefined?0:quality>=.8?10:0)')
p.write_text(s)
