import {randomUUID,createHash} from 'node:crypto';
import {analyzeTutor} from '../server/tutor-ai.js';
import {aiQuota,aiRemaining} from '../server/ai-quota.js';
import {roleContext} from '../server/roles.js';
import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {MODEL,USER_DAILY,SITE_DAILY,SITE_MONTHLY,estimatedAiCost,tutorInput,tutorEnabled,tutorFailure} from '../server/tutor-policy.js';
export const config={maxDuration:60};
const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export default async function handler(req,res){let generationId,quota;
 try{
  const user=await identity(req),sql=db(),url=new URL(req.url,'https://local.invalid');
  const enabled=tutorEnabled();
  if(req.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){if(!/^[0-9a-f-]{36}$/.test(id))reject('답변 주소를 확인해 주세요.');const [g]=await sql`SELECT id,subject,mode,question,result,status,created_at FROM public.campus_generations WHERE id=${id} AND user_id=${user.id} AND mode IN('concept','problem')`;if(!g)reject('내 계정의 답변을 찾지 못했어요.',404);return respond(res,200,g);}
   const history=await sql`SELECT id,subject,mode,question,status,created_at FROM public.campus_generations WHERE user_id=${user.id} AND mode IN('concept','problem') ORDER BY created_at DESC LIMIT 30`;
   return respond(res,200,{enabled,history,remaining:await aiRemaining(sql,user.id,'tutor'),limits:{userDaily:USER_DAILY,siteDaily:SITE_DAILY,siteMonthly:SITE_MONTHLY}});
  }
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
  if((await roleContext(sql,user)).role==='teacher')reject('선생님은 학급 운영 기능을 이용해 주세요.',403);
  const input=tutorInput(typeof req.body==='string'?JSON.parse(req.body):req.body);
  if(!enabled)reject('AI 연결 설정을 확인 중입니다. 선생님께 질문하기는 사용할 수 있어요.',503);
  const digest=createHash('sha256').update(JSON.stringify([MODEL,input.subject,input.mode,input.question])).update(input.image?.data||'').digest('hex');
  const [cached]=await sql`SELECT id,result FROM public.campus_generations WHERE user_id=${user.id} AND fingerprint=${digest} AND status='complete' ORDER BY created_at DESC LIMIT 1`;
  if(cached)return respond(res,200,{...cached,cached:true});
  quota=aiQuota(sql,user.id,'tutor');
  generationId=randomUUID();
  await sql`INSERT INTO public.campus_generations(id,user_id,model,subject,mode,question,has_image,fingerprint,status) VALUES (${generationId},${user.id},${MODEL},${input.subject},${input.mode},${input.question},${!!input.image},${digest},'pending')`;
  const result=await analyzeTutor(input,{beforeAttempt:()=>quota.reserve(),onAttempt:attempt=>console.warn('[tutor-attempt]',{...attempt,generationId})});
  const answer=result.output,usage=result.usage,cost=estimatedAiCost(result.model,usage);
  await sql`UPDATE public.campus_generations SET model=${result.model},result=${JSON.stringify(answer)}::jsonb,usage=${JSON.stringify({...usage,attempts:result.attempts})}::jsonb,estimated_cost_usd=${cost},status='complete' WHERE id=${generationId}`;
  return respond(res,200,{id:generationId,result:answer});
 }catch(error){if(quota)await quota.refund().catch(()=>console.warn('[tutor-refund-failed]',{generationId}));console.warn('[tutor]',{name:error.name,code:error.code,status:error.status||error.statusCode,generationId:generationId||null});if(generationId)await db()`UPDATE public.campus_generations SET status='error' WHERE id=${generationId}`.catch(()=>{});fail(res,tutorFailure(error));}
}
