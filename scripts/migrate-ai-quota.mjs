import {readFile} from 'node:fs/promises';
import {db} from '../server/db.js';
const sql=db(),ddl=await readFile(new URL('../server/ai-quota.sql',import.meta.url),'utf8');
await sql.transaction([
 sql.query(ddl),
 sql`REVOKE ALL ON FUNCTION public.campus_ai_reserve(text,text,text,boolean) FROM PUBLIC`,
 // Carry successful results forward; do not erase global provider-call counters.
 sql`INSERT INTO public.campus_limits(bucket,hits,expires_at)
 SELECT 'ai:user:'||(CASE WHEN mode='timetable' THEN 'timetable' ELSE 'tutor' END)||':'||user_id||':'||to_char(created_at AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD'),count(*)::int,now()+interval '40 days'
 FROM public.campus_generations WHERE status='complete' AND mode IN('timetable','concept','problem') AND created_at>now()-interval '40 days'
 GROUP BY 1 ON CONFLICT(bucket) DO NOTHING`
]);
console.log('AI quota migration complete; existing global limits and accounts unchanged.');
