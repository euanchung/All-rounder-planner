import {createRemoteJWKSet,jwtVerify} from 'jose';
import {db} from './db.js';
let jwks;
export async function identity(req){
  const token=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if(!token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  jwks||=createRemoteJWKSet(new URL(process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+'/.well-known/jwks.json'));
  let payload;
  try{({payload}=await jwtVerify(token,jwks,{requiredClaims:['sub','exp','iat']}));}
  catch{throw Object.assign(new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'),{status:401});}
  if(req.headers['x-radar-user']&&req.headers['x-radar-user']!==payload.sub)throw Object.assign(new Error('다른 탭에서 계정이 바뀌었습니다. 새로고침해 주세요.'),{status:401});
  // Query trusted provider identity, never email/role supplied by the browser.
  const sql=db();
  const [user]=await sql`SELECT id,email,name,"emailVerified" FROM neon_auth."user" WHERE id = ${payload.sub}`;
  if(!user)throw Object.assign(new Error('사용자 계정을 찾을 수 없습니다.'),{status:401});
  const adminEmail=process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if(adminEmail&&user.emailVerified&&user.email.toLowerCase()===adminEmail){
    await sql`INSERT INTO public.radar_admin (slot,user_id) VALUES (1,${user.id}) ON CONFLICT (slot) DO NOTHING`;
  }
  const [admin]=await sql`SELECT user_id FROM public.radar_admin WHERE slot=1 AND user_id=${user.id}`;
  return {id:user.id,email:user.email,name:user.name,emailVerified:user.emailVerified,role:admin?'admin':'member'};
}
export function respond(res,status,body){res.setHeader('Cache-Control','private, no-store');res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
export function fail(res,error){respond(res,error.status||503,{error:error.status?error.message:'저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
