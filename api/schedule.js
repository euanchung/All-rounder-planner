import {randomUUID,createHash} from 'node:crypto';
import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {koreaDay,tutorInput,tutorEnabled} from '../server/tutor-policy.js';
import {analyzeSchedule,scheduleFailure,SCHEDULE_VERSION,SCHEDULE_MODELS} from '../server/schedule-ai.js';
import {normalizeSchedule} from '../server/schedule-policy.js';
export const config={maxDuration:60};
const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export default async function handler(req,res){let generationId;
 try{
  const user=await identity(req),sql=db(),url=new URL(req.url,'https://local.invalid');
  if(req.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){if(!/^[0-9a-f-]{36}$/.test(id))reject('분석 주소를 확인하세요.');const[g]=await sql`SELECT id,result,status,created_at FROM public.campus_generations WHERE id=${id} AND user_id=${user.id} AND mode='timetable'`;if(!g)reject('내 시간표 분석 결과를 찾지 못했어요.',404);return respond(res,200,{...g,result:g.status==='complete'?normalizeSchedule(g.result):g.result});}
   return respond(res,200,{history:await sql`SELECT id,status,created_at FROM public.campus_generations WHERE user_id=${user.id} AND mode='timetable' ORDER BY created_at DESC LIMIT 20`});
  }
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const input=tutorInput({mode:'problem',subject:'기타',question:'시간표 사진 분석',image:body?.image,consent:body?.consent});
  if(!input.image)reject('시간표 사진을 선택하세요.');
  if(!tutorEnabled())reject('AI 연결을 사용할 수 없어요. 사진을 보며 직접 입력할 수 있어요.',503);
  const digest=createHash('sha256').update(SCHEDULE_VERSION).update(input.image.data).digest('hex');
  const[cached]=await sql`SELECT id,result FROM public.campus_generations WHERE user_id=${user.id} AND fingerprint=${digest} AND mode='timetable' AND status='complete' LIMIT 1`;
  if(cached)return respond(res,200,{...cached,result:normalizeSchedule(cached.result),cached:true});
  const[reservation]=await sql`SELECT public.campus_tutor_reserve(${user.id},${koreaDay()}) AS outcome`;
  if(reservation.outcome!=='ok')reject('AI 공동 사용 한도에 도달했어요. 사진을 보며 직접 입력하거나 저장된 분석 결과를 사용하세요.',429);
  generationId=randomUUID();
  await sql`INSERT INTO public.campus_generations(id,user_id,model,subject,mode,question,has_image,fingerprint,status) VALUES(${generationId},${user.id},${SCHEDULE_MODELS[0]},'시간표','timetable','시간표 사진 분석',true,${digest},'pending')`;
  const result=await analyzeSchedule(input.image,{beforeAttempt:async index=>{if(!index)return;const[r]=await sql`SELECT public.campus_tutor_reserve(${user.id},${koreaDay()}) AS outcome`;if(r.outcome!=='ok')reject('AI 사용 한도에 도달해 재시도를 멈췄어요. 이전 사진 분석 결과를 확인하거나 나중에 다시 시도해 주세요.',429);},onAttempt:attempt=>console.warn('[schedule-attempt]',{...attempt,generationId})});
  const usage=result.usage,cost=(usage.inputTokens||0)*0.0000015+(usage.outputTokens||0)*0.000009;
  await sql`UPDATE public.campus_generations SET result=${JSON.stringify(result.output)}::jsonb,model=${result.model},usage=${JSON.stringify({...usage,attempts:result.attempts})}::jsonb,estimated_cost_usd=${cost},status='complete' WHERE id=${generationId}`;
  return respond(res,200,{id:generationId,result:result.output});
 }catch(error){console.warn('[schedule]',{name:error.name,status:error.status||error.statusCode,generationId:generationId||null});if(generationId)await db()`UPDATE public.campus_generations SET status='error' WHERE id=${generationId}`.catch(()=>{});fail(res,scheduleFailure(error));}
}
