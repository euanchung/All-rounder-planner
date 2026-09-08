import test from 'node:test';
import assert from 'node:assert/strict';
import {removeTask,commitEntries} from '../src/campus-entry.js';
import {parseEntry} from '../src/campus-model.js';
import {plan,validateBackup} from '../src/engine.js';
import {autoGroupScopes,canAccessRoom} from '../server/auto-groups.js';
const member={school:'테스트 학교',grade:'1',class_name:'2'},person={discoverable:true};
test('automatic groups require verified class membership and profile visibility',()=>{
 assert.deepEqual(autoGroupScopes(person,null),[]);
 assert.deepEqual(autoGroupScopes({discoverable:false},member),[]);
 assert.deepEqual(autoGroupScopes(null,member),[]);
 const groups=autoGroupScopes(person,member);
 assert.deepEqual(groups.map(g=>g.kind),['class','school']);
 assert.equal(new Set(groups.map(g=>g.key)).size,2);
 assert.equal(groups[0].name,'테스트 학교 1학년 2반');
});
test('school groups span classes, class groups isolate grade and class',()=>{
 const a=autoGroupScopes(person,member),b=autoGroupScopes(person,{...member,class_name:'3'}),c=autoGroupScopes(person,{...member,grade:'2'}),d=autoGroupScopes(person,{...member,school:'다른 학교'});
 assert.equal(a[1].key,b[1].key);assert.equal(a[1].key,c[1].key);
 assert.notEqual(a[0].key,b[0].key);assert.notEqual(a[0].key,c[0].key);
 assert.notEqual(a[1].key,d[1].key);
 assert.equal(autoGroupScopes({...person,school:'조작한 학교'},member)[0].key,a[0].key);
});
test('room access never trusts stale member arrays for automatic rooms',()=>{
 const scopes=autoGroupScopes(person,member),r={auto_key:scopes[0].key,members:['stale']};
 assert.equal(canAccessRoom(r,'me',scopes),true);
 assert.equal(canAccessRoom(r,'stale',[]),false);
 assert.equal(canAccessRoom(r,'me',autoGroupScopes(person,{...member,grade:'3'})),false);
 assert.equal(canAccessRoom({auto_key:null,members:['me']},'me',[]),true);
 assert.equal(canAccessRoom({auto_key:null,members:['me']},'other',scopes),false);
});
test('delete removes only chosen task and its plan, without mutating original',()=>{
 const a=commitEntries([],[parseEntry('내일 물리 보고서 60분','2026-09-08')],null,()=> 'a')[0];
 a.note='메모';a.planSlots=[{date:'2026-09-08',minutes:30}];
 const b={...structuredClone(a),id:'b',title:'다른 할일',done:true};
 const original=[a,b],snapshot=structuredClone(original),next=removeTask(original,'a');
 assert.deepEqual(original,snapshot);assert.deepEqual(next,[b]);
 assert.ok(validateBackup({version:1,tasks:next,capacity:90,acceptedPlan:null}));
 assert.ok(plan(next,90,'2026-09-08').days.every(d=>d.items.every(i=>i.id!=='a')));
 assert.deepEqual(removeTask(next,'b'),[]);
 assert.throws(()=>removeTask(next,'missing'));assert.throws(()=>removeTask(next,null));
});
