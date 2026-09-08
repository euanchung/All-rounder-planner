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
