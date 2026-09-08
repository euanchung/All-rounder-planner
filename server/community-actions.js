import {randomUUID} from 'node:crypto';
import {affiliation,encodeCode,checkCode,roomMember} from './community-policy.js';
const deny=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const id=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>100)deny('이름은 1~100자로 입력하세요.');return v.trim();};
export async function communityActions(sql,user,person,member,role,b){
 const action=b.action;
 if(['request-role','request-teacher','approve-teacher','leader','invite'].includes(action))deny('역할은 관리자만 지정할 수 있습니다. 학급에는 코드가 필요하지 않아요.',403);
 if(action==='create-class'){
  if(role!=='teacher')deny('관리자가 지정한 선생님만 학급을 개설할 수 있어요.',403);
  if(!person||member)deny('소속을 설정하고 기존 학급에서 탈퇴한 뒤 개설하세요.');
  const classId=randomUUID(),roomId=randomUUID();
  await sql.transaction([sql`INSERT INTO public.campus_classes(id,school,grade,class_name,owner_id,invite_hash) VALUES(${classId},${person.school},${person.grade},${person.class_name},${user.id},${randomUUID()})`,sql`INSERT INTO public.campus_members(class_id,user_id,role) VALUES(${classId},${user.id},'teacher')`,sql`INSERT INTO public.campus_rooms(id,name,members,created_by,kind,status,visibility,school,class_id) VALUES(${roomId},${person.grade+'학년 '+person.class_name+'반'},${[user.id]}::text[],${user.id},'class','approved','public',${person.school},${classId})`]);return {ok:true};
 }
 if(action==='join'){
  if(!person||member||b.consent!==true||!id(b.classId))deny('소속·학급과 참여 안내를 확인하세요.');
  const [c]=await sql`SELECT * FROM public.campus_classes WHERE id=${b.classId} AND closed=false`;
  if(!affiliation(person,c))deny('같은 학교·학년·반의 학급에만 입장할 수 있어요.',403);
  const [owner]=await sql`SELECT 1 FROM public.campus_accounts WHERE user_id=${c.owner_id} AND assigned_role='teacher'`;
  if(!owner)deny('담당 선생님이 없는 학급입니다.',403);
  const result=await sql.transaction([sql`INSERT INTO public.campus_members(class_id,user_id,role) SELECT c.id,${user.id},${role} FROM public.campus_classes c WHERE c.id=${c.id} AND c.closed=false AND NOT EXISTS(SELECT 1 FROM public.campus_exclusions WHERE scope_id=c.id AND user_id=${user.id}) RETURNING user_id`,sql`UPDATE public.campus_rooms SET members=array_append(array_remove(members,${user.id}),${user.id}) WHERE class_id=${c.id} AND status='approved' AND EXISTS(SELECT 1 FROM public.campus_members WHERE class_id=${c.id} AND user_id=${user.id})`]);if(!result[0].length)deny('이 학급에 입장할 수 없어요. 선생님께 문의하세요.',403);return {ok:true};
 }
 if(action==='leave-class'){
  if(!member)return {ok:true};
  const ops=[];
  if(member.owner_id===user.id){ops.push(sql`UPDATE public.campus_classes SET closed=true WHERE id=${member.id}`,sql`UPDATE public.campus_rooms SET status='closed',members=ARRAY[]::text[] WHERE class_id=${member.id}`,sql`DELETE FROM public.campus_members WHERE class_id=${member.id}`);}
  else ops.push(sql`DELETE FROM public.campus_members WHERE user_id=${user.id}`,sql`UPDATE public.campus_rooms SET members=array_remove(members,${user.id}) WHERE class_id=${member.id}`);
  await sql.transaction(ops);return {ok:true};
 }
 if(action==='kick-class'){
  if(!member||role!=='teacher'||typeof b.userId!=='string'||b.userId===member.owner_id)deny('담당 선생님만 학생을 추방할 수 있어요.',403);
  await sql.transaction([sql`INSERT INTO public.campus_exclusions(scope_id,user_id) VALUES(${member.id},${b.userId}) ON CONFLICT DO NOTHING`,sql`DELETE FROM public.campus_members WHERE class_id=${member.id} AND user_id=${b.userId}`,sql`UPDATE public.campus_rooms SET members=array_remove(members,${b.userId}) WHERE class_id=${member.id}`]);return {ok:true};
 }
 if(action==='create-group'){
  if(!person||!['public','code'].includes(b.visibility)||b.consent!==true)deny('프로필과 그룹 공개 방식·참여 안내를 확인하세요.');
  const [count]=await sql`SELECT count(*)::int AS n FROM public.campus_rooms WHERE created_by=${user.id} AND kind='group' AND status<>'closed'`;if(count.n>=20)deny('개설 중인 그룹은 최대 20개입니다.');
  const groupId=randomUUID(),code=b.visibility==='code'?encodeCode(b.code):null;
  await sql`INSERT INTO public.campus_rooms(id,name,members,created_by,kind,status,visibility,school,code_hash) VALUES(${groupId},${name(b.name)},ARRAY[]::text[],${user.id},'group','pending',${b.visibility},${b.schoolOnly===true?person.school:null},${code})`;return {ok:true,id:groupId,pending:true};
 }
 if(action==='join-group'){
  if(!person||!id(b.roomId)||b.consent!==true)deny('그룹과 참여 안내를 확인하세요.');
  const [r]=await sql`SELECT * FROM public.campus_rooms WHERE id=${b.roomId} AND kind='group' AND status='approved'`;
  if(!r||(r.school&&r.school!==person.school))deny('입장할 수 없는 그룹입니다.',403);
  if(r.visibility==='code'&&!checkCode(b.code,r.code_hash))deny('그룹 코드를 확인해 주세요.',403);
  const rows=await sql`UPDATE public.campus_rooms SET members=array_append(array_remove(members,${user.id}),${user.id}) WHERE id=${r.id} AND status='approved' AND cardinality(members)<300 AND NOT EXISTS(SELECT 1 FROM public.campus_exclusions WHERE scope_id=${r.id} AND user_id=${user.id}) RETURNING id`;if(!rows.length)deny('그룹이 닫혔거나 정원이 찼거나 추방된 상태입니다.',403);return {ok:true,id:r.id};
 }
 if(action==='leave-room'){
  if(!id(b.roomId))deny('대화방을 확인하세요.');const [r]=await sql`SELECT * FROM public.campus_rooms WHERE id=${b.roomId}`;if(!roomMember(r,user.id))deny('참여자가 아닙니다.',403);if(r.kind==='class')return communityActions(sql,user,person,member,role,{action:'leave-class'});
  await sql`UPDATE public.campus_rooms SET members=array_remove(members,${user.id}) WHERE id=${r.id}`;return {ok:true};
 }
 return null;
}
export async function communityDirectory(sql,user,person,member){
 const classes=person?await sql`SELECT c.id,c.school,c.grade,c.class_name,p.name AS teacher FROM public.campus_classes c JOIN public.campus_accounts a ON a.user_id=c.owner_id AND a.assigned_role='teacher' LEFT JOIN public.campus_people p ON p.user_id=c.owner_id WHERE c.closed=false AND c.school=${person.school} AND c.grade=${person.grade} AND c.class_name=${person.class_name} AND NOT EXISTS(SELECT 1 FROM public.campus_exclusions WHERE scope_id=c.id AND user_id=${user.id})`:[];
 const groups=await sql`SELECT id,name,visibility,school,status,created_by,cardinality(members) AS size,${user.id}=ANY(members) AS joined FROM public.campus_rooms WHERE kind='group' AND ((status='approved' AND (school IS NULL OR school=${person?.school||''})) OR (status='pending' AND created_by=${user.id})) AND NOT EXISTS(SELECT 1 FROM public.campus_exclusions WHERE scope_id=id AND user_id=${user.id}) ORDER BY created_at DESC LIMIT 300`;
 const classmates=member?await sql`SELECT p.user_id,p.name,a.assigned_role AS role FROM public.campus_members m JOIN public.campus_people p ON p.user_id=m.user_id LEFT JOIN public.campus_accounts a ON a.user_id=m.user_id WHERE m.class_id=${member.id}`:[];
 return {classes,groups,classmates};
}
