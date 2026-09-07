import {parseQuick, createQuickTask} from './quick-entry.js';
import {analyze, FIELDS, today} from './engine.js';
import {taskCategory} from './task-kind.js';
const dateToken='(?:20\\d{2}[-./년\\s]+)?\\d{1,2}(?:월|[/.])\\s*\\d{1,2}일?|오늘|내일|모레|(?:(?:이번|다음)\\s*주\\s*)?[월화수목금토일]요일';
export function finalNoticeText(text) {
  return text.replace(new RegExp('('+dateToken+')\\s*(?:에서|→|->)\\s*('+dateToken+')','g'), '$2');
}
function blocks(text, base) {
  const result=[]; let heading='';
  for(const raw of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)) {
    if (/^\[[^\]]+\]\s*\[(?:오전|오후)?\s*\d/.test(raw) || /^[-=]{3,}/.test(raw)) continue;
    const line=raw.replace(/^[-•·*☐□✅✔]\s*|^\d+[.)]\s*/,'');
    if (/^(?:공지|할\s*일|과제|숙제)(?:\s*(?:정리|목록))?\s*[:：]?$/.test(line)) continue;
    if (/^(?:오늘|내일|모레|[월화수목금토일]요일)(?:까지)?\s*(?:할\s*일|과제|공지|숙제)\s*[:：]?$/.test(line)) {heading=line.replace(/\s*(?:할\s*일|과제|공지|숙제).*$/,'');continue;}
    const p=parseQuick(finalNoticeText(line),base);
    const continuation=/^(?:마감|기한|제출일|준비물|장소|비용|참가비|제출 방식|제출 방법|평가 기준|대상)\s*[:：]/.test(line)|| !p.fields.subject && !/보고서|숙제|과제|공부|복습|예습|발표|챙기|가져오|구매|문제/.test(p.title);
    if(result.length && continuation) result[result.length-1]+='\n'+line;
    else result.push((!p.fields.due && heading ? heading+' ' : '')+line);
  }
  return result;
}
const tokens=text=>new Set(parseQuick(text).title.replace(/소요\s*시간|마감(?:일|이|은)?|(?:변경|연장|수정)(?:됐어요|되었어요|됩니다|합니다|된|됨)?|공지|제출|까지|입니다|합니다|해주세요|해요|으로|에서|\d+|[.,:→]/g,' ').replace(/(보고서|발표|자료|숙제|공부|복습|예습|과제)(?:을|를|이|가|은|는|의)\b/g,'$1').split(/\s+/).filter(w=>w.length>1));
function similarity(parsed, task) {
  if(parsed.fields.subject && task.fields.subject && parsed.fields.subject!==task.fields.subject) return 0;
  if(taskCategory(task)!==parsed.category) return 0;
  const a=tokens(parsed.title), b=tokens(task.title);
  if(!a.size || !b.size) return 0;
  const same=[...a].filter(w=>b.has(w)).length;
  // A subject name alone cannot identify a particular assignment.
  if(same===1 && [...a].filter(w=>b.has(w))[0]===parsed.fields.subject) return 0;
  return same / Math.max(a.size,b.size);
}
export function inspectNotice(text,tasks,base=today()) {
  if(!text.trim()||text.length>12000) throw new Error('공지를 1~12,000자로 붙여 넣어 주세요.');
  const parts=blocks(text,base);if(parts.length>100)throw new Error('한 번에 100개까지 분석할 수 있어요.');
  return parts.map(source=>{
    const cleaned=finalNoticeText(source), parsed={...parseQuick(cleaned,base),source};
    const candidates=tasks.filter(t=>!t.done).map(t=>({id:t.id,title:t.title,score:similarity(parsed,t)})).filter(c=>c.score>=0.45).sort((a,b)=>b.score-a.score);
    const top=candidates[0], clear=top && top.score>=0.65 && (!candidates[1]||top.score-candidates[1].score>=0.2);
    const targetId=clear?top.id:null, old=tasks.find(t=>t.id===targetId);
    const warnings=analyze(cleaned,base).issues.filter(s=>!s.startsWith('변경 설명'));
    if(/취소/.test(source))warnings.push('취소 공지는 자동 삭제하지 않아요. 원래 할일에서 직접 완료·삭제를 결정하세요.');
    return {parsed,candidates,targetId,old:old?structuredClone(old):null,choice:clear?'update':candidates.length?'choose':'new',warnings};
  });
}
export function noticeChanges(row, old=row.old) {
  return Object.keys(FIELDS).filter(k=>row.parsed.fields[k]!==null && row.parsed.fields[k]!==old?.fields[k]).map(k=>({label:FIELDS[k],before:old?.fields[k],after:row.parsed.fields[k]})).concat(!row.parsed.minutesEstimated && row.parsed.totalMinutes!==(old?.totalMinutes??old?.minutes)?[{label:'소요 시간',before:old?.totalMinutes??old?.minutes,after:row.parsed.totalMinutes}]:[]);
}
export function applyNoticeRows(tasks, rows, idFactory, at=new Date().toISOString()) {
  const result=structuredClone(tasks), touched=new Set();let added=0,updated=0,skipped=0;
  for(const row of rows) {
    if(row.choice==='choose')throw new Error('비슷한 후보가 여러 개예요. 해당 항목만 선택해 주세요.');
    if(row.choice==='new') {
      const task=createQuickTask(row.parsed,idFactory());
      if(result.some(t=>t.title===task.title&&t.fields.due===task.fields.due&&taskCategory(t)===taskCategory(task))){skipped++;continue;}
      result.push(task);added++;continue;
    }
    const i=result.findIndex(t=>t.id===row.targetId),old=tasks.find(t=>t.id===row.targetId);
    if(!old||JSON.stringify(old)!==JSON.stringify(row.old))throw new Error('분석 이후 원래 기록이 바뀌었어요. 다시 분석해 주세요.');
    if(touched.has(old.id))throw new Error('한 할일을 여러 공지가 동시에 수정해요. 공지를 나누어 반영해 주세요.');
    touched.add(old.id);
    if(!noticeChanges(row,old).length && !row.warnings.length){skipped++;continue;}
    const total=row.parsed.minutesEstimated?(old.totalMinutes??old.minutes):row.parsed.totalMinutes,completed=old.completedMinutes??0;
    if(total<completed)throw new Error('소요 시간이 이미 진행한 시간보다 짧아요. 수정에서 시간을 확인해 주세요.');
    result[i]={...old,fields:{...old.fields,...Object.fromEntries(Object.entries(row.parsed.fields).filter(([,v])=>v!==null))},totalMinutes:total,completedMinutes:completed,minutes:total-completed,source:row.parsed.source,sourceDate:row.parsed.sourceDate,minutesEstimated:row.parsed.minutesEstimated?old.minutesEstimated:false,history:[...old.history,{source:old.source,sourceDate:old.sourceDate,fields:old.fields,minutes:old.minutes,at}].slice(-100)};
    updated++;
  }
  if(result.length>300)throw new Error('최대 300개까지 저장할 수 있어요.');
  return {tasks:result,added,updated,skipped};
}
