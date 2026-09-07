import {neon} from '@neondatabase/serverless';
let sql;
export const db=()=>sql||(sql=neon(process.env.DATABASE_URL));
