const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
export const toMinute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
const hh=n=>String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function defaultSchedule(starts=['09:00','10:00','11:00','12:00','13:30','14:30','15:30','16:30','17:30']){
 return starts.map((start,i)=>({label:(i+1)+'교시',start,end:hh(toMinute(start)+50),period:i+1,days:[1,2,3,4,5],examOnly:false}));
}
export const schoolStarts=['08:20','09:20','10:20','11:20','13:10','14:10','15:20','16:20','17:20'];
export function sciencePreset(){
 const table=[
  ['물리','물리','정보','국어','적통','적통','자율','자습','기숙사 가능'],
  ['화학','화학','국어','지구','정보','기백','진로','자습','기숙사 가능'],
  ['회화','생물','기백','기백','지구','화학','한국사','자습','기숙사 가능'],
  ['적통','생물','생물','영어','R&E','R&E','R&E','자습','기숙사 가능'],
  ['한국사','정보','체육','물리','지구','회화','국어','자습','기숙사 가능']
 ];
 const extra=(label,start,end,days=[1,2,3,4,5],examOnly=false)=>({label,start,end,period:null,days,examOnly});
 const schedule=[extra('조회','08:05','08:15'),...defaultSchedule(schoolStarts),extra('점심','12:10','13:10'),extra('청소','15:00','15:20'),extra('저녁','18:10','19:10'),extra('1자습 전반','19:10','20:00'),extra('1자습 후반','20:10','21:00'),extra('간식','21:00','21:30',[2,3,4]),extra('2자습','21:30','22:20'),extra('3자습','22:30','23:30'),extra('4자습 (시험 기간)','23:40','00:50',[1,2,3,4,5],true)].sort((a,b)=>a.start.localeCompare(b.start));
 return {table,periodTimes:[...schoolStarts],daySchedule:schedule,examMode:false};
}
export function validDaySchedule(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>30)return false;
 if(!rows.every(r=>r&&typeof r.label==='string'&&r.label.trim()&&r.label.length<=60&&clock.test(r.start)&&clock.test(r.end)&&r.start!==r.end&&(r.period===null||Number.isInteger(r.period)&&r.period>=1&&r.period<=9)&&Array.isArray(r.days)&&r.days.length>0&&r.days.length<=7&&new Set(r.days).size===r.days.length&&r.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&typeof r.examOnly==='boolean'))return false;
 const periods=rows.filter(r=>r.period).map(r=>r.period);if(new Set(periods).size!==periods.length)return false;
 // Check actual weekday minute ranges including previous-day overnight segments.
 for(let d=0;d<7;d++){
  const intervals=[];
  for(const r of rows){let a=toMinute(r.start),b=toMinute(r.end);if(b<=a)b+=1440;
   if(r.days.includes(d))intervals.push([a,b]);
   if(b>1440&&r.days.includes((d+6)%7))intervals.push([0,b-1440]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);if(intervals.some((r,i)=>i&&r[0]<intervals[i-1][1]))return false;
 }
 return true;
}
export function scheduleFor(profile,classTable){
 return {rows:classTable?.daySchedule||profile.daySchedule||defaultSchedule(classTable?.periodTimes||profile.periodTimes),examMode:classTable?.examMode??profile.examMode??false};
}
export function currentLesson(rows,table,now=new Date(),examMode=false){
 const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=Object.fromEntries(stamp.map(p=>[p.type,p.value])),day=new Date(part.year+'-'+part.month+'-'+part.day+'T00:00:00Z').getUTCDay(),minute=Number(part.hour)*60+Number(part.minute);
 for(const row of rows){
  if(row.examOnly&&!examMode)continue;
  const start=toMinute(row.start),end=toMinute(row.end),overnight=end<start;
  const usePrevious=overnight&&minute<end,weekday=usePrevious?(day+6)%7:day;
  if(!row.days.includes(weekday))continue;
  if(!(overnight?(minute>=start||minute<end):(minute>=start&&minute<end)))continue;
  const subject=row.period&&weekday>=1&&weekday<=5?table[weekday-1]?.[row.period-1]:'';
  return {...row,subject:subject||row.label,weekday};
 }
 return null;
}
export function scheduleFromFields(values){
 const rows=[];
 for(let i=0;i<30;i++){
  const label=(values['schedule-label-'+i]||'').trim();if(!label)continue;
  rows.push({label,start:values['schedule-start-'+i],end:values['schedule-end-'+i],period:values['schedule-period-'+i]?Number(values['schedule-period-'+i]):null,days:(values['schedule-days-'+i]||'').split(',').map(Number),examOnly:!!values['schedule-exam-'+i]});
 }
 if(!validDaySchedule(rows))throw new Error('일과의 시간·요일·중복 여부를 확인하세요. 자정을 넘는 일정도 서로 겹치면 안 돼요.');
 return rows.sort((a,b)=>a.start.localeCompare(b.start));
}
