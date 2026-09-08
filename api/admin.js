import {randomUUID} from 'node:crypto';
import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {SCHOOL_ROLES,encodeCode} from '../server/community-policy.js';
const deny=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
const uuid=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>100)deny('이름·소속을 확인하세요.');return v.trim();};
export const createAdminHandler=({getIdentity=identity,getDb=db}={})=>async function handler(req,res){try{
 const user=await getIdentity(req);if(user.role!=='admin')deny('관리자만 사용할 수 있습니다.',403);
 const sql=getDb(),url=new URL(req.url,'https://local.invalid');
 const audit=(action,target=null)=>sql`INSERT INTO public.campus_audit(id,actor_id,target_id,action) VALUES(${randomUUID()},${user.id},${target},${action})`;
 if(req.method==='GET'){
  if(url.searchParams.has('room')){
   const id=url.searchParams.get('room');if(!uuid(id))deny('대화방을 확인하세요.');
   const before=url.searchParams.get('before');if(before&&!Number.isFinite(Date.parse(before)))deny('시각을 확인하세요.');
   const [room]=await sql`SELECT id,name,kind,status,members,class_id FROM public.campus_rooms WHERE id=${id}`;if(!room)deny('대화방이 없습니다.',404);
   const messages=await sql`SELECT m.id,m.sender_id,COALESCE(p.name,u.name) AS name,m.body,m.shared,m.created_at::text AS created_at FROM public.campus_messages m LEFT JOIN public.campus_people p ON p.user_id=m.sender_id LEFT JOIN neon_auth."user" u ON u.id::text=m.sender_id WHERE room_id=${id} AND (${!before} OR m.created_at<${before||'9999-01-01'}::timestamptz) ORDER BY m.created_at DESC,m.id DESC LIMIT 100`;
   const members=await sql`SELECT u.id,u.name,u.email FROM neon_auth."user" u WHERE u.id::text=ANY(${room.members}::text[])`;
   await audit('read-chat',id);return respond(res,200,{room,messages:messages.reverse(),members,next:messages.length===100?messages[0]?.created_at:null});
  }
  if(url.searchParams.has('table')){
   const school=name(url.searchParams.get('school')),grade=name(url.searchParams.get('grade')),className=name(url.searchParams.get('className'));
   const tables=await sql`SELECT week::text,payload FROM public.campus_school_tables WHERE school=${school} AND grade=${grade} AND class_name=${className} UNION SELECT t.week::text,t.payload FROM public.campus_tables t JOIN public.campus_classes c ON c.id=t.class_id WHERE c.school=${school} AND c.grade=${grade} AND c.class_name=${className} ORDER BY week DESC`;
   const [schedule]=await sql`SELECT payload FROM public.campus_schools WHERE school=${school}`;await audit('read-timetable',school+'/'+grade+'/'+className);return respond(res,200,{tables,schedule:schedule?.payload||null});
  }
  const page=Math.floor(Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0))),q=(url.searchParams.get('q')||'').trim().slice(0,100),search='%'+q+'%',section=url.searchParams.get('section')||'users';
  if(section==='spaces'){
   const rooms=await sql`SELECT id,name,kind,status,visibility,school,class_id,created_by,cardinality(members) AS size FROM public.campus_rooms WHERE name ILIKE ${search} ORDER BY created_at DESC LIMIT 100 OFFSET ${page*100}`;
   const classes=await sql`SELECT c.id,c.school,c.grade,c.class_name,c.owner_id,c.closed,p.name AS teacher FROM public.campus_classes c LEFT JOIN public.campus_people p ON p.user_id=c.owner_id WHERE c.school ILIKE ${search} ORDER BY c.school,c.grade,c.class_name LIMIT 100 OFFSET ${page*100}`;
   const exclusions=await sql`SELECT x.scope_id,x.user_id,u.name,u.email FROM public.campus_exclusions x JOIN neon_auth."user" u ON u.id::text=x.user_id ORDER BY u.name LIMIT 300`;
   return respond(res,200,{section,page,q,rooms,classes,exclusions});
  }
  if(section==='tables'){
   const affiliations=await sql`SELECT school,grade,class_name FROM public.campus_school_tables UNION SELECT school,grade,class_name FROM public.campus_classes UNION SELECT school,grade,class_name FROM public.campus_people ORDER BY school,grade,class_name`;return respond(res,200,{section,affiliations,page:0,q});
  }
  const [count]=await sql`SELECT count(*)::integer AS total,count(*) FILTER(WHERE id::text NOT IN(SELECT user_id FROM public.radar_admin))::integer AS members FROM neon_auth."user" WHERE email ILIKE ${search} OR name ILIKE ${search}`;
  const users=await sql`SELECT u.id,u.email,COALESCE(p.name,u.name) AS name,p.school,p.grade,p.class_name,CASE WHEN adm.user_id IS NOT NULL THEN 'admin' ELSE COALESCE(a.assigned_role,'student') END AS role FROM neon_auth."user" u LEFT JOIN public.campus_people p ON p.user_id=u.id::text LEFT JOIN public.campus_accounts a ON a.user_id=u.id::text LEFT JOIN public.radar_admin adm ON adm.user_id=u.id::text WHERE u.email ILIKE ${search} OR u.name ILIKE ${search} ORDER BY u."createdAt" DESC,u.id LIMIT 50 OFFSET ${page*50}`;
  return respond(res,200,{section,users,total:count.total,memberTotal:count.members,page,q});
 }
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||JSON.stringify(b).length>10000)deny('요청을 확인하세요.');
 const ops=[],target=b.userId||b.id||null;
 if(b.action==='role'){
  if(!uuid(b.userId)||!SCHOOL_ROLES.includes(b.role))deny('회원과 역할을 확인하세요.');
  const [existing]=await sql`SELECT id FROM neon_auth."user" WHERE id=${b.userId}`;if(!existing)deny('회원을 찾지 못했어요.',404);
  const [admin]=await sql`SELECT user_id FROM public.radar_admin WHERE user_id=${b.userId}`;if(admin)deny('소유자 관리자 권한은 변경할 수 없어요.',403);
  ops.push(sql`INSERT INTO public.campus_accounts(user_id,assigned_role,requested_role) VALUES(${b.userId},${b.role},'student') ON CONFLICT(user_id) DO UPDATE SET assigned_role=EXCLUDED.assigned_role,requested_role='student'`,sql`UPDATE public.campus_people SET teacher_status=${b.role==='teacher'?'approved':'none'} WHERE user_id=${b.userId}`,sql`UPDATE public.campus_members SET role=${b.role} WHERE user_id=${b.userId}`);
  if(b.role!=='teacher')ops.push(sql`UPDATE public.campus_rooms SET status='closed',members=ARRAY[]::text[] WHERE class_id IN(SELECT id FROM public.campus_classes WHERE owner_id=${b.userId})`,sql`DELETE FROM public.campus_members WHERE class_id IN(SELECT id FROM public.campus_classes WHERE owner_id=${b.userId})`,sql`UPDATE public.campus_classes SET closed=true WHERE owner_id=${b.userId}`);
 }else if(['approve-group','close-room','edit-group','kick-room'].includes(b.action)){
  if(!uuid(b.id))deny('대화방을 확인하세요.');const [r]=await sql`SELECT id,kind,status,class_id,created_by FROM public.campus_rooms WHERE id=${b.id}`;if(!r)deny('대화방이 없습니다.',404);
  if(r.kind!=='group'&&b.action!=='kick-room')deny('그룹 관리에서만 가능한 작업입니다.');
  if(b.action==='approve-group'){if(r.status!=='pending')deny('승인 대기 그룹이 아닙니다.');ops.push(sql`UPDATE public.campus_rooms SET status='approved' WHERE id=${r.id} AND status='pending'`);}
  if(b.action==='close-room')ops.push(sql`UPDATE public.campus_rooms SET status='closed',members=ARRAY[]::text[] WHERE id=${r.id}`);
  if(b.action==='edit-group'){
   if(!['public','code'].includes(b.visibility))deny('공개 방식을 확인하세요.');
   const [prev]=await sql`SELECT code_hash FROM public.campus_rooms WHERE id=${r.id}`;
   const code=b.visibility==='code'?(b.code?encodeCode(b.code):prev.code_hash):null;if(b.visibility==='code'&&!code)deny('새 코드를 입력하세요.');
   const school=typeof b.school==='string'&&b.school.trim()?name(b.school):null;
   ops.push(sql`UPDATE public.campus_rooms SET name=${name(b.name)},visibility=${b.visibility},code_hash=${code},school=${school} WHERE id=${r.id}`);
   if(school)ops.push(sql`UPDATE public.campus_rooms SET members=ARRAY(SELECT p.user_id FROM public.campus_people p WHERE p.school=${school} AND p.user_id=ANY(campus_rooms.members)) WHERE id=${r.id}`);
  }
  if(b.action==='kick-room'){
   if(!uuid(b.userId))deny('회원을 확인하세요.');if(r.kind==='class')deny('학급 추방 기능을 이용하세요.');
   ops.push(sql`INSERT INTO public.campus_exclusions(scope_id,user_id) VALUES(${r.id},${b.userId}) ON CONFLICT DO NOTHING`,sql`UPDATE public.campus_rooms SET members=array_remove(members,${b.userId}) WHERE id=${r.id}`);
  }
 }else if(['close-class','kick-class','edit-class'].includes(b.action)){
  if(!uuid(b.id))deny('학급을 확인하세요.');const [c]=await sql`SELECT * FROM public.campus_classes WHERE id=${b.id}`;if(!c)deny('학급이 없습니다.',404);
  if(b.action==='close-class')ops.push(sql`UPDATE public.campus_classes SET closed=true WHERE id=${c.id}`,sql`UPDATE public.campus_rooms SET status='closed',members=ARRAY[]::text[] WHERE class_id=${c.id}`,sql`DELETE FROM public.campus_members WHERE class_id=${c.id}`);
  if(b.action==='kick-class'){
   if(!uuid(b.userId)||b.userId===c.owner_id)deny('담당 선생님은 먼저 변경하거나 학급을 폐쇄하세요.');
   ops.push(sql`INSERT INTO public.campus_exclusions(scope_id,user_id) VALUES(${c.id},${b.userId}) ON CONFLICT DO NOTHING`,sql`DELETE FROM public.campus_members WHERE class_id=${c.id} AND user_id=${b.userId}`,sql`UPDATE public.campus_rooms SET members=array_remove(members,${b.userId}) WHERE class_id=${c.id}`);
  }
  if(b.action==='edit-class'){
   const school=name(b.school),grade=name(b.grade),className=name(b.className);
   if(!uuid(b.ownerId))deny('담당자 ID를 확인하세요.');
   const [teacher]=await sql`SELECT p.user_id FROM public.campus_people p JOIN public.campus_accounts a ON a.user_id=p.user_id AND a.assigned_role='teacher' WHERE p.user_id=${b.ownerId} AND p.school=${school} AND p.grade=${grade} AND p.class_name=${className}`;if(!teacher)deny('해당 소속의 선생님 역할 사용자만 담당자가 될 수 있어요.');
   const mismatches=await sql`SELECT 1 FROM public.campus_members m JOIN public.campus_people p ON p.user_id=m.user_id WHERE m.class_id=${c.id} AND (p.school<>${school} OR p.grade<>${grade} OR p.class_name<>${className}) LIMIT 1`;if(mismatches.length)deny('기존 회원 소속과 다릅니다. 먼저 해당 회원을 내보내세요.');
   const [other]=await sql`SELECT class_id FROM public.campus_members WHERE user_id=${b.ownerId} AND class_id<>${c.id}`;if(other)deny('담당자가 다른 학급에 참여 중이에요.');
   ops.push(sql`UPDATE public.campus_classes SET school=${school},grade=${grade},class_name=${className},owner_id=${b.ownerId} WHERE id=${c.id}`,sql`INSERT INTO public.campus_members(class_id,user_id,role) VALUES(${c.id},${b.ownerId},'teacher') ON CONFLICT(user_id) DO NOTHING`,sql`UPDATE public.campus_rooms SET name=${grade+'학년 '+className+'반'},school=${school},created_by=${b.ownerId},members=array_append(array_remove(members,${b.ownerId}),${b.ownerId}) WHERE class_id=${c.id}`);
  }
 }else if(b.action==='unban'){
  if(!uuid(b.id)||!uuid(b.userId))deny('대상을 확인하세요.');ops.push(sql`DELETE FROM public.campus_exclusions WHERE scope_id=${b.id} AND user_id=${b.userId}`);
 }else deny('지원하지 않는 관리 요청입니다.');
 ops.push(audit(b.action+(b.role?':'+b.role:''),target));await sql.transaction(ops);return respond(res,200,{ok:true});
}catch(e){fail(res,e);}};
export default createAdminHandler();
