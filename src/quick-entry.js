import {recognizeEntry} from './entry-recognition.js';
import {normalizeLanguage} from './notice-language.js';
import {inferCategory} from './task-kind.js';
import {analyze,today,validDate} from './engine.js';
import {resizeProblems} from './workload.js';
export const CATEGORIES={study:'공부',assignment:'과제',bring:'준비물',buy:'구매',other:'일상'};
export function parseQuick(text,base=today(),subjects=[]){
 const source=text.trim(),a=analyze(source,base),r=recognizeEntry(source,a,subjects),fields={...a.fields,subject:r.subject};
 const category=r.taskType?(['study','bring','buy','other'].includes(r.taskType)?r.taskType:'assignment'):inferCategory(source.split('\n')[0],fields.subject);
 if(category==='bring'&&!fields.materials)fields.materials=r.title;
 return {...r,title:r.title.slice(0,200),source,sourceDate:base,fields,category,totalMinutes:['study','assignment'].includes(category)?30:10,minutesEstimated:true,durationRequired:true,warnings:[...a.issues.filter(x=>!x.startsWith('과목 후보')),...r.warnings,...(!fields.due?['마감 미정 · 자동 일정에는 아직 배치하지 않아요.']:[])],problemCount:Math.min(200,Number(fields.amount?.match(/^(\d+)(?:문제|문항)$/)?.[1]||0))};
}
export function parseBatch(text,base=today(),subjects=[]){
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
  const own=analyze(line,base).fields.due;
  entries.push((!own&&dateHeader?dateHeader.replace(/\s*(?:할\s*일|과제|공지|숙제|준비물).*$/,'')+' ':'')+line);
 }
 if(entries.length>100)throw new Error('한 번에 100개까지 등록할 수 있어요. 나누어 붙여 넣어 주세요.');
 return entries.map(line=>parseQuick(line,base,subjects));
}
export function createQuickTask(parsed,id){
 if(!parsed.title.trim()||parsed.title.length>200||!Number.isInteger(parsed.totalMinutes)||parsed.totalMinutes<1||parsed.totalMinutes>10080||!Object.hasOwn(CATEGORIES,parsed.category)||parsed.fields.due&&!validDate(parsed.fields.due))throw new Error('제목·날짜·작업 시간을 확인해 주세요.');
 return {id,title:parsed.title.trim(),source:parsed.source,sourceDate:parsed.sourceDate,fields:parsed.fields,minutes:parsed.totalMinutes,totalMinutes:parsed.totalMinutes,completedMinutes:0,priority:parsed.priority??2,difficulty:parsed.difficulty??2,...(parsed.taskType?{taskType:parsed.taskType}:{}),category:parsed.category,kindVersion:1,note:'',minutesEstimated:parsed.minutesEstimated,done:false,history:[],problems:resizeProblems([],parsed.problemCount),studyLog:[]};
}
export function duplicateKey(t){return [t.title.replace(/\s/g,'').toLowerCase(),t.fields.due||'',t.category||'study',t.fields.subject||'',t.taskType||''].join('|');}
