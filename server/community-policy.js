import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export const SCHOOL_ROLES=['student','leader','deputy','teacher'];
export const affiliation=(p,c)=>!!p&&!!c&&p.school===c.school&&p.grade===c.grade&&p.class_name===c.class_name;
export const roomMember=(r,id)=>!!r&&r.status==='approved'&&r.members.includes(id);
export const shareAllowed=(r,role)=>r.kind==='group'||['admin','teacher','leader','deputy'].includes(role);
export function encodeCode(code){if(typeof code!=='string'||code.length<8||code.length>64)throw Object.assign(new Error('그룹 코드는 8~64자로 정해 주세요.'),{status:400});const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(code,salt,32).toString('hex');}
export function checkCode(code,encoded){if(typeof code!=='string'||code.length>64||!encoded)return false;const [salt,hex]=encoded.split(':');if(!salt||!hex||hex.length!==64)return false;return timingSafeEqual(scryptSync(code,salt,32),Buffer.from(hex,'hex'));}
export const ROOM_COLUMNS='id,name,members,created_by,kind,status,visibility,school,class_id';
