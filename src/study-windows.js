// Calendar-day availability in Korea time. Time passage never completes a task.
const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
const minute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const shift=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const emptyStudyWeek=()=>Array.from({length:7},()=>[]);
export function validStudyRows(rows){return Array.isArray(rows)&&rows.length<=12&&rows.every(r=>r&&clock.test(r.start)&&clock.test(r.end)&&r.start!==r.end&&((minute(r.end)-minute(r.start)+1440)%1440)<=720);}
export function studyIntervals(week,date,overrides={}){
 const rowsFor=d=>Object.hasOwn(overrides,d)?overrides[d]:(week?.[new Date(d+'T12:00:00Z').getUTCDay()]||[]);
 const intervals=[];
 for(const offset of [-1,0])for(const row of rowsFor(shift(date,offset))){
  let start=minute(row.start)+offset*1440,end=minute(row.end)+offset*1440;
  if(end<=start)end+=1440;
  start=Math.max(0,start);end=Math.min(1440,end);
  if(end>start)intervals.push([start,end]);
 }
 return intervals.sort((a,b)=>a[0]-b[0]);
}
export function studyDayMinutes(week,date,overrides={}){return studyIntervals(week,date,overrides).reduce((n,[a,b])=>n+b-a,0);}
export function studyRemainingMinutes(week,date,now=Date.now(),overrides={}){
 const dayStart=Date.parse(date+'T00:00:00+09:00'),elapsed=(now-dayStart)/60000;
 return Math.max(0,Math.floor(studyIntervals(week,date,overrides).reduce((n,[a,b])=>n+Math.max(0,b-Math.max(a,elapsed)),0)));
}
export function studyWeeklyMinutes(week){return Array.from({length:7},(_,d)=>studyDayMinutes(week,shift('2026-09-06',d)));}
export function validStudyWindows(week,overrides={}){
 if(!Array.isArray(week)||week.length!==7||!week.every(validStudyRows)||!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>366||!Object.entries(overrides).every(([d,r])=>dateOK(d)&&validStudyRows(r)))return false;
 const dates=new Set(Array.from({length:7},(_,d)=>shift('2026-09-06',d)));
 // Date exceptions must not hide an invalid recurring week.
 for(const d of dates){const rows=studyIntervals(week,d);if(rows.reduce((n,[a,b])=>n+b-a,0)>720||rows.some((r,i)=>i&&r[0]<rows[i-1][1]))return false;}
 for(const d of Object.keys(overrides)){dates.add(d);dates.add(shift(d,1));}
 for(const d of dates){
  const rows=studyIntervals(week,d,overrides);
  if(rows.reduce((n,[a,b])=>n+b-a,0)>720||rows.some((r,i)=>i&&r[0]<rows[i-1][1]))return false;
 }
 return true;
}
export function studyProfileValid(p){
 if(p.studyWindows===undefined)return p.dateStudyWindows===undefined;
 return validStudyWindows(p.studyWindows,p.dateStudyWindows||{})&&studyWeeklyMinutes(p.studyWindows).every((n,i)=>n===p.weeklyMinutes?.[i]);
}
export function studyCapacity(profile,now=Date.now()){
 return {windows:profile.studyWindows||emptyStudyWeek(),windowOverrides:profile.dateStudyWindows||{},now,weekly:profile.weeklyMinutes};
}
