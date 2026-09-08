import {addDays,iso,validDate,plan} from './engine.js';
import {validDaySchedule} from './day-schedule.js';
import {parseQuick} from './quick-entry.js';
export const TYPES={assignment:'일반 과제',assessment:'수행평가',study:'공부',report:'보고서',presentation:'발표 준비',contest:'대회 준비',bring:'준비물',buy:'구매',other:'기타'};
export const PERIODS=['09:00','10:00','11:00','12:00','13:30','14:30','15:30','16:30','17:30'];
export const emptyTable=()=>Array.from({length:5},()=>Array(9).fill(''));
export const sunday=date=>addDays(date,-new Date(date+'T12:00:00').getDay());
export function monthDays(month){const d=new Date(month.slice(0,7)+'-01T12:00:00'),start=sunday(iso(d));return Array.from({length:42},(_,i)=>addDays(start,i));}
export function moveMonth(month,n){const d=new Date(month.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()+n);return iso(d);}
export function normalizedRange(a,b){return [a,b].sort();}
export function typeOf(t){return t.taskType||(/보고서/.test(t.title)?'report':/수행평가/.test(t.title)?'assessment':/대회/.test(t.title)?'contest':/발표/.test(t.title)?'presentation':t.category||'assignment');}
export function parseEntry(text,base){const p=parseQuick(text,base);return {...p,taskType:typeOf(p),priority:/덜\s*중요|낮은\s*중요/.test(text)?1:/매우\s*중요|중요|급해|급함/.test(text)?3:2,difficulty:/매우\s*어려|고난도/.test(text)?5:/어려/.test(text)?4:/쉬운|쉬워/.test(text)?2:3,startDate:null,deadlinePeriod:null};}
export function tableFor(profile,classTable,week){const key=Object.keys(profile.timetableWeeks||{}).filter(k=>k<=week).sort().at(-1);return classTable?.table||profile.timetableWeeks?.[key]||profile.timetable.map(d=>Array.from({length:9},(_,i)=>d[i]||''));}
export function weekPlan(tasks,capacity,today,week){const end=addDays(week,6),horizon=Math.max(14,Math.ceil((Date.parse(end)-Date.parse(today))/86400000)+1);const p=plan(tasks,capacity,today,Math.min(740,horizon));return {...p,days:Array.from({length:7},(_,i)=>{const date=addDays(week,i);return p.days.find(d=>d.date===date)||{date,capacity:0,used:0,items:[],past:true};})};}
export function dueOn(tasks,date,period=null){return tasks.filter(t=>!t.done&&t.fields.due===date&&(!period||!t.deadlinePeriod||t.deadlinePeriod<=period));}
export const validTable=t=>Array.isArray(t)&&t.length===5&&t.every(d=>Array.isArray(d)&&d.length===9&&d.every(s=>typeof s==='string'&&s.length<=100));
export const validPeriodTimes=t=>Array.isArray(t)&&t.length===9&&t.every(s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s))&&t.every((s,i)=>!i||s>t[i-1]);
export function validCampusProfile(p){return (p.daySchedule===undefined||validDaySchedule(p.daySchedule))&&(p.examMode===undefined||typeof p.examMode==='boolean')&&(p.campusOnboarded===undefined||typeof p.campusOnboarded==='boolean')&&(!p.campusOnboarded||['name','school','grade','className'].every(k=>typeof p[k]==='string'&&p[k].trim().length>0))&&(p.periodTimes===undefined||validPeriodTimes(p.periodTimes))&&(p.timetableWeeks===undefined||p.timetableWeeks&&typeof p.timetableWeeks==='object'&&!Array.isArray(p.timetableWeeks)&&Object.keys(p.timetableWeeks).length<=104&&Object.entries(p.timetableWeeks).every(([k,v])=>validDate(k)&&validTable(v)));}
