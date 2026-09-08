import {addDays} from './engine.js';
export function mondayOf(date){return addDays(date,-((new Date(date+'T12:00:00').getDay()+6)%7));}
export function weekCells(days,today,wholeRange=false){
 const first=mondayOf(today),count=wholeRange?Math.ceil(((Date.parse(days.at(-1).date+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))/86400000+1)/7)*7:7;
 return Array.from({length:count},(_,i)=>{const date=addDays(first,i),day=days.find(d=>d.date===date);return day?{...day,disabled:date<today}:{date,capacity:0,used:0,items:[],disabled:true,outside:date>=today};});
}
