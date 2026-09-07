import {db} from '../server/db.js';
import {identity,respond,fail} from '../server/security.js';
import {validateBackup} from '../src/engine.js';
import {upgrade} from '../src/profile.js';
export default async function handler(req,res){
  try{
    if(!['GET','PUT'].includes(req.method))return respond(res,405,{error:'Method not allowed'});
    const user=await identity(req),sql=db();
    if(req.method==='GET'){
      const initial=upgrade({version:1,tasks:[],capacity:90,acceptedPlan:null});
      initial.profile.name=user.name||'';
      await sql`INSERT INTO public.radar_workspace (user_id,data) VALUES (${user.id},${JSON.stringify(initial)}::jsonb) ON CONFLICT DO NOTHING`;
      const [row]=await sql`SELECT data,revision FROM public.radar_workspace WHERE user_id=${user.id}`;
      return respond(res,200,{...row,user});
    }
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||JSON.stringify(body).length>4_000_000||!Number.isInteger(body.revision)||body.revision<0||!validateBackup(body.data))return respond(res,400,{error:'저장할 데이터 형식이 올바르지 않습니다.'});
    // Pick known fields, so role/user_id cannot be smuggled into identity.
    const value=upgrade(body.data);
    const clean={version:2,tasks:value.tasks,capacity:value.capacity,acceptedPlan:value.acceptedPlan||null,profile:value.profile};
    const rows=await sql`UPDATE public.radar_workspace SET data=${JSON.stringify(clean)}::jsonb,revision=revision+1,updated_at=now() WHERE user_id=${user.id} AND revision=${body.revision} RETURNING revision`;
    if(!rows.length)return respond(res,409,{error:'다른 탭이나 기기에서 내용이 바뀌었습니다. 현재 내용을 백업한 뒤 새로고침해 주세요.'});
    return respond(res,200,rows[0]);
  }catch(error){fail(res,error);}
}
