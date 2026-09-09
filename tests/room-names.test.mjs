import test from 'node:test';
import assert from 'node:assert/strict';
import {nameRooms} from '../server/room-names.js';
const rooms=[{id:'dm',kind:'direct',name:'개인 대화',members:['a','b']},{id:'g',kind:'group',name:'수학 연구 모임',members:['a','b']}];
test('each participant sees the other name; groups keep their title',async()=>{
 const sql=async()=>[{user_id:'a',name:'가영'},{user_id:'b',name:'민수'}];
 assert.deepEqual((await nameRooms(sql,rooms,'a')).map(r=>r.name),['민수','수학 연구 모임']);
 assert.equal((await nameRooms(sql,rooms,'b'))[0].name,'가영');
 assert.equal(rooms[0].name,'개인 대화');
});
test('only peer IDs of participating direct rooms are queried',async()=>{
 let ids;await nameRooms(async(strings,value)=>{ids=value;return [];},[...rooms,{kind:'direct',members:['c','d']}],'a');
 assert.deepEqual(ids,['b']);
});
test('deleted or departed peer has a clear fallback',async()=>{
 assert.equal((await nameRooms(async()=>[],rooms,'a'))[0].name,'탈퇴한 사용자');
 assert.equal((await nameRooms(async()=>[],[{kind:'direct',members:['a']}],'a'))[0].name,'상대방이 없는 대화');
});
test('group-only directory requires no profile query',async()=>{
 assert.equal((await nameRooms(()=>{throw Error('unnecessary query');},[rooms[1]],'a'))[0].name,'수학 연구 모임');
});
