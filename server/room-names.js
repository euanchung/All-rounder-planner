// Resolve names only for conversations the caller is already participating in.
export async function nameRooms(sql,rooms,userId){
 const direct=rooms.filter(r=>r.kind==='direct'&&r.members.includes(userId));
 const ids=[...new Set(direct.flatMap(r=>r.members.filter(id=>id!==userId)))];
 const people=ids.length?await sql`SELECT user_id,name FROM public.campus_people WHERE user_id=ANY(${ids}::text[])`:[];
 const names=new Map(people.map(p=>[p.user_id,p.name?.trim()]));
 return rooms.map(r=>r.kind==='direct'?{...r,name:r.members.filter(id=>id!==userId).map(id=>names.get(id)||'탈퇴한 사용자').join(', ')||'상대방이 없는 대화'}:r);
}
