-- Run in Supabase SQL Editor after schema.sql. Safe to re-run.
BEGIN;

-- A random cancellation secret belongs to the browser that began registration.
-- Only its SHA-256 hash is saved on the pending auth user. Never delete by email alone.
CREATE OR REPLACE FUNCTION public.cancel_pending_signup(p_email text, p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_can text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
  SELECT * INTO v_user FROM auth.users
    WHERE lower(email) = lower(trim(p_email)) FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_user.email_confirmed_at IS NOT NULL OR
     (v_user.raw_user_meta_data->>'cancellation_hash') IS DISTINCT FROM
     encode(sha256(convert_to(p_token, 'UTF8')), 'hex') THEN
    RETURN false;
  END IF;
  SELECT can INTO v_can FROM public.profiles WHERE id = v_user.id;
  -- Serialize release of the existing reservation with another signup.
  PERFORM 1 FROM public.meralco_customers WHERE can = v_can FOR UPDATE;
  DELETE FROM auth.users WHERE id = v_user.id AND email_confirmed_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.meralco_customers SET is_registered = false, registered_at = NULL
    WHERE can = v_can AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE can = v_can);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_pending_signup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_pending_signup(text, text) TO anon, authenticated;

-- Enforce email-code authentication on the data API too. A password-only JWT
-- must not grant access while the app is waiting for a code.
DROP POLICY IF EXISTS "Email code required" ON public.profiles;
CREATE POLICY "Email code required" ON public.profiles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb)
  WITH CHECK (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb);
DROP POLICY IF EXISTS "Email code required" ON public.meralco_customers;
CREATE POLICY "Email code required" ON public.meralco_customers AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb)
  WITH CHECK (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb);
DROP POLICY IF EXISTS "Email code required" ON public.auth_audit_log;
CREATE POLICY "Email code required" ON public.auth_audit_log AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb)
  WITH CHECK (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"otp"}]'::jsonb);
COMMIT;
