CREATE OR REPLACE FUNCTION public.campus_ai_reserve(who text, day_key text, feature text, charge_personal boolean)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE keys text[] := ARRAY['tutor:month:'||left(day_key,7),'tutor:site:'||day_key,'ai:user:'||feature||':'||who||':'||day_key];
 counts integer[]; k text;
BEGIN
 IF feature NOT IN ('timetable','tutor') THEN RAISE EXCEPTION 'Invalid feature'; END IF;
 FOREACH k IN ARRAY keys LOOP
  INSERT INTO public.campus_limits(bucket,hits,expires_at) VALUES(k,0,now()+interval '40 days') ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.campus_limits WHERE bucket=k FOR UPDATE;
 END LOOP;
 SELECT ARRAY[(SELECT hits FROM public.campus_limits WHERE bucket=keys[1]),(SELECT hits FROM public.campus_limits WHERE bucket=keys[2]),(SELECT hits FROM public.campus_limits WHERE bucket=keys[3])] INTO counts;
 IF counts[1]>=40 THEN RETURN 'month'; END IF;
 IF counts[2]>=30 THEN RETURN 'site'; END IF;
 IF charge_personal AND counts[3]>=5 THEN RETURN 'user'; END IF;
 UPDATE public.campus_limits SET hits=hits+1 WHERE bucket=ANY(keys[1:2]);
 IF charge_personal THEN UPDATE public.campus_limits SET hits=hits+1 WHERE bucket=keys[3]; END IF;
 RETURN 'ok';
END $$;
