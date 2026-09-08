import {randomUUID} from 'node:crypto';
import {generateText,Output,jsonSchema} from 'ai';
import {google} from '@ai-sdk/google';
import {db} from '../server/db.js';
import {MODEL,answerSchema,validAnswer,koreaDay} from '../server/tutor-policy.js';
const sql=db(),id=randomUUID();
if(process.env.AI_TUTOR_ENABLED!=='true')throw new Error('AI disabled: verify provider eligibility before running this diagnostic.');
try{
 const [r]=await sql`SELECT public.campus_tutor_reserve(${'diagnostic-'+id},${koreaDay()}) AS outcome`;console.log('reservation',r.outcome);
 if(r.outcome!=='ok')throw new Error('Quota');
 await sql`INSERT INTO public.campus_generations(id,user_id,model,subject,mode,question,has_image,fingerprint,status) VALUES (${id},'diagnostic',${MODEL},'수학','problem','x+2=5',false,${id},'pending')`;
 const result=await generateText({model:google(MODEL),maxOutputTokens:3000,maxRetries:0,abortSignal:AbortSignal.timeout(45000),providerOptions:{google:{thinkingConfig:{thinkingLevel:'low'}}},prompt:'한국어로 x+2=5 풀이를 설명. title 짧은 제목, concept 빈 문자열, steps 정확히 3개 문자열 (힌트, 중간 풀이, 정답 검산).',output:Output.object({schema:jsonSchema(answerSchema,{validate:value=>validAnswer(value)?{success:true,value}:{success:false,error:new Error('Invalid')}})})});
 const cost=(result.usage.inputTokens||0)*0.00000075+(result.usage.outputTokens||0)*0.00000375;
 await sql`UPDATE public.campus_generations SET status='complete',result=${JSON.stringify(result.output)}::jsonb,usage=${JSON.stringify(result.usage)}::jsonb,estimated_cost_usd=${cost} WHERE id=${id}`;
 console.log(JSON.stringify({id,result:result.output,usage:result.usage}));
}catch(e){console.log(JSON.stringify({name:e.name,status:e.statusCode,code:e.code}));await sql`UPDATE public.campus_generations SET status='error' WHERE id=${id}`;process.exitCode=1;}
