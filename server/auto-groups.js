import {createHash,randomUUID} from 'node:crypto';

// Group scope comes from verified class membership, never editable profile text.
export function autoGroupScopes(person,member){
 if(!person?.discoverable||!member)return [];
 const scope=(kind,parts,name)=>({kind,key:createHash('sha256').update(JSON.stringify([kind,...parts])).digest('hex'),name});
 return [
  scope('class',[member.school,member.grade,member.class_name],member.school+' '+member.grade+'학년 '+member.class_name+'반'),
  scope('school',[member.school],member.school+' 전체')
 ];
}
export function canAccessRoom(room,userId,scopes){
 return room?.auto_key?scopes.some(s=>s.key===room.auto_key):!!room?.members?.includes(userId);
}
export async function ensureAutoGroups(sql,scopes){
 if(!scopes.length)return [];
 // Unique scope keys make simultaneous first visits share exactly one room.
 await sql.transaction(scopes.map(s=>sql`INSERT INTO public.campus_rooms(id,name,members,created_by,auto_key,auto_kind) VALUES (${randomUUID()},${s.name},ARRAY[]::text[],'system:auto',${s.key},${s.kind}) ON CONFLICT(auto_key) DO NOTHING`));
 const rooms=await sql`SELECT id,name,members,auto_kind FROM public.campus_rooms WHERE auto_key=ANY(${scopes.map(s=>s.key)}::text[])`;
 return rooms.sort((a,b)=>a.auto_kind==='class'?-1:b.auto_kind==='class'?1:0);
}
