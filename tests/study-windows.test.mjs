import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStudyWeek,validStudyWindows,studyDayMinutes,studyRemainingMinutes,studyWeeklyMinutes,studyCapacity} from '../src/study-windows.js';
import {dailyCapacity,availableMinutes,recordStudy} from '../src/workload.js';
import {defaultProfile,validProfile} from '../src/profile.js';
import {plan,validateBackup} from '../src/engine.js';
import {readStudyWeek,studyDraft} from '../src/study-windows-ui.js';
const date='2026-09-07',at=t=>Date.parse(date+'T'+t+':00+09:00');
const week=()=>{const w=emptyStudyWeek();w[1]=[{start:'19:00',end:'20:00'},{start:'21:00',end:'22:00'}];return w;};
for(const [time,expected] of [['18:00',120],['19:00',120],['19:30',90],['20:00',60],['20:30',60],['21:15',45],['22:00',0],['23:59',0]]){
 test('real windows remaining at '+time,()=>assert.equal(studyRemainingMinutes(week(),date,at(time)),expected));
}
test('future day full, past day zero and empty rest day zero',()=>{
 assert.equal(studyRemainingMinutes(week(),'2026-09-14',at('23:00')),120);
 assert.equal(studyRemainingMinutes(week(),'2026-08-31',at('23:00')),0);
 assert.equal(studyRemainingMinutes(week(),'2026-09-08',at('23:00')),0);
});
test('overnight splits at midnight into actual calendar days',()=>{
 const w=emptyStudyWeek();w[1]=[{start:'23:40',end:'00:50'}];
 assert.equal(studyDayMinutes(w,date),20);assert.equal(studyDayMinutes(w,'2026-09-08'),50);
 assert.equal(studyRemainingMinutes(w,'2026-09-08',Date.parse('2026-09-08T00:20:00+09:00')),30);
 assert.deepEqual(studyWeeklyMinutes(w),[0,20,50,0,0,0,0]);
});
test('Saturday night carries into Sunday',()=>{
 const w=emptyStudyWeek();w[6]=[{start:'23:00',end:'01:00'}];
 assert.equal(studyDayMinutes(w,'2026-09-13'),60);
});
test('reject overlaps, overnight overlaps, invalid clocks and excessive duration',()=>{
 for(const rows of [[{start:'19:00',end:'19:00'}],[{start:'25:00',end:'26:00'}],[{start:'01:00',end:'20:00'}],[{start:'19:00',end:'20:30'},{start:'20:00',end:'21:00'}]]){
  const w=emptyStudyWeek();w[1]=rows;assert.equal(validStudyWindows(w),false);
 }
 const w=emptyStudyWeek();w[1]=[{start:'23:00',end:'01:00'}];w[2]=[{start:'00:30',end:'01:30'}];assert.equal(validStudyWindows(w),false);
});
test('adjacent intervals allowed and unsorted rows calculated correctly',()=>{
 const w=emptyStudyWeek();w[1]=[{start:'20:00',end:'21:00'},{start:'19:00',end:'20:00'}];assert.ok(validStudyWindows(w));assert.equal(studyDayMinutes(w,date),120);
});
test('date override changes only that date and overnight continuation',()=>{
 const w=week(),o={[date]:[{start:'23:00',end:'01:00'}]};
 assert.ok(validStudyWindows(w,o));assert.equal(studyDayMinutes(w,date,o),60);assert.equal(studyDayMinutes(w,'2026-09-08',o),60);assert.equal(studyDayMinutes(w,'2026-09-14',o),120);
 assert.equal(studyDayMinutes(w,date,{[date]:[]}),0);
});
test('profile rejects inconsistent totals and persists windows in backup',()=>{
 const p={...defaultProfile(),studyWindows:week(),weeklyMinutes:studyWeeklyMinutes(week())};
 assert.ok(validProfile(p));assert.ok(validateBackup({version:2,capacity:90,tasks:[],profile:p,acceptedPlan:null}));
 p.weeklyMinutes[1]=90;assert.equal(validProfile(p),false);
});
test('logs do not double-subtract elapsed time; real windows feed planner',()=>{
 const c={...studyCapacity({studyWindows:week()},at('19:30')),today:date,spent:30};
 assert.equal(dailyCapacity(c,date),90);assert.equal(availableMinutes(c,date,8),210);
 const p=plan([{id:'a',title:'과제',minutes:120,priority:2,done:false,fields:{due:'2026-09-09'}}],c,date);
 assert.equal(p.days[0].capacity,90);assert.equal(p.days[0].used,90);assert.equal(p.totalShortage,30);
});
test('legacy totals are preserved but are not invented clock windows',()=>{
 const p=defaultProfile(120);assert.equal(p.weeklyMinutes[1],120);assert.equal(dailyCapacity(studyCapacity(p,at('19:00')),date),0);
});
test('draft supports zero rows, multiple rows and incomplete input rejection',()=>{
 const v={'study-count-1':'2','study-start-1-0':'19:00','study-end-1-0':'20:00','study-start-1-1':'21:00','study-end-1-1':'22:00'};
 assert.deepEqual(readStudyWeek(v),week());assert.deepEqual(studyDraft({},1),[]);
 delete v['study-end-1-1'];assert.throws(()=>readStudyWeek(v));
});
