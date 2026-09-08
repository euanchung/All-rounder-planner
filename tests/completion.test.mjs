import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleCompletion,remainingMinutes,validStudyFields,recordStudy} from '../src/workload.js';
import {plan,analyze} from '../src/engine.js';
const date='2026-09-08',at=date+'T00:00:00Z';
const task=()=>({id:'task',title:'물리 보고서',source:'물리 보고서',sourceDate:date,fields:{...analyze('물리 보고서',date).fields,due:'2026-09-11'},done:false,totalMinutes:100,completedMinutes:40,minutes:60,studyLog:[{id:'real',minutes:40,at}],history:[],priority:2});
const toggle=t=>toggleCompletion(t,'completion',at);
test('completion undo restores partial progress, manual plan and actual logs after reload',()=>{
 const t={...task(),planSlots:[{date,minutes:30},{date:'2026-09-09',minutes:30}]};
 const done=toggle(t);assert.equal(done.done,true);assert.equal(remainingMinutes(done),0);assert.deepEqual(done.planSlots,[]);
 const back=toggle(JSON.parse(JSON.stringify(done)));assert.equal(back.done,false);assert.equal(back.completedMinutes,40);assert.equal(remainingMinutes(back),60);assert.deepEqual(back.planSlots,t.planSlots);assert.deepEqual(back.studyLog,t.studyLog);assert.equal(validStudyFields(back),true);assert.equal(validStudyFields(done),true);
 assert.equal(plan([done],120,date).days[0].used,0);assert.equal(plan([back],120,date).days[0].used,30);
 assert.deepEqual(t.planSlots,[{date,minutes:30},{date:'2026-09-09',minutes:30}]);
});
test('repeated completion cycles do not accumulate fictitious progress',()=>{let t=task();for(let i=0;i<5;i++)t=toggle(toggle(t));assert.equal(t.completedMinutes,40);assert.equal(t.studyLog.length,1);assert.equal(plan([t],120,date).days[0].used,60);});
test('old completed records recover last completion increment',()=>{const done={...recordStudy(task(),60,'legacy',at),done:true};const back=toggle(done);assert.equal(back.minutes,60);assert.equal(back.completedMinutes,40);assert.equal(back.studyLog.length,1);});
test('old completed tasks without progress history reopen and zero-duration stays zero',()=>{assert.equal(toggle({...task(),completedMinutes:100,minutes:0,studyLog:[] ,done:true}).minutes,100);assert.equal(toggle({...task(),done:true}).minutes,60);assert.equal(toggle({done:true,minutes:0}).minutes,0);});
test('edited totals do not restore obsolete pinned allocation',()=>{const done=toggle({...task(),planSlots:[{date,minutes:60}]});const back=toggle({...done,totalMinutes:120,completedMinutes:120});assert.equal(back.minutes,60);assert.deepEqual(back.planSlots,[]);});
test('completion rejects log overflow without changing original and validates undo metadata',()=>{const t={...task(),studyLog:Array(200).fill({id:'x',minutes:1,at})};assert.throws(()=>toggle(t));assert.equal(t.done,false);assert.equal(validStudyFields({...task(),completionUndo:{logId:'x',totalMinutes:100,completedMinutes:-1}}),false);assert.equal(validStudyFields({...task(),completionUndo:{logId:'x',totalMinutes:100,completedMinutes:0,planSlots:[{date:'bad',minutes:10}]}}),false);});
