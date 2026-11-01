
CREATE UNIQUE INDEX IF NOT EXISTS ifund_rate_limit_bucket_key_uidx
  ON ifund_stage.rate_limit_bucket (key);

CREATE OR REPLACE FUNCTION public.ifund_device_rate_limit(
  p_bucket_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  now_at timestamptz := clock_timestamp();
  window_at timestamptz;
  current_count integer;
BEGIN
  IF p_bucket_hash IS NULL
     OR p_bucket_hash !~ '^[0-9a-f]{64}$'
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400
  THEN
    RETURN false;
  END IF;

  INSERT INTO ifund_stage.rate_limit_bucket (key, window_start, count, description)
  VALUES (p_bucket_hash, now_at::text, 1, 'Server-side SHA-256 rate-limit bucket')
  ON CONFLICT (key) DO NOTHING;

  SELECT NULLIF(window_start, '')::timestamptz, count::integer
    INTO window_at, current_count
    FROM ifund_stage.rate_limit_bucket
   WHERE key = p_bucket_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF window_at IS NULL
     OR window_at + pg_catalog.make_interval(secs => p_window_seconds) <= now_at
  THEN
    UPDATE ifund_stage.rate_limit_bucket
       SET window_start = now_at::text, count = 1
     WHERE key = p_bucket_hash;
    RETURN true;
  END IF;

  IF current_count IS NULL OR current_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE ifund_stage.rate_limit_bucket
     SET count = current_count + 1
   WHERE key = p_bucket_hash;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.ifund_device_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_device_rate_limit(text, integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.ifund_device_rate_limit(text, integer, integer)
  IS 'Atomic fixed-window limiter for server-side workers; accepts only SHA-256 bucket hashes and is executable only by service_role.';
