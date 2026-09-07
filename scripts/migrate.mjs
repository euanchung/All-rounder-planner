import {db} from '../server/db.js';
const sql=db();
await sql`CREATE TABLE IF NOT EXISTS public.radar_workspace (
 user_id text PRIMARY KEY, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS public.radar_admin (
 slot integer PRIMARY KEY CHECK (slot = 1), user_id text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
)`;
// No browser-facing database access. APIs own authorization; RLS additionally
// denies unprivileged direct access. Never expose DATABASE_URL to the frontend.
await sql`ALTER TABLE public.radar_workspace ENABLE ROW LEVEL SECURITY`;
await sql`ALTER TABLE public.radar_admin ENABLE ROW LEVEL SECURITY`;
await sql`REVOKE ALL ON public.radar_workspace, public.radar_admin FROM PUBLIC`;
console.log('Workspace schema ready (non-destructive migration).');
