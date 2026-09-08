import {readFile} from 'node:fs/promises';
import {db} from '../server/db.js';
const sql=db(),ddl=await readFile(new URL('../server/campus-schema.sql',import.meta.url),'utf8');
// Split ordinary DDL separately from the final PL/pgSQL function body.
const marker='CREATE OR REPLACE FUNCTION',at=ddl.indexOf(marker);
const statements=ddl.slice(0,at).split(';').map(x=>x.trim()).filter(Boolean);
statements.push(ddl.slice(at));
const tables=['people','classes','members','notices','tables','rooms','messages','limits','blocks','reports','generations','accounts','site','audit'];
await sql.transaction(statements.map(statement=>sql.query(statement)));
for(const name of tables){await sql.query('ALTER TABLE public.campus_'+name+' ENABLE ROW LEVEL SECURITY');await sql.query('REVOKE ALL ON public.campus_'+name+' FROM PUBLIC');}
await sql`REVOKE ALL ON FUNCTION public.campus_tutor_reserve(text,text) FROM PUBLIC`;
console.log('Campus schema ready: additive tables, server-only permissions; existing workspaces untouched.');
