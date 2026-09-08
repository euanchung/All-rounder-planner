import {createQuickTask} from './quick-entry.js';
import {validDate} from './engine.js';
export function commitEntries(original,entries,editId=null,idFactory=()=>crypto.randomUUID()){
 const tasks=structuredClone(original),touched=new Set();
 for(const d of entries){
  const target=editId||d.targetId,index=tasks.findIndex(t=>t.id===target);
  if(target&&index<0)throw new Error('원래 할일이 없어졌어요. 다시 분석해 주세요.');
  if(target&&touched.has(target))throw new Error('여러 공지가 같은 할일을 수정해요. 공지를 나누어 반영하세요.');
  if(target)touched.add(target);
  if(d.noticeRow?.old&&JSON.stringify(original.find(t=>t.id===target))!==JSON.stringify(d.noticeRow.old))throw new Error('분석 이후 원래 기록이 바뀌었어요. 다시 분석해 주세요.');
  const parsed={...d,category:['study','bring','buy','other'].includes(d.taskType)?d.taskType:'assignment'};
  const made=createQuickTask(parsed,idFactory());
  if(d.startDate&&(!validDate(d.startDate)||!d.fields.due||d.startDate>=d.fields.due))throw new Error('작업 시작일은 실제 마감일보다 앞서야 해요.');
  const extras={taskType:d.taskType,startDate:d.startDate||null,deadlinePeriod:d.deadlinePeriod||null,priority:d.priority,difficulty:d.difficulty,note:d.note||'',completedMinutes:d.completedMinutes||0};
  if(index>=0){const old=tasks[index];tasks[index]={...old,...made,...extras,id:old.id,done:old.done,planSlots:old.planSlots,studyLog:old.studyLog,problems:old.problems,minutes:d.totalMinutes-extras.completedMinutes,history:[...old.history,{source:old.source,sourceDate:old.sourceDate,fields:old.fields,minutes:old.minutes,at:new Date().toISOString()}].slice(-100)};}
  else if(!tasks.some(t=>t.title===made.title&&t.fields.due===made.fields.due&&t.category===made.category))tasks.push({...made,...extras,minutes:d.totalMinutes-extras.completedMinutes});
 }
 return tasks;
}
