import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorEnabled,tutorFailure,MODEL} from '../server/tutor-policy.js';
test('Gemini requires both explicit activation and a server key',()=>{
 const before={flag:process.env.AI_TUTOR_ENABLED,key:process.env.GOOGLE_GENERATIVE_AI_API_KEY};
 try{
  process.env.AI_TUTOR_ENABLED='true';delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;assert.equal(tutorEnabled(),false);
  process.env.GOOGLE_GENERATIVE_AI_API_KEY=' ';assert.equal(tutorEnabled(),false);
  process.env.GOOGLE_GENERATIVE_AI_API_KEY='synthetic-test-key';assert.equal(tutorEnabled(),true);
  process.env.AI_TUTOR_ENABLED='false';assert.equal(tutorEnabled(),false);
  assert.equal(MODEL,'gemini-3.8-flash');
 }finally{for(const [key,value] of [['AI_TUTOR_ENABLED',before.flag],['GOOGLE_GENERATIVE_AI_API_KEY',before.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('provider errors are sanitized while quota and application statuses survive',()=>{
 const error=Object.assign(new Error('private provider details'),{statusCode:429});
 assert.equal(tutorFailure(error).status,429);
 assert.ok(!tutorFailure(error).message.includes('private provider details'));
 assert.equal(tutorFailure(new Error('secret')).status,503);
 const denied=Object.assign(new Error('login required'),{status:401});
 assert.equal(tutorFailure(denied),denied);
});
