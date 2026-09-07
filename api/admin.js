import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
export default async function handler(req,res){
  try{
    if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
    const user=await identity(req);
    if(user.role!=='admin')return respond(res,403,{error:'관리자만 볼 수 있습니다.'});
    const sql=db();
    const [stats]=await sql`SELECT count(*)::integer AS accounts, count(*) FILTER (WHERE (data->'profile'->>'onboarded')::boolean)::integer AS configured FROM public.radar_workspace`;
    respond(res,200,stats);
  }catch(error){fail(res,error);}
}
