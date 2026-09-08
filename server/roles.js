import {effectiveRole} from '../src/roles.js';
export async function roleContext(sql,user){
 const [person]=await sql`SELECT p.*,COALESCE(a.assigned_role,'student') AS assigned_role FROM public.campus_people p LEFT JOIN public.campus_accounts a ON a.user_id=p.user_id WHERE p.user_id=${user.id}`;
 const [member]=await sql`SELECT c.*,m.role FROM public.campus_members m JOIN public.campus_classes c ON c.id=m.class_id WHERE m.user_id=${user.id} AND c.closed=false`;
 const [account]=await sql`SELECT requested_role,assigned_role FROM public.campus_accounts WHERE user_id=${user.id}`;
 return {person,member,requestedRole:account?.requested_role||'student',role:effectiveRole(user,{...person,assigned_role:account?.assigned_role},member)};
}
export async function siteSettings(sql){const [site]=await sql`SELECT sharing_enabled,notices_enabled,announcement FROM public.campus_site WHERE id=1`;return site||{sharing_enabled:true,notices_enabled:true,announcement:''};}
