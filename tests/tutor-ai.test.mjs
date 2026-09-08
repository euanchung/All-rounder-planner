import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTutor} from '../server/tutor-ai.js';
import {tutorModels} from '../server/tutor-policy.js';
import {aiQuota,aiRemaining} from '../server/ai-quota.js';
const input={subject:'수학',mode:'problem',question:'2x+3=11'},answer={title:'풀이',concept:'',steps:['힌트','중간','x=4']};
test('SDK non-enumerable output getter is returned explicitly',async()=>{
 const result=Object.defineProperties({},{output:{get:()=>answer},usage:{get:()=>({inputTokens:1,outputTokens:2})}});
 const r=await analyzeTutor(input,{generate:async()=>result});assert.deepEqual(r.output,answer);assert.equal(r.usage.outputTokens,2);
});
test('busy model fails over with bounded per-call reservation',async()=>{
 const seen=[];let n=0;
 const r=await analyzeTutor(input,{beforeAttempt:async(i,m)=>seen.push(m),generate:async()=>{if(!n++)throw Object.assign(new Error('busy'),{statusCode:503});return {output:answer,usage:{}};}});
 assert.deepEqual(seen,tutorModels);assert.equal(r.model,tutorModels[1]);assert.equal(r.attempts.length,2);
});
test('permanent errors do not retry',async()=>{
 let count=0;await assert.rejects(analyzeTutor(input,{generate:async()=>{count++;throw Object.assign(new Error('key'),{statusCode:403});}}));assert.equal(count,1);
});
test('quota counts one personal request across retries and refunds once',async()=>{
 const calls=[];const sql=async(strings,...values)=>{calls.push({text:strings.join('?'),values});return [{outcome:'ok'}];};
 const q=aiQuota(sql,'local-test','tutor','2026-09-08');await q.reserve();await q.reserve();await q.refund();await q.refund();
 assert.equal(calls.length,3);assert.equal(calls[0].values.at(-1),true);assert.equal(calls[1].values.at(-1),false);assert.ok(calls[2].text.includes('GREATEST'));
});
test('blocked reservation does not refund somebody else quota',async()=>{
 let calls=0;const q=aiQuota(async()=>{calls++;return [{outcome:'site'}];},'test','tutor');
 await assert.rejects(q.reserve(),{status:429});await q.refund();assert.equal(calls,1);
});
