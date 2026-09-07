// Explainable heuristics, not learned scores or grades. No external service.
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const dayStamp=value=>Date.parse(value+'T00:00:00Z');
export function remainingMinutes(task){return Math.max(0,(task.totalMinutes??task.minutes)-(task.completedMinutes??0));}
export function recordStudy(task,minutes,id,at){
  if(task.done||!Number.isInteger(minutes)||minutes<1||minutes>remainingMinutes(task))throw new Error('실제 공부 시간은 1분 이상, 남은 작업 시간 이하로 입력해 주세요.');
  if((task.studyLog?.length||0)>=200)throw new Error('과제당 공부 기록은 200회까지 보관할 수 있어요. 새 과제로 나누어 주세요.');
  const totalMinutes=task.totalMinutes??task.minutes,completedMinutes=(task.completedMinutes??0)+minutes;
  return {...task,totalMinutes,completedMinutes,minutes:totalMinutes-completedMinutes,studyLog:[...(task.studyLog||[]),{id,minutes,at}]};
}
export function undoStudy(task,id){
  const entry=task.studyLog?.find(l=>l.id===id);if(!entry)throw new Error('해당 기록을 찾지 못했습니다.');
  if(entry.minutes>(task.completedMinutes??0))throw new Error('완료한 시간이 수동 수정되어 이 기록을 취소할 수 없어요. 과제 수정에서 시간을 먼저 확인해 주세요.');
  const completedMinutes=task.completedMinutes-entry.minutes;
  return {...task,completedMinutes,minutes:task.totalMinutes-completedMinutes,studyLog:task.studyLog.filter(l=>l.id!==id)};
}
export function daysLeft(due,start){if(!due||!Number.isFinite(dayStamp(due)))return null;return Math.round((dayStamp(due)-dayStamp(start))/86400000);}
export function dailyCapacity(capacity,date){const week=capacity?.weekly||capacity;const base=Array.isArray(week)?week[new Date(date+'T00:00:00Z').getUTCDay()]:week;return Math.max(0,(Number(base)||0)-(capacity?.today===date?capacity.spent:0));}
export function availableMinutes(capacity,start,count){
  if(count<=0)return 0;
  const raw=capacity?.weekly||capacity,week=Array.isArray(raw)?raw:Array(7).fill(raw);
  const full=Math.floor(count/7),first=new Date(start+'T00:00:00Z').getUTCDay();
  let sum=full*week.reduce((a,n)=>a+Math.max(0,Number(n)||0),0);
  for(let i=0;i<count%7;i++)sum+=Math.max(0,Number(week[(first+i)%7])||0);
  if(capacity?.today&&daysLeft(capacity.today,start)>=0&&daysLeft(capacity.today,start)<count){const original=week[new Date(capacity.today+'T00:00:00Z').getUTCDay()];sum-=Math.min(original,capacity.spent);}
  return Math.max(0,sum);
}
export function taskMetrics(task,capacity,start){
  const remaining=remainingMinutes(task),left=daysLeft(task.fields?.due,start),days=left===null?null:Math.max(0,left+1);
  const available=days===null?null:availableMinutes(capacity,start,days);
  const parts={deadline:left===null?0:35/(1+Math.max(0,left)/3),workload:25*clamp(remaining/240,0,1),importance:20*clamp(((task.priority??2)-1)/2,0,1),difficulty:20*clamp(((task.difficulty??3)-1)/4,0,1)};
  const score=task.done||remaining===0?0:Math.round(Object.values(parts).reduce((a,b)=>a+b,0));
  const risk=task.done?'완료':remaining===0?'완료 확인':left===null?'마감 미정':left<0?'마감 지남':remaining>available?'시간 부족':remaining===available?'여유 없음':'배치 가능';
  return {remaining,left,days,available,requiredPerDay:days?Math.ceil(remaining/days):null,availablePerDay:days?Math.floor(available/days):null,score,parts,risk};
}
export function rankedTasks(tasks,capacity,start){return tasks.slice().sort((a,b)=>Number(a.done)-Number(b.done)||taskMetrics(b,capacity,start).score-taskMetrics(a,capacity,start).score||(a.fields.due||'9999').localeCompare(b.fields.due||'9999')||a.title.localeCompare(b.title));}
export function workloadSnapshot(tasks,capacity,start){
  const active=tasks.filter(t=>!t.done&&remainingMinutes(t)>0),dated=active.filter(t=>daysLeft(t.fields.due,start)!==null&&daysLeft(t.fields.due,start)>=0).sort((a,b)=>a.fields.due.localeCompare(b.fields.due));
  let used=0,maxShortage=0,criticalDue=null,firstBreach=null;
  for(const task of dated){used+=remainingMinutes(task);const gap=used-availableMinutes(capacity,start,daysLeft(task.fields.due,start)+1);if(gap>0)firstBreach||=task.fields.due;if(gap>maxShortage){maxShortage=gap;criticalDue=task.fields.due;}}
  return {maxShortage,criticalDue,firstBreach,extraPerDay:criticalDue?Math.ceil(maxShortage/(daysLeft(criticalDue,start)+1)):0,overdue:active.filter(t=>daysLeft(t.fields.due,start)!==null&&daysLeft(t.fields.due,start)<0),unknown:active.filter(t=>daysLeft(t.fields.due,start)===null),remaining:active.reduce((n,t)=>n+remainingMinutes(t),0)};
}
export function resizeProblems(problems=[],count){return Array.from({length:count},(_,i)=>problems[i]||{number:i+1,status:'todo',reason:'approach',note:'',tried:''});}
export const BLOCK_REASONS={concept:'개념이 헷갈려요',approach:'어디서 시작할지 모르겠어요',calculation:'계산이 자꾸 틀려요',check:'답을 검산하고 싶어요'};
export function nextSteps(reason){return ({concept:['문제에 나온 용어와 조건을 각각 적어 보세요.','교과서에서 관련 정의·정리를 한 개 찾아보세요.','쉬운 예제에 그 정의를 먼저 적용해 보세요.'],approach:['구해야 하는 것과 주어진 조건을 분리해 적으세요.','그림·표를 그리거나 작은 수를 넣어 규칙을 찾아보세요.','조건을 식 하나로 옮기는 것까지만 목표로 잡으세요.'],calculation:['마지막으로 맞다고 확신하는 줄을 표시하세요.','부호·분모·괄호와 계산 순서를 한 줄씩 확인하세요.','구한 값을 원래 식에 대입해 좌우가 같은지 확인하세요.'],check:['원래 문제의 정의역과 제외 조건을 다시 확인하세요.','구한 값을 원래 식이나 조건에 대입하세요.','간단한 특수값이나 다른 풀이로 결과를 비교하세요.']})[reason]||[];}
export function questionDraft(task,problem){return `${task.title} / ${problem.number}번 질문\n막힌 이유: ${BLOCK_REASONS[problem.reason]||'풀이 확인'}\n문제·조건: ${problem.note||'(문제와 조건을 적어 주세요)'}\n여기까지 시도했어요: ${problem.tried||'(해 본 식이나 접근을 적어 주세요)'}\n다음 한 단계에 어떤 개념을 적용하면 좋을까요? 정답보다 접근 방법을 알고 싶어요.`;}
export function validStudyFields(t){
  if(t.totalMinutes!==undefined||t.completedMinutes!==undefined){if(!Number.isFinite(t.totalMinutes)||t.totalMinutes<0||t.totalMinutes>10080||!Number.isFinite(t.completedMinutes)||t.completedMinutes<0||t.completedMinutes>t.totalMinutes||Math.abs(t.minutes-(t.totalMinutes-t.completedMinutes))>1e-8)return false;}
  if(t.difficulty!==undefined&&(!Number.isInteger(t.difficulty)||t.difficulty<1||t.difficulty>5))return false;
  if(t.problems!==undefined&&(!Array.isArray(t.problems)||t.problems.length>200||!t.problems.every((p,i)=>p&&p.number===i+1&&['todo','solved','stuck'].includes(p.status)&&Object.hasOwn(BLOCK_REASONS,p.reason)&&['note','tried'].every(k=>typeof p[k]==='string'&&p[k].length<=2000))))return false;
  if(t.studyLog!==undefined&&(!Array.isArray(t.studyLog)||t.studyLog.length>200||!t.studyLog.every(l=>l&&typeof l.id==='string'&&l.id.length<=100&&Number.isInteger(l.minutes)&&l.minutes>0&&l.minutes<=10080&&typeof l.at==='string'&&Number.isFinite(Date.parse(l.at)))))return false;
  return true;
}
