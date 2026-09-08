import {randomUUID} from 'node:crypto';
import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {siteSettings} from '../server/roles.js';
import {requestedRoles} from '../src/roles.js';
const deny=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
export const createAdminHandler=({getIdentity=identity,getDb=db}={})=>async function handler(req,res){try{
 const user=await getIdentity(req);if(user.role!=='admin')deny('관리자만 사용할 수 있습니다.',403);
 const sql=getDb(),url=new URL(req.url,'https://local.invalid');
 if(req.method==='GET'){
  const page=Math.floor(Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0))),q=(url.searchParams.get('q')||'').trim().slice(0,100),search='%'+q+'%';
  const [count]=await sql`SELECT count(*)::integer AS total FROM neon_auth."user" WHERE email ILIKE ${search} OR name ILIKE ${search}`;
  const users=await sql`SELECT u.id,u.email,u.name,u."createdAt" AS created_at,p.school,p.grade,p.class_name,p.teacher_status,COALESCE(a.requested_role,'student') AS requested_role,COALESCE(a.suspended,false) AS suspended,CASE WHEN adm.user_id IS NOT NULL THEN 'admin' WHEN p.teacher_status='approved' THEN 'teacher' WHEN m.role IN('leader','deputy') THEN m.role ELSE 'student' END AS role FROM neon_auth."user" u LEFT JOIN public.campus_people p ON p.user_id=u.id::text LEFT JOIN public.campus_accounts a ON a.user_id=u.id::text LEFT JOIN public.campus_members m ON m.user_id=u.id::text LEFT JOIN public.radar_admin adm ON adm.user_id=u.id::text WHERE u.email ILIKE ${search} OR u.name ILIKE ${search} ORDER BY u."createdAt" DESC,u.id LIMIT 50 OFFSET ${page*50}`;
  const reports=await sql`SELECT id,user_id,room_id,reason,created_at FROM public.campus_reports ORDER BY created_at DESC LIMIT 100`;
  const audit=await sql`SELECT action,target_id,created_at FROM public.campus_audit ORDER BY created_at DESC LIMIT 30`;
  return respond(res,200,{users,total:count.total,page,site:await siteSettings(sql),reports,audit});
 }
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||JSON.stringify(b).length>10000)deny('요청을 확인하세요.');
 const target=typeof b.userId==='string'?b.userId:null,operations=[];
 if(['role','suspend'].includes(b.action)){
  if(!target||target.length>100)deny('대상을 확인하세요.');
  const [existing]=await sql`SELECT id FROM neon_auth."user" WHERE id=${target}`;if(!existing)deny('회원을 찾지 못했어요.',404);
  const [admin]=await sql`SELECT user_id FROM public.radar_admin WHERE user_id=${target}`;if(admin)deny('관리자 자신의 권한·이용 상태는 변경할 수 없어요.',403);
  if(b.action==='suspend'){
   if(typeof b.suspended!=='boolean')deny('이용 상태를 확인하세요.');
   operations.push(sql`INSERT INTO public.campus_accounts(user_id,suspended) VALUES(${target},${b.suspended}) ON CONFLICT(user_id) DO UPDATE SET suspended=EXCLUDED.suspended`);
  }else{
   if(!requestedRoles.includes(b.role))deny('역할을 확인하세요.');
   const [p]=await sql`SELECT user_id FROM public.campus_people WHERE user_id=${target}`;if(!p)deny('첫 개인 설정을 마친 회원만 역할을 승인할 수 있어요.');
   const [m]=await sql`SELECT m.class_id,c.owner_id FROM public.campus_members m JOIN public.campus_classes c ON c.id=m.class_id WHERE m.user_id=${target}`;
   if(m?.owner_id===target&&b.role!=='teacher')deny('학급 운영 중인 선생님은 먼저 학급 담당자를 변경해야 해요.');
   if(['leader','deputy'].includes(b.role)&&!m)deny('반장·부반장은 먼저 학급에 연결되어야 해요.');
   operations.push(sql`UPDATE public.campus_people SET teacher_status=${b.role==='teacher'?'approved':'none'} WHERE user_id=${target}`);
   operations.push(sql`UPDATE public.campus_members SET role=${b.role} WHERE user_id=${target}`);
   operations.push(sql`INSERT INTO public.campus_accounts(user_id,requested_role) VALUES(${target},${b.role}) ON CONFLICT(user_id) DO UPDATE SET requested_role=EXCLUDED.requested_role`);
  }
 }else if(b.action==='site'){
  if(typeof b.sharing_enabled!=='boolean'||typeof b.notices_enabled!=='boolean'||typeof b.announcement!=='string'||b.announcement.length>2000)deny('프로그램 설정을 확인하세요.');
  operations.push(sql`UPDATE public.campus_site SET sharing_enabled=${b.sharing_enabled},notices_enabled=${b.notices_enabled},announcement=${b.announcement.trim()} WHERE id=1`);
 }else if(b.action==='resolve-report'){
  if(typeof b.reportId!=='string'||!/^[-0-9a-f]{36}$/i.test(b.reportId))deny('신고를 확인하세요.');
  operations.push(sql`DELETE FROM public.campus_reports WHERE id=${b.reportId}`);
 }else deny('지원하지 않는 관리 요청입니다.');
 operations.push(sql`INSERT INTO public.campus_audit(id,actor_id,target_id,action) VALUES(${randomUUID()},${user.id},${target||b.reportId||null},${b.action+(b.role?':'+b.role:b.action==='suspend'?':'+b.suspended:'')})`);
 await sql.transaction(operations);return respond(res,200,{ok:true});
}catch(e){fail(res,e);}};
export default createAdminHandler();
