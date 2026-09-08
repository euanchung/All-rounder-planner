import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {roleContext} from '../server/roles.js';
import {validTable,validPeriodTimes} from '../src/campus-model.js';
import {validDaySchedule} from '../src/day-schedule.js';
import {validDate} from '../src/engine.js';
const reject=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
export default async function handler(req,res){try{
 const user=await identity(req),sql=db(),url=new URL(req.url,'https://local.invalid');
 if(req.method==='GET'){
  const school=(url.searchParams.get('school')||'').trim(),grade=(url.searchParams.get('grade')||'').trim(),klass=(url.searchParams.get('className')||'').trim(),week=url.searchParams.get('week');if(!school||school.length>100||grade.length>100||klass.length>100||!validDate(week))reject('학교·학년·반·주를 확인하세요.');
  const [schedule]=await sql`SELECT payload,revision,owner_id FROM public.campus_schools WHERE school=${school}`;
  const [table]=await sql`SELECT payload,revision,owner_id,week::text AS week FROM public.campus_school_tables WHERE school=${school} AND grade=${grade} AND class_name=${klass} AND week<=${week}::date ORDER BY week DESC LIMIT 1`;
  const c=await roleContext(sql,user),privileged=user.role==='admin'||c.role==='teacher'&&c.person.school===school;
  return respond(res,200,{schedule:schedule?{...schedule.payload,revision:schedule.revision,canEdit:privileged||schedule.owner_id===user.id}:null,table:table?{...table.payload,revision:table.revision,week:table.week,canEdit:privileged||table.owner_id===user.id}:null});
 }
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||JSON.stringify(b).length>40000)reject('요청을 확인하세요.');
 const [w]=await sql`SELECT data FROM public.radar_workspace WHERE user_id=${user.id}`;const p=w?.data.profile;if(!p?.campusOnboarded)reject('먼저 개인 설정을 저장하세요.');
 const c=await roleContext(sql,user),privileged=user.role==='admin'||c.role==='teacher'&&c.person.school===p.school;
 if(b.action==='schedule'){
  if(!validDaySchedule(b.daySchedule)||!validPeriodTimes(b.periodTimes)||b.daySchedule.some(r=>r.period&&r.start!==b.periodTimes[r.period-1]))reject('일과의 시각과 교시가 일치하는지 확인하세요.');
  const payload={daySchedule:b.daySchedule,periodTimes:b.periodTimes};const[old]=await sql`SELECT owner_id,revision FROM public.campus_schools WHERE school=${p.school}`;
  if(!old){const rows=await sql`INSERT INTO public.campus_schools(school,payload,owner_id) VALUES(${p.school},${JSON.stringify(payload)}::jsonb,${user.id}) ON CONFLICT DO NOTHING RETURNING revision`;if(!rows.length)reject('다른 회원이 먼저 등록했어요. 다시 불러와 주세요.',409);}
  else{if(!privileged&&old.owner_id!==user.id)reject('최초 등록자 또는 승인된 선생님만 학교 일과를 수정할 수 있어요.',403);if(old.revision!==b.revision)reject('학교 일과가 바뀌었어요. 다시 불러오세요.',409);const updated=await sql`UPDATE public.campus_schools SET payload=${JSON.stringify(payload)}::jsonb,revision=revision+1,updated_at=now() WHERE school=${p.school} AND revision=${b.revision} RETURNING revision`;if(!updated.length)reject('학교 일과가 바뀌었어요. 다시 불러오세요.',409);}
 }else if(b.action==='table'){
  if(!validDate(b.week)||!validTable(b.table))reject('시간표를 확인하세요.');
  await sql`INSERT INTO public.campus_school_classes(school,grade,class_name,owner_id) VALUES(${p.school},${p.grade},${p.className},${user.id}) ON CONFLICT DO NOTHING`;const[base]=await sql`SELECT owner_id FROM public.campus_school_classes WHERE school=${p.school} AND grade=${p.grade} AND class_name=${p.className}`;
  if(base&&!privileged&&base.owner_id!==user.id)reject('최초 학급 등록자 또는 선생님만 공유 시간표를 수정할 수 있어요.',403);
  const[old]=await sql`SELECT revision FROM public.campus_school_tables WHERE school=${p.school} AND grade=${p.grade} AND class_name=${p.className} AND week=${b.week}::date`;
  if(old&&old.revision!==b.revision)reject('시간표가 바뀌었어요. 다시 불러오세요.',409);
  const payload={table:b.table};if(old){const updated=await sql`UPDATE public.campus_school_tables SET payload=${JSON.stringify(payload)}::jsonb,revision=revision+1 WHERE school=${p.school} AND grade=${p.grade} AND class_name=${p.className} AND week=${b.week}::date AND revision=${b.revision} RETURNING revision`;if(!updated.length)reject('시간표가 바뀌었어요. 다시 불러오세요.',409);}
  else{const rows=await sql`INSERT INTO public.campus_school_tables(school,grade,class_name,week,payload,owner_id) VALUES(${p.school},${p.grade},${p.className},${b.week},${JSON.stringify(payload)}::jsonb,${base?.owner_id||user.id}) ON CONFLICT DO NOTHING RETURNING revision`;if(!rows.length)reject('시간표가 먼저 등록됐어요. 다시 불러오세요.',409);}
 }else reject('지원하지 않는 요청입니다.');
 return respond(res,200,{ok:true});
 }catch(error){console.warn('[school]',{method:req.method,status:error.status||503,code:error.code||null});fail(res,error);}}
