import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,validProfile,upgrade} from '../src/profile.js';
import {plan,validateBackup} from '../src/engine.js';
test('legacy backups migrate without losing capacity',()=>{const next=upgrade({version:1,tasks:[],capacity:120});assert.deepEqual(next.profile.weeklyMinutes,Array(7).fill(120));assert.equal(next.profile.onboarded,false);assert.ok(validateBackup(next));});
test('weekdays use individual capacity and allow zero rest days',()=>{const p=plan([], [0,30,60,90,120,150,180],'2026-09-07');assert.deepEqual(p.days.slice(0,7).map(d=>d.capacity),[30,60,90,120,150,180,0]);assert.equal(p.days[7].capacity,30);});
test('weekly overload never assigns work to zero-capacity days',()=>{const p=plan([{id:'a',title:'task',minutes:120,priority:2,done:false,fields:{due:'2026-09-08'}}],[0,0,60,0,0,0,0],'2026-09-07');assert.equal(p.totalShortage,60);assert.equal(p.days[0].used,0);assert.equal(p.days[1].used,60);});
test('profile validates seven days and timetable bounds',()=>{const p=defaultProfile();assert.ok(validProfile(p));p.weeklyMinutes[0]=-1;assert.equal(validProfile(p),false);p.weeklyMinutes[0]=721;assert.equal(validProfile(p),false);p.weeklyMinutes[0]=0;assert.ok(validProfile(p));p.timetable[0][0]='x'.repeat(101);assert.equal(validProfile(p),false);});
