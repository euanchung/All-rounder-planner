import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSchedule,retryableScheduleError,scheduleFailure,SCHEDULE_MODELS} from '../server/schedule-ai.js';
import {sciencePreset} from '../src/day-schedule.js';
import {normalizeSchedule,validSchedule} from '../server/schedule-policy.js';
const result={output:{...sciencePreset(),uncertainties:[]},usage:{inputTokens:10,outputTokens:20}};
const image={mediaType:'image/jpeg',data:Buffer.from('isolated mock')};
test('photo analysis validates output and does not retry successful calls',async()=>{
 const seen=[];const r=await analyzeSchedule(image,{generate:async options=>{assert.equal(options.maxRetries,0);assert.equal(options.messages[0].content[1].data,image.data);return result;},beforeAttempt:async i=>seen.push(i)});
 assert.deepEqual(seen,[0]);assert.equal(r.model,SCHEDULE_MODELS[0]);assert.equal(r.output.table.length,5);
});
test('503 retries once and reserves each call',async()=>{
 let calls=0;const reserved=[];const r=await analyzeSchedule(image,{generate:async()=>{if(!calls++)throw Object.assign(new Error('busy'),{statusCode:503});return result;},beforeAttempt:async(i,m)=>reserved.push(m)});
 assert.deepEqual(reserved,SCHEDULE_MODELS);assert.equal(r.attempts.length,2);assert.equal(r.model,SCHEDULE_MODELS[1]);
});
test('normalizer preserves readable rows and warns about overlap',()=>{
 const v=structuredClone(result.output);v.daySchedule.push({...v.daySchedule[0]});
 const n=normalizeSchedule(v);assert.ok(validSchedule(n));assert.equal(n.daySchedule.length,v.daySchedule.length-1);assert.ok(n.uncertainties.some(x=>x.includes('겹치')));
});
test('normalizer carries explicit merged activity but never invents missing subjects',()=>{
 const v=structuredClone(result.output);v.table[0][0]='';v.table[0][7]='';v.daySchedule.find(x=>x.period===8).label='8교시 자습';
 const n=normalizeSchedule(v);assert.equal(n.table[0][0],'');assert.equal(n.table[0][7],'자습');
});
test('normalizer rejects unusable photo data',()=>{
 assert.equal(normalizeSchedule({table:[],daySchedule:[],uncertainties:[]}),null);
 assert.equal(normalizeSchedule({...result.output,daySchedule:[]}),null);
});
test('permanent authentication and quota errors are not retried',async()=>{
 for(const statusCode of [400,401,403,429]){let calls=0;await assert.rejects(analyzeSchedule(image,{generate:async()=>{calls++;throw Object.assign(new Error('secret response'),{statusCode});}}));assert.equal(calls,1);}
});
test('quota refusal prevents fallback provider call',async()=>{
 let calls=0;await assert.rejects(analyzeSchedule(image,{generate:async()=>{calls++;throw Object.assign(new Error('busy'),{statusCode:503});},beforeAttempt:async i=>{if(i)throw Object.assign(new Error('quota'),{status:429});}}),{status:429});assert.equal(calls,1);
});
test('malformed schedule retries but never returns invalid draft',async()=>{
 let calls=0;await assert.rejects(analyzeSchedule(image,{generate:async()=>{calls++;return {...result,output:{table:[]}};}}));assert.equal(calls,2);
});
test('timeouts are retryable and safe messages never expose provider secrets',()=>{
 assert.equal(retryableScheduleError({name:'TimeoutError'}),true);
 for(const statusCode of [403,429,503]){const e=scheduleFailure({statusCode,message:'private API key'});assert.ok(!e.message.includes('private'));assert.equal(e.status,statusCode===429?429:503);}
 const own=Object.assign(new Error('사진을 선택하세요'),{status:400});assert.equal(scheduleFailure(own),own);
});
