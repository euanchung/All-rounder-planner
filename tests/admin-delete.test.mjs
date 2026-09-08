import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminHandler} from '../api/admin.js';
import {adminPage} from '../src/admin-ui.js';
const owner='10000000-0000-0000-0000-000000000001',target='20000000-0000-0000-0000-000000000002';
async function run({role='admin',userId=target,confirm='DELETE',isAdmin=false,exists=true}={}){
 const queries=[];let transactions=0;
 const sql=(strings,...values)=>{const q=strings.join('?');queries.push({q,values});return Promise.resolve(q.startsWith('SELECT id')?(exists?[{id:target}]:[]):q.startsWith('SELECT user_id')?(isAdmin?[{user_id:target}]:[]):[]);};sql.transaction=async ops=>{transactions++;await Promise.all(ops);};
 let status,body;await createAdminHandler({getIdentity:async()=>({id:owner,role}),getDb:()=>sql})({url:'/api/admin',method:'POST',body:{action:'delete-user',userId,confirm}},{setHeader(){},set statusCode(v){status=v;},end(v){body=JSON.parse(v);}});return {status,body,queries,transactions};
}
test('only admin may force delete; self/admin and missing confirmation protected',async()=>{for(const options of [{role:'member'},{userId:owner},{isAdmin:true},{confirm:''},{exists:false}]){const r=await run(options);assert.ok(r.status>=400);assert.equal(r.transactions,0);assert.ok(!r.queries.some(x=>x.q.startsWith('DELETE')));}});
test('forced deletion uses bound ID, removes private data, preserves shared evidence and audits',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.transactions,1);for(const name of ['radar_workspace','campus_push','campus_generations','campus_people','campus_accounts'])assert.ok(r.queries.some(x=>x.q.includes('DELETE FROM public.'+name)&&x.values.includes(target)));assert.ok(r.queries.some(x=>x.q.includes('DELETE FROM neon_auth."user"')&&x.q.includes('NOT EXISTS')));assert.ok(r.queries.some(x=>x.q.includes('campus_audit')));assert.ok(!r.queries.some(x=>/DELETE FROM public.campus_(messages|notices|audit)/.test(x.q)));});
test('member management shows delete only for nonadmins and escapes attributes',()=>{const html=adminPage({section:'users',total:2,memberTotal:1,page:0,users:[{id:owner,name:'Owner',role:'admin',email:'owner@example.invalid'},{id:target,name:'Member',role:'student',email:'member@example.invalid'}]});assert.equal((html.match(/data-action="admin-delete-user"/g)||[]).length,1);});
