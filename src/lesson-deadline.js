import {tableFor,sunday,PERIODS} from './campus-model.js';
import {addDays} from './engine.js';
import {deadlineStamp} from './live-time.js';
const subjectName=s=>String(s||'').replace(/\([^)]*\)/g,'').trim();
export function lessonDeadline(entry,profile,classTables={},base,now=Date.now()){
 const d={...entry,fields:{...entry.fields}},subject=subjectName(d.fields.subject);
 if(d.fields.time&&!d.deadlineAuto)return d;
 if(d.deadlineAuto){d.fields.time=null;d.deadlinePeriod=null;}
 if(!subject)return d;
 const candidates=d.fields.due?[d.fields.due]:Array.from({length:14},(_,i)=>addDays(base,i));
 for(const date of candidates){
  const day=new Date(date+'T12:00:00').getDay();if(day<1||day>5)continue;
  const shared=classTables[sunday(date)],table=tableFor(profile,shared,sunday(date)),times=shared?.periodTimes||profile.periodTimes||PERIODS;
  const index=table[day-1].findIndex((name,i)=>subjectName(name)===subject&&(d.fields.due||deadlineStamp({fields:{due:date,time:times[i]}})>now));
  if(index<0)continue;
  d.fields.due=date;d.fields.time=times[index];d.deadlinePeriod=index+1;d.deadlineAuto=true;
  d.warnings=(d.warnings||[]).filter(w=>!w.startsWith('마감 미정')&&!w.startsWith('수업 시각'));
  d.lessonNote=date+' '+(index+1)+'교시 시작('+times[index]+')까지 · 같은 과목이 여러 교시면 첫 수업 기준';
  return d;
 }
 d.lessonNote=d.fields.due?'해당 날짜에 이 과목 수업이 없어요. 날짜·마감 시각을 직접 확인하세요.':'앞으로 2주 시간표에 이 과목이 없어요. 마감을 직접 선택하세요.';
 return d;
}
export const activeBefore=(tasks,cutoff,now=Date.now())=>tasks.filter(t=>!t.done&&deadlineStamp(t)!==null&&deadlineStamp(t)>now&&deadlineStamp(t)<=cutoff);

