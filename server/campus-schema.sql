CREATE TABLE IF NOT EXISTS public.campus_people (
 user_id text PRIMARY KEY, name text NOT NULL, school text NOT NULL, grade text NOT NULL, class_name text NOT NULL,
 discoverable boolean NOT NULL DEFAULT false, teacher_status text NOT NULL DEFAULT 'none', subjects text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campus_classes (
 id uuid PRIMARY KEY, school text NOT NULL, grade text NOT NULL, class_name text NOT NULL, owner_id text NOT NULL,
 invite_hash text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campus_members (
 class_id uuid NOT NULL REFERENCES public.campus_classes(id), user_id text NOT NULL, role text NOT NULL DEFAULT 'student',
 PRIMARY KEY(class_id,user_id), UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS public.campus_notices (
 id uuid PRIMARY KEY, class_id uuid NOT NULL REFERENCES public.campus_classes(id), author_id text NOT NULL,
 title text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campus_tables (
 class_id uuid NOT NULL REFERENCES public.campus_classes(id), week date NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(class_id,week)
);
CREATE TABLE IF NOT EXISTS public.campus_rooms (
 id uuid PRIMARY KEY, name text NOT NULL, members text[] NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campus_messages (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES public.campus_rooms(id), sender_id text NOT NULL, body text NOT NULL, shared jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS auto_key text;
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS auto_kind text;
CREATE UNIQUE INDEX IF NOT EXISTS campus_rooms_auto_key ON public.campus_rooms(auto_key);
CREATE INDEX IF NOT EXISTS campus_messages_room_date ON public.campus_messages(room_id,created_at);
CREATE TABLE IF NOT EXISTS public.campus_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.campus_blocks (user_id text NOT NULL, blocked_id text NOT NULL, PRIMARY KEY(user_id,blocked_id));
CREATE TABLE IF NOT EXISTS public.campus_reports (id uuid PRIMARY KEY, user_id text NOT NULL, room_id uuid NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.campus_generations (
 id uuid PRIMARY KEY, user_id text NOT NULL, model text NOT NULL, subject text NOT NULL, mode text NOT NULL,
 question text NOT NULL, has_image boolean NOT NULL, fingerprint text NOT NULL, status text NOT NULL,
 result jsonb, usage jsonb, estimated_cost_usd numeric, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campus_generations_user_date ON public.campus_generations(user_id,created_at);
CREATE TABLE IF NOT EXISTS public.campus_accounts (user_id text PRIMARY KEY, requested_role text NOT NULL DEFAULT 'student', suspended boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS public.campus_site (id integer PRIMARY KEY CHECK(id=1), sharing_enabled boolean NOT NULL DEFAULT true, notices_enabled boolean NOT NULL DEFAULT true, announcement text NOT NULL DEFAULT '');
INSERT INTO public.campus_site(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.campus_audit (id uuid PRIMARY KEY, actor_id text NOT NULL, target_id text, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.campus_schools (school text PRIMARY KEY, payload jsonb NOT NULL, owner_id text NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.campus_school_tables (school text NOT NULL, grade text NOT NULL, class_name text NOT NULL, week date NOT NULL, payload jsonb NOT NULL, owner_id text NOT NULL, revision integer NOT NULL DEFAULT 1, PRIMARY KEY(school,grade,class_name,week));
CREATE TABLE IF NOT EXISTS public.campus_reads (user_id text NOT NULL, room_id uuid NOT NULL REFERENCES public.campus_rooms(id) ON DELETE CASCADE, read_at timestamptz NOT NULL, PRIMARY KEY(user_id,room_id));
ALTER TABLE public.campus_messages ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS campus_message_idempotency ON public.campus_messages(sender_id,client_id) WHERE client_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.campus_push (endpoint text PRIMARY KEY,user_id text NOT NULL,subscription jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS public.campus_school_classes (
 school text NOT NULL, grade text NOT NULL, class_name text NOT NULL, owner_id text NOT NULL,
 PRIMARY KEY(school,grade,class_name)
);
INSERT INTO public.campus_school_classes(school,grade,class_name,owner_id)
 SELECT DISTINCT ON (school,grade,class_name) school,grade,class_name,owner_id FROM public.campus_school_tables
 ORDER BY school,grade,class_name,week ON CONFLICT DO NOTHING;
-- v10: authoritative roles and explicit, moderated membership.
ALTER TABLE public.campus_accounts ADD COLUMN IF NOT EXISTS assigned_role text NOT NULL DEFAULT 'student';
ALTER TABLE public.campus_classes ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS campus_active_affiliation ON public.campus_classes(school,grade,class_name) WHERE closed=false;
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'direct';
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.campus_classes(id);
ALTER TABLE public.campus_rooms ADD COLUMN IF NOT EXISTS code_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS campus_class_room ON public.campus_rooms(class_id) WHERE class_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.campus_exclusions(scope_id uuid NOT NULL,user_id text NOT NULL,PRIMARY KEY(scope_id,user_id));
-- Only old automatic rooms are converted. Running this migration again never rejoins anyone.
UPDATE public.campus_rooms SET kind='group',status='pending',visibility='public',members=ARRAY[]::text[],school=(SELECT p.school FROM public.campus_people p WHERE p.user_id=campus_rooms.created_by),auto_key=NULL,auto_kind=NULL WHERE auto_key IS NOT NULL;
UPDATE public.campus_rooms SET kind='group',status='pending' WHERE kind='direct' AND cardinality(members)>2;

CREATE OR REPLACE FUNCTION public.campus_tutor_reserve(who text, day_key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE keys text[] := ARRAY['tutor:month:'||left(day_key,7),'tutor:site:'||day_key,'tutor:user:'||who||':'||day_key];
 counts integer[]; k text;
BEGIN
 FOREACH k IN ARRAY keys LOOP
  INSERT INTO public.campus_limits(bucket,hits,expires_at) VALUES(k,0,now()+interval '40 days') ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.campus_limits WHERE bucket=k FOR UPDATE;
 END LOOP;
 SELECT ARRAY[(SELECT hits FROM public.campus_limits WHERE bucket=keys[1]),(SELECT hits FROM public.campus_limits WHERE bucket=keys[2]),(SELECT hits FROM public.campus_limits WHERE bucket=keys[3])] INTO counts;
 IF counts[1]>=40 THEN RETURN 'month'; END IF;
 IF counts[2]>=30 OR counts[3]>=5 THEN RETURN 'day'; END IF;
 UPDATE public.campus_limits SET hits=hits+1 WHERE bucket=ANY(keys);
 RETURN 'ok';
END $$;
