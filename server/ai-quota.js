import {koreaDay,USER_DAILY} from './tutor-policy.js';
export const quotaBucket=(user,feature,day=koreaDay())=>'ai:user:'+feature+':'+user+':'+day;
export function aiQuota(sql,user,feature,day=koreaDay()){
 let charged=false;
 return {
  async reserve(){
   const[r]=await sql`SELECT public.campus_ai_reserve(${user},${day},${feature},${!charged}) AS outcome`;
   if(r.outcome!=='ok'){
    const message={month:'이번 달 사이트 AI 호출 한도에 도달했어요. 저장된 결과는 계속 볼 수 있어요.',site:'오늘 사이트 전체 AI 호출 한도에 도달했어요. 한국 시간 자정에 다시 사용할 수 있어요.',user:'오늘 이 기능의 개인 사용 한도에 도달했어요. 한국 시간 자정에 다시 사용할 수 있어요.'}[r.outcome]||'AI 사용 한도를 확인해 주세요.';
    throw Object.assign(new Error(message),{status:429});
   }
   charged=true;
  },
  async refund(){
   if(!charged)return;
   charged=false;
   await sql`UPDATE public.campus_limits SET hits=GREATEST(0,hits-1) WHERE bucket=${quotaBucket(user,feature,day)}`;
  }
 };
}
export async function aiRemaining(sql,user,feature){
 const[r]=await sql`SELECT hits FROM public.campus_limits WHERE bucket=${quotaBucket(user,feature)}`;
 return Math.max(0,USER_DAILY-(r?.hits||0));
}
