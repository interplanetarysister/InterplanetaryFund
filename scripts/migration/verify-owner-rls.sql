-- Run on the designated destination after inspecting its user-defined triggers.
-- Creates synthetic rows only inside this transaction. No provider calls or email.
-- An error means FAIL; do not interpret a statement count as test success.
BEGIN;
DO $probe$
DECLARE
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  campaign_a uuid;
  campaign_b uuid;
  post_b uuid;
  affected integer;
BEGIN
  INSERT INTO auth.users(id, aud, role) VALUES
    (user_a, 'authenticated', 'authenticated'),
    (user_b, 'authenticated', 'authenticated');
  INSERT INTO public.ifund_campaigns(owner_id, title) VALUES(user_a, 'RLS fixture A') RETURNING id INTO campaign_a;
  INSERT INTO public.ifund_campaigns(owner_id, title) VALUES(user_b, 'RLS fixture B') RETURNING id INTO campaign_b;
  INSERT INTO public.ifund_profiles(id, handle) VALUES(user_a, 'probe_' || replace(user_a::text, '-', '')::varchar(20)),
    (user_b, 'probe_' || replace(user_b::text, '-', '')::varchar(20));
  INSERT INTO public.ifund_posts(author_id, body) VALUES(user_b, 'RLS fixture') RETURNING id INTO post_b;
  INSERT INTO public.ifund_connections(owner_id, provider) VALUES(user_a, 'rls-fixture'), (user_b, 'rls-fixture');

  PERFORM set_config('request.jwt.claim.sub', user_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() IS DISTINCT FROM user_a THEN RAISE EXCEPTION 'Wrong test identity'; END IF;
  SELECT count(*) INTO affected FROM public.ifund_campaigns WHERE id IN (campaign_a, campaign_b);
  IF affected <> 1 THEN RAISE EXCEPTION 'Cross-owner draft read'; END IF;
  UPDATE public.ifund_campaigns SET title = 'Cross-owner update' WHERE id = campaign_b;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-owner campaign update'; END IF;
  DELETE FROM public.ifund_campaigns WHERE id = campaign_b;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-owner campaign delete'; END IF;
  BEGIN
    INSERT INTO public.ifund_campaigns(owner_id, title) VALUES(user_b, 'Spoofed owner');
    RAISE EXCEPTION 'Owner spoof insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.ifund_campaigns SET owner_id = user_b WHERE id = campaign_a;
    RAISE EXCEPTION 'Owner reassignment succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.ifund_campaigns SET created_at = now() WHERE id = campaign_a;
    RAISE EXCEPTION 'Client timestamp override succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.ifund_campaigns SET title = 'Owned update' WHERE id = campaign_a;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owned campaign update failed'; END IF;
  SELECT count(*) INTO affected FROM public.ifund_profiles WHERE id IN (user_a, user_b);
  IF affected <> 1 THEN RAISE EXCEPTION 'Cross-owner profile read'; END IF;
  SELECT count(*) INTO affected FROM public.ifund_connections WHERE owner_id IN (user_a, user_b);
  IF affected <> 1 THEN RAISE EXCEPTION 'Cross-owner provider status read'; END IF;
  BEGIN
    UPDATE public.ifund_connections SET status = 'connected' WHERE owner_id = user_a;
    RAISE EXCEPTION 'Unverified provider activation succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.ifund_posts WHERE id = post_b;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-owner post deletion'; END IF;
  BEGIN
    INSERT INTO public.ifund_posts(author_id, body) VALUES(user_b, 'Spoofed author');
    RAISE EXCEPTION 'Post author spoof succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM source_id FROM ifund_transfer.source_snapshots LIMIT 1;
    RAISE EXCEPTION 'Private snapshot read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO affected FROM public.ifund_campaigns WHERE id IN (campaign_a, campaign_b);
  IF affected <> 0 THEN RAISE EXCEPTION 'Anonymous draft read'; END IF;
  BEGIN
    INSERT INTO public.ifund_campaigns(owner_id, title) VALUES(user_a, 'Anonymous insert');
    RAISE EXCEPTION 'Anonymous campaign insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM source_id FROM ifund_transfer.campaign_snapshots LIMIT 1;
    RAISE EXCEPTION 'Anonymous snapshot read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE NOTICE 'PASS: 17 database-role ownership and privilege checks; rolling back fixtures';
END;
$probe$;
ROLLBACK;
