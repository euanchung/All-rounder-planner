import {validDaySchedule} from '../src/day-schedule.js';
import {validTable} from '../src/campus-model.js';
export const scheduleSchema={type:'object',additionalProperties:false,required:['table','daySchedule','uncertainties'],properties:{table:{type:'array',minItems:5,maxItems:5,items:{type:'array',minItems:9,maxItems:9,items:{type:'string',maxLength:100}}},daySchedule:{type:'array',minItems:1,maxItems:30,items:{type:'object',additionalProperties:false,required:['label','start','end','period','days','examOnly'],properties:{label:{type:'string',maxLength:60},start:{type:'string'},end:{type:'string'},period:{type:['integer','null']},days:{type:'array',items:{type:'integer'}},examOnly:{type:'boolean'}}}},uncertainties:{type:'array',maxItems:15,items:{type:'string',maxLength:300}}}};
export const validSchedule=v=>!!v&&validTable(v.table)&&validDaySchedule(v.daySchedule)&&Array.isArray(v.uncertainties)&&v.uncertainties.length<=15&&v.uncertainties.every(x=>typeof x==='string'&&x.length<=300);
export function normalizeSchedule(value){
 if(!value||!validTable(value.table)||!Array.isArray(value.daySchedule)||value.daySchedule.length>30||!Array.isArray(value.uncertainties))return null;
 const table=value.table.map(row=>row.map(x=>x.trim())),rows=[],warnings=value.uncertainties.filter(x=>typeof x==='string').map(x=>x.slice(0,300)).slice(0,10);
 for(const row of value.daySchedule){
  if(!validDaySchedule([...rows,row])){warnings.push('겹치거나 형식이 맞지 않는 일과 행을 제외했어요. 사진과 일과 시간을 확인해 주세요.');continue;}
  rows.push(row);
  // Carry an explicit merged-cell activity into empty timetable cells, not guesses.
  if(row.period){
   const activity=row.label.replace(new RegExp('^'+row.period+'교시\\s*'),'').trim();
   if(activity&&activity!==row.label)for(const day of row.days)if(day>=1&&day<=5&&!table[day-1][row.period-1])table[day-1][row.period-1]=activity;
  }
 }
 warnings.push('요일 범위(예: 화~목)와 시험 기간 표시, 빈 교시는 사진과 비교해 확인해 주세요.');
 const result={table,daySchedule:rows,uncertainties:[...new Set(warnings)].slice(0,15)};
 return validSchedule(result)?result:null;
}
