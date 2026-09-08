import {normalizeLanguage} from './notice-language.js';
import {inferCategory} from './task-kind.js';
import {analyze,today,validDate} from './engine.js';
import {resizeProblems} from './workload.js';
export const CATEGORIES={study:'공부',assignment:'과제',bring:'준비물',buy:'구매',other:'일상'};
const durationPattern=/(?<!\d)(?:(-?\d+(?:\.\d+)?)\s*시간(?:\s*(반|\d+\s*분))?|(-?\d+)\s*분)(?!\s*까지)/g;
export function parseQuick(text,base=today()){
 const source=text.trim(),normalized=normalizeLanguage(source),durations=[];
 const withoutDuration=normalized.replace(durationPattern,(raw,h,tail,m,offset)=>{if(m&&/\d{1,2}시\s*$/.test(normalized.slice(0,offset)))return raw;durations.push(h?Number(h)*60+(tail==='반'?30:parseInt(tail||'0')):Number(m));return ' ';});
 const a=analyze(withoutDuration,base),fields={...a.fields};
 const category=inferCategory(source.split('\n')[0],fields.subject);
 let title=withoutDuration.split('\n')[0].replace(/(?:20\d{2}[-./년\s]+)?\d{1,2}(?:월|[/.])\s*\d{1,2}일?(?:까지)?/g,' ').replace(/(?:(?:이번|다음)\s*주\s*)?[월화수목금토일]요일(?:까지)?|오늘(?:까지)?|내일(?:까지)?|모레(?:까지)?/g,' ').replace(/(?:오전|오후)?\s*\d{1,2}(?::\d{2}|시(?!간)(?:\s*\d{1,2}분)?)(?:까지)?/g,' ').replace(/^\s*[-•·*]\s*|^\s*\d+[.)]\s*/,'').replace(/\s+/g,' ').trim();
 title=title.replace(/글피(?:까지)?|\d{1,3}\s*일\s*(?:뒤|후)(?:까지)?/g,' ').replace(/\s+/g,' ').trim();
 title=(title||source).slice(0,200);
 if(category==='bring'&&!fields.materials){const item=title.replace(/(?:을|를)?\s*(?:챙기기|챙겨오기|챙겨가기|챙겨오세요|챙겨|가져오기|가져가기|가져오세요|가져와야|챙겨야).*$/,'').trim();if(item)fields.materials=item;}
 const unique=[...new Set(durations)],minutes=unique.length===1?unique[0]:['study','assignment'].includes(category)?30:10;
 const warnings=[...a.issues];
 if(unique.length>1)warnings.push('작업 시간이 여러 개여서 기본 시간을 넣었어요. 수정해 주세요.');
 if(!Number.isInteger(minutes)||minutes<1||minutes>10080)warnings.push('작업 시간은 1~10080분 사이 정수여야 해요.');
 if(!fields.due)warnings.push('마감 미정 · 자동 일정에는 아직 배치하지 않아요.');
 return {title,source,sourceDate:base,fields,category,totalMinutes:minutes,minutesEstimated:unique.length!==1,warnings,problemCount:Math.min(200,Number(fields.amount?.match(/^(\d+)(?:문제|문항)$/)?.[1]||0))};
}
export function parseBatch(text,base=today()){
 if(text.length>12000)throw new Error('한 번에 12,000자까지 붙여 넣을 수 있어요.');
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),entries=[];let dateHeader='';
 for(const raw of lines){
  if(/^\[[^\]]+\]\s*\[(?:오전|오후)?\s*\d/.test(raw)||/^[-=]{3,}/.test(raw))continue;
  const line=raw.replace(/^[-•·*☐□✅✔]\s*|^\d+[.)]\s*/,'').trim();
  if(!line)continue;
  if(/^(?:준비물|장소|비용|참가비|제출 방식|제출 방법|대상)\s*[:：]/.test(line)&&entries.length){entries[entries.length-1]+='\n'+line;continue;}
  const heading=line.replace(/[\[\]:：]/g,'').trim();
  if(/^(?:(?:오늘|내일|모레|(?:(?:이번|다음)\s*주\s*)?[월화수목금토일]요일)(?:까지)?|(?:20\d{2}[-./])?\d{1,2}[-./월]\s*\d{1,2}일?)(?:\s*(?:할\s*일|과제|공지|숙제|준비물)(?:\s*(?:정리|목록))?)?$/.test(heading)){dateHeader=heading;continue;}
  if(/^(?:오늘의\s*)?(?:할\s*일|과제|공지|숙제)(?:\s*(?:정리|목록))?\s*[:：]?$/.test(line))continue;
  const own=analyze(line.replace(durationPattern,' '),base).fields.due;
  entries.push((!own&&dateHeader?dateHeader.replace(/\s*(?:할\s*일|과제|공지|숙제|준비물).*$/,'')+' ':'')+line);
 }
 if(entries.length>100)throw new Error('한 번에 100개까지 등록할 수 있어요. 나누어 붙여 넣어 주세요.');
 return entries.map(line=>parseQuick(line,base));
}
export function createQuickTask(parsed,id){
 if(!parsed.title.trim()||parsed.title.length>200||!Number.isInteger(parsed.totalMinutes)||parsed.totalMinutes<1||parsed.totalMinutes>10080||!Object.hasOwn(CATEGORIES,parsed.category)||parsed.fields.due&&!validDate(parsed.fields.due))throw new Error('제목·날짜·작업 시간을 확인해 주세요.');
 return {id,title:parsed.title.trim(),source:parsed.source,sourceDate:parsed.sourceDate,fields:parsed.fields,minutes:parsed.totalMinutes,totalMinutes:parsed.totalMinutes,completedMinutes:0,priority:2,difficulty:3,category:parsed.category,kindVersion:1,note:'',minutesEstimated:parsed.minutesEstimated,done:false,history:[],problems:resizeProblems([],parsed.problemCount),studyLog:[]};
}
export function duplicateKey(t){return [t.title.replace(/\s/g,'').toLowerCase(),t.fields.due||'',t.category||'study'].join('|');}
