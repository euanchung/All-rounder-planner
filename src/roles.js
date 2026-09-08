export const ROLE_NAMES={admin:'관리자',teacher:'선생님',leader:'반장',deputy:'부반장',student:'학생'};
export const requestedRoles=['teacher','leader','deputy','student'];
export function effectiveRole(user,person,member){
 if(user?.role==='admin')return 'admin';
 if(person?.teacher_status==='approved')return 'teacher';
 return ['leader','deputy'].includes(member?.role)?member.role:'student';
}
export const canPublish=role=>['admin','teacher','leader','deputy'].includes(role);
export const isTeacher=role=>role==='teacher';
