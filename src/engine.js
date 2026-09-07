import {validProfile} from './profile.js';
import {remainingMinutes,taskMetrics,validStudyFields,dailyCapacity} from './workload.js';
// Deterministic, offline Korean notice analysis. No trained model or external AI API.
export const FIELDS = {due:'마감일',time:'시각',subject:'과목',amount:'분량',format:'제출 방식',place:'장소',materials:'준비물',cost:'비용',audience:'대상'};
export const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const today = () => iso(new Date());
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  return iso(new Date(`${value}T12:00:00`)) === value;
}
export function addDays(value, days) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+days); return iso(date); }
const unique = values => [...new Set(values.filter(Boolean))];
function dateCandidates(text, base) {
  const dates = []; const evidence = []; const issues = [];
  const add = (value, raw) => {if (validDate(value)) {dates.push(value); evidence.push(raw);} else issues.push(`실제 달력에 없는 날짜입니다: ${raw}`);};
  let rest = text;
  rest = rest.replace(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})(?:일)?/g, (raw,y,m,d)=>{add(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,raw);return ' ';});
  rest.replace(/(\d{1,2})\s*(?:월|[/.])\s*(\d{1,2})\s*일?/g,(raw,m,d)=>{add(`${base.slice(0,4)}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,raw);return raw;});
  if (!dates.length) {
    for (const [word,offset] of [['오늘',0],['내일',1],['모레',2]]) if (rest.includes(word)) add(addDays(base,offset),word);
    if (!dates.length) {
      const match = rest.match(/(?:(이번|다음)\s*주\s*)?([월화수목금토일])요일/);
      if (match) {
        const weekday = '일월화수목금토'.indexOf(match[2]);
        const current = new Date(`${base}T12:00:00`).getDay();
        let delta = weekday-current;
        if (match[1]) delta = (weekday+6)%7-(current+6)%7+(match[1]==='다음'?7:0);
        else if(delta<0) delta+=7;
        add(addDays(base,delta),match[0]);
      }
    }
  }
  const values = unique(dates);
  if(values.length>1) issues.push('날짜가 여러 개 있습니다. 실제 제출 마감일을 선택해 주세요.');
  return {value:values.length===1?values[0]:null,evidence:unique(evidence).join(' / '),issues};
}
function labeled(text, label) {
  const pattern = new RegExp(`(?:${label})\\s*[:：]\\s*([^\\n;]+)`, 'g');
  return unique([...text.matchAll(pattern)].map(m=>m[1].trim()));
}
export function analyze(text, base=today()) {
  if (!validDate(base)) throw new Error('공지 작성일을 올바르게 입력해 주세요.');
  const fields = Object.fromEntries(Object.keys(FIELDS).map(key=>[key,null]));
  const evidence = {}; const issues=[];
  const dates=dateCandidates(text,base); fields.due=dates.value; evidence.due=dates.evidence; issues.push(...dates.issues);
  const put=(key,values)=>{values=unique(values); if(values.length===1) fields[key]=values[0]; else if(values.length>1) issues.push(`${FIELDS[key]} 후보가 여러 개입니다: ${values.join(', ')}`); evidence[key]=values.join(' / ');};
  put('subject',[...text.matchAll(/물리(?:학)?|화학|생명과학|생물|지구과학|수학|국어|영어|한국사|역사|정보|사회|음악|미술|체육/g)].map(m=>m[0]));
  put('amount',[...text.matchAll(/\d+\s*(?:쪽|페이지|문항|문제|장)(?!소)/g)].map(m=>m[0].replace(/\s/g,'')));
  const times = [...text.matchAll(/(?:(오전|오후)\s*)?(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)/g)].map(m=>{
    let h=Number(m[2]), min=Number(m[3]||m[4]||0);
    if(m[1]==='오후'&&h<12)h+=12; if(m[1]==='오전'&&h===12)h=0;
    if(h>23||min>59){issues.push(`시각을 확인해 주세요: ${m[0]}`);return null;}
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }); put('time',times);
  for(const [key,label] of [['format','제출 방식|제출 방법|제출 형식'],['place','장소|집합 장소'],['materials','준비물'],['cost','비용|참가비'],['audience','대상']]) put(key,labeled(text,label));
  if(!evidence.format) put('format',[...text.matchAll(/PDF|PPTX?|HWPX?|손글씨|종이 제출|온라인 제출|파일 제출/gi)].map(m=>m[0].toUpperCase()));
  if(!evidence.place) put('place',[...text.matchAll(/\d{2,4}호|(?:물리|화학|과학|정보)실|도서관|강당|체육관/g)].map(m=>m[0]));
  if(!evidence.cost) put('cost',[...text.matchAll(/\d[\d,]*\s*원|무료/g)].map(m=>m[0]));
  if(/미정|추후|별도 안내|다음\s*주(?!\s*[월화수목금토일]요일)|조만간/.test(text)) issues.push('미정·추후 안내 또는 넓은 날짜 표현이 있습니다. 담당자에게 확인해 주세요.');
  if(/취소/.test(text)) issues.push('취소 표현이 있습니다. 과제 전체 취소인지는 직접 확인해 주세요.');
  if(/변경|→|에서.+(?:로|으로)/.test(text)) issues.push('변경 설명에 이전 값이 함께 있을 수 있습니다. 최종 값을 확인해 주세요.');
  const questions=[];
  if(!fields.due) questions.push('정확한 제출 마감 날짜는 언제인가요?');
  if(!fields.time) questions.push('마감일 몇 시까지 제출해야 하나요?');
  if(!fields.format) questions.push('어떤 형식으로, 어디에 제출해야 하나요?');
  if(!fields.amount) questions.push('제출 분량이나 수행 범위는 어떻게 되나요?');
  if(!/평가|배점|채점/.test(text)) questions.push('평가 기준이나 꼭 포함해야 할 내용이 있나요?');
  return {fields,evidence,issues:unique(issues),questions,base,text};
}
export function compare(oldAnalysis,newAnalysis) {
  return Object.keys(FIELDS).flatMap(key=>{
    const before=oldAnalysis.fields[key], after=newAnalysis.fields[key];
    if(before===after && oldAnalysis.evidence[key]===newAnalysis.evidence[key]) return [];
    if(!before&&!after&&!oldAnalysis.evidence[key]&&!newAnalysis.evidence[key]) return [];
    return [{key,label:FIELDS[key],before,after,oldEvidence:oldAnalysis.evidence[key]||'표현 없음',newEvidence:newAnalysis.evidence[key]||'표현 없음',kind:before&&!after?'확인 필요':!before&&after?'추가':'변경'}];
  });
}
export function plan(tasks, capacity, start=today(), horizon=14) {
  const days=Array.from({length:horizon},(_,i)=>{const date=addDays(start,i);return {date,capacity:dailyCapacity(capacity,date),used:0,items:[]};});
  const missing=[], overflow=[];
  const active=tasks.filter(t=>!t.done);
  const sorted=active.filter(t=>validDate(t.fields.due)).sort((a,b)=>a.fields.due.localeCompare(b.fields.due)||b.priority-a.priority);
  missing.push(...active.filter(t=>!validDate(t.fields.due)).map(t=>t.id));
  for(const task of sorted) {
    let remaining=remainingMinutes(task);
    if(task.fields.due<start){overflow.push({id:task.id,minutes:remaining,reason:'마감 지남'});continue;}
    if(task.fields.due>days.at(-1).date) continue;
    // Reserve the earliest deadline first; place its sessions backwards from the deadline.
    for(let i=days.length-1;i>=0&&remaining>0;i--) {
      const day=days[i]; if(day.date>task.fields.due)continue;
      const minutes=Math.min(remaining,Math.max(0,day.capacity-day.used));
      if(minutes){day.used+=minutes;day.items.push({id:task.id,title:task.title,minutes});remaining-=minutes;}
    }
    if(remaining>0)overflow.push({id:task.id,minutes:remaining,reason:'가용 시간 부족'});
  }
  for(const day of days)day.items.sort((a,b)=>taskMetrics(tasks.find(t=>t.id===b.id),capacity,start).score-taskMetrics(tasks.find(t=>t.id===a.id),capacity,start).score);
  return {days,overflow,missing,totalShortage:overflow.reduce((n,x)=>n+x.minutes,0)};
}
export function validateBackup(data) {
  if(!data||![1,2].includes(data.version)||!Array.isArray(data.tasks)||data.tasks.length>300) return false;
  if(data.version===2&&!validProfile(data.profile))return false;
  if(!Number.isFinite(data.capacity)||data.capacity<15||data.capacity>720)return false;
  const ids=new Set();
  return data.tasks.every(t=>{
    if(!t||typeof t.id!=='string'||ids.has(t.id))return false; ids.add(t.id);
    if(!validStudyFields(t))return false;
    return typeof t.title==='string'&&t.title.length>0&&t.title.length<=200&&typeof t.source==='string'&&t.source.length<=12000&&validDate(t.sourceDate)&&t.fields&&Object.keys(FIELDS).every(k=>t.fields[k]===null||typeof t.fields[k]==='string'&&t.fields[k].length<=1000)&&(!t.fields.due||validDate(t.fields.due))&&Number.isFinite(t.minutes)&&t.minutes>=0&&t.minutes<=10080&&[1,2,3].includes(t.priority)&&typeof t.done==='boolean'&&Array.isArray(t.history)&&t.history.length<=100&&t.history.every(h=>h&&typeof h.source==='string'&&h.source.length<=12000&&validDate(h.sourceDate)&&typeof h.at==='string');
  });
}
