import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
const cache=new Map();
export default async function handler(req,res){try{
 const user=await identity(req);
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
 if(!process.env.NEIS_API_KEY)return respond(res,200,{enabled:false,text:'급식 자동 조회는 나이스 무료 API 인증키 등록 후 사용할 수 있어요. 아직 실제 급식 정보가 연결되지 않았습니다.'});
 const [w]=await db()`SELECT data FROM public.radar_workspace WHERE user_id=${user.id}`;
 const school=w?.data.profile?.school;if(!school)return respond(res,200,{text:'먼저 설정에서 정확한 학교 이름을 입력해 주세요.'});
 const date=new Date(Date.now()+9*3600000).toISOString().slice(0,10).replaceAll('-',''),key=school+':'+date;
 const hit=cache.get(key);if(hit&&Date.now()-hit.at<3600000)return respond(res,200,{enabled:true,text:hit.text});
 async function read(service,params){const url=new URL('https://open.neis.go.kr/hub/'+service);url.search=new URLSearchParams({KEY:process.env.NEIS_API_KEY,Type:'json',pIndex:'1',pSize:'100',...params});const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('NEIS');const j=await r.json();if(j.RESULT&&j.RESULT.CODE!=='INFO-200')throw new Error('NEIS');return j[service]?.find(v=>v.row)?.row||[];}
 const schools=(await read('schoolInfo',{SCHUL_NM:school})).filter(r=>r.SCHUL_NM===school);
 if(schools.length!==1)return respond(res,200,{text:'학교를 하나로 확인하지 못했어요. 정확한 학교 이름을 확인해 주세요. 동명 학교는 자동 선택하지 않습니다.'});
 const row=schools[0],meals=await read('mealServiceDietInfo',{ATPT_OFCDC_SC_CODE:row.ATPT_OFCDC_SC_CODE,SD_SCHUL_CODE:row.SD_SCHUL_CODE,MLSV_YMD:date});
 const text=meals.length?school+' · '+date+'\n'+meals.map(m=>m.MMEAL_SC_NM+'\n'+m.DDISH_NM.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'')).join('\n\n')+'\n출처: 나이스 교육정보 개방 포털. 괄호의 알레르기 번호는 원문 그대로 표시합니다. 변경 사항과 알레르기는 학교 공지를 확인하세요.':'오늘 등록된 급식 정보가 없어요.';
 if(cache.size>200)cache.clear();cache.set(key,{at:Date.now(),text});return respond(res,200,{enabled:true,text});
}catch(error){fail(res,error);}}
