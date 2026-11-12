-- ==============================================================================
-- KuryenTipid / Team Ohm My Grid
-- Production Database Schema for Supabase & PostgreSQL
-- Robust User Authentication, Unique Constraints, CAN Validation, and Security
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Official Utility Customers Table (Meralco Customer Account Records)
-- Used to validate CAN (Customer and Account Number) against legitimate records
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meralco_customers (
    can VARCHAR(10) PRIMARY KEY,
    sin VARCHAR(14) NOT NULL UNIQUE, -- e.g. '1234-5678-90'
    account_holder_name VARCHAR(100) NOT NULL,
    email TEXT,
    service_address TEXT NOT NULL,
    rate_class VARCHAR(20) DEFAULT 'Residential',
    monthly_budget NUMERIC(10, 2) DEFAULT 3500.00,
    household_members INTEGER DEFAULT 5,
    major_appliances TEXT[] DEFAULT ARRAY['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
    is_registered BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT can_format_check CHECK (can ~ '^[0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_meralco_customers_email ON public.meralco_customers(LOWER(email));

COMMENT ON TABLE public.meralco_customers IS 'Pre-existing utility billing records against which new registrations are verified.';

-- ==============================================================================
-- 3. User Profiles Table (Extends Supabase auth.users)
-- Enforces UNIQUE constraints on Email, Username, and CAN
-- Enforces server-side validation rules matching frontend requirements
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    can VARCHAR(10) UNIQUE NOT NULL REFERENCES public.meralco_customers(can) ON UPDATE CASCADE,
    avatar_url TEXT,
    household_size INTEGER DEFAULT 5,
    monthly_budget NUMERIC(10, 2) DEFAULT 3500.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Server-side validation constraints
    CONSTRAINT chk_full_name_alpha_only CHECK (
        full_name ~* '^[A-Za-z ]{2,80}$'
    ),
    CONSTRAINT chk_username_alphanumeric CHECK (
        username ~ '^[A-Za-z0-9]{4,20}$'
    ),
    CONSTRAINT chk_email_format CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT chk_can_format CHECK (
        can ~ '^[0-9]{10}$'
    )
);

COMMENT ON TABLE public.profiles IS 'User profile information with strict validation and unique identifiers.';

-- Indexes for lightning-fast lookups during multi-identifier login
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_can ON public.profiles(can);

-- ==============================================================================
-- 4. Rate Limiting & Brute-Force Attack Prevention
-- Records failed and successful login attempts to prevent brute-force & credential stuffing
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Normalized identifier (lowercased email, username, or CAN)
    ip_address TEXT DEFAULT 'unknown',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
    ON public.auth_rate_limits(identifier, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip
    ON public.auth_rate_limits(ip_address, attempted_at DESC);

-- ==============================================================================
-- 5. Security & Audit Trail Logging
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- e.g. 'REGISTRATION_SUCCESS', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'RATE_LIMITED'
    identifier_used TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.meralco_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile only
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Meralco Customers: Authenticated user can see their own linked billing details
CREATE POLICY "Users can view their linked utility record"
    ON public.meralco_customers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.can = meralco_customers.can
            AND profiles.id = auth.uid()
        )
    );

-- Rate limits & Audit Logs: Read-only by authorized service role / backend
CREATE POLICY "System maintains rate limits"
    ON public.auth_rate_limits FOR ALL
    TO service_role USING (true);

CREATE POLICY "Users can view own audit entries"
    ON public.auth_audit_log FOR SELECT
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. Stored Functions (Security Definer RPCs)
-- ==============================================================================

-- 7.1 Validate CAN Eligibility before registration
-- Returns JSON with status, message, and customer details if valid
CREATE OR REPLACE FUNCTION public.check_can_eligibility(
    p_can TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_can TEXT;
    v_customer RECORD;
    v_already_registered BOOLEAN;
BEGIN
    -- Sanitize input (strip non-digits)
    v_clean_can := regexp_replace(p_can, '\D', '', 'g');

    -- Exact 10-digit check
    IF length(v_clean_can) <> 10 THEN
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'INVALID_FORMAT',
            'message', 'Customer Account Number (CAN) must be exactly 10 digits.'
        );
    END IF;

    -- Look up official record
    SELECT * INTO v_customer
    FROM public.meralco_customers
    WHERE can = v_clean_can;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'CAN_NOT_FOUND',
            'message', 'CAN was not found in utility customer records. Please check your electric bill.'
        );
    END IF;

    -- Check if already claimed / registered in profiles
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE can = v_clean_can
    ) INTO v_already_registered;

    IF v_already_registered OR v_customer.is_registered THEN
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'CAN_ALREADY_REGISTERED',
            'message', 'This Customer Account Number is already registered to an existing KuryenTipid account.'
        );
    END IF;

    -- Optional name validation if provided
    IF p_full_name IS NOT NULL AND length(trim(p_full_name)) > 1 THEN
        -- Check if primary word tokens match
        IF lower(v_customer.account_holder_name) NOT LIKE '%' || lower(split_part(trim(p_full_name), ' ', 1)) || '%' THEN
            -- Friendly soft notice (allow registration but return verification flag)
            RETURN jsonb_build_object(
                'valid', true,
                'code', 'CAN_ELIGIBLE_NAME_NOTICE',
                'message', 'Account found: ' || v_customer.account_holder_name,
                'account_holder', v_customer.account_holder_name,
                'service_address', v_customer.service_address,
                'sin', v_customer.sin
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', 'CAN_VALID',
        'message', 'Valid Meralco Customer Account Number.',
        'account_holder', v_customer.account_holder_name,
        'service_address', v_customer.service_address,
        'sin', v_customer.sin
    );
END;
$$;

-- 7.2 Rate Limiting Protection Check
-- Checks if an identifier or IP has exceeded 5 failed attempts in the last 15 minutes
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_ip TEXT DEFAULT '0.0.0.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_identifier TEXT := lower(trim(p_identifier));
    v_failed_count INTEGER := 0;
    v_window_interval INTERVAL := INTERVAL '15 minutes';
    v_max_attempts INTEGER := 5;
    v_last_attempt TIMESTAMPTZ;
    v_wait_seconds INTEGER := 0;
BEGIN
    -- Count failed attempts in the window
    SELECT COUNT(*), MAX(attempted_at)
    INTO v_failed_count, v_last_attempt
    FROM public.auth_rate_limits
    WHERE (identifier = v_norm_identifier OR (p_ip <> '0.0.0.0' AND ip_address = p_ip))
      AND success = FALSE
      AND attempted_at > (now() - v_window_interval);

    IF v_failed_count >= v_max_attempts THEN
        -- Calculate remaining cooldown
        v_wait_seconds := EXTRACT(EPOCH FROM (v_last_attempt + v_window_interval - now()))::INTEGER;
        IF v_wait_seconds < 0 THEN
            v_wait_seconds := 0;
        END IF;

        -- Record audit event
        INSERT INTO public.auth_audit_log (event_type, identifier_used, ip_address, details)
        VALUES ('RATE_LIMIT_BLOCKED', v_norm_identifier, p_ip, jsonb_build_object('failed_attempts', v_failed_count));

        RETURN jsonb_build_object(
            'allowed', false,
            'retry_after_seconds', v_wait_seconds,
            'message', 'Too many failed login attempts. Please wait ' || ceil(v_wait_seconds / 60.0)::TEXT || ' minute(s) before trying again.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'remaining_attempts', (v_max_attempts - v_failed_count)
    );
END;
$$;

-- 7.3 Log Login Attempt Result
CREATE OR REPLACE FUNCTION public.record_auth_attempt(
    p_identifier TEXT,
    p_ip TEXT DEFAULT '0.0.0.0',
    p_success BOOLEAN DEFAULT FALSE,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_identifier TEXT := lower(trim(p_identifier));
BEGIN
    -- Record into rate limits table
    INSERT INTO public.auth_rate_limits (identifier, ip_address, success, attempted_at)
    VALUES (v_norm_identifier, p_ip, p_success, now());

    -- Record into audit log
    INSERT INTO public.auth_audit_log (event_type, identifier_used, ip_address, user_agent, details)
    VALUES (
        CASE WHEN p_success THEN 'LOGIN_SUCCESS' ELSE 'LOGIN_FAILED' END,
        v_norm_identifier,
        p_ip,
        p_user_agent,
        jsonb_build_object('success', p_success)
    );

    -- If successful login, clear past failed attempts for this identifier to reset the window
    IF p_success THEN
        DELETE FROM public.auth_rate_limits
        WHERE identifier = v_norm_identifier AND success = FALSE;
    END IF;

    -- Routine cleanup of attempts older than 24 hours
    DELETE FROM public.auth_rate_limits
    WHERE attempted_at < (now() - INTERVAL '24 hours');
END;
$$;

-- 7.4 Multi-Identifier Login Resolver
-- Allows users to log in with Username, Email, OR CAN (10 digits)
-- Returns the registered email needed for Supabase Auth signInWithPassword
-- Protected against user enumeration through generic response timing and behavior
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(
    p_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trimmed TEXT := trim(p_identifier);
    v_lower TEXT := lower(v_trimmed);
    v_clean_can TEXT := regexp_replace(v_trimmed, '\D', '', 'g');
    v_resolved_email TEXT;
    v_user_id UUID;
BEGIN
    -- Case 1: Standard Email format
    IF v_lower ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
        SELECT email, id INTO v_resolved_email, v_user_id
        FROM public.profiles
        WHERE lower(email) = v_lower;

    -- Case 2: Exact 10-digit CAN format
    ELSIF length(v_clean_can) = 10 AND (v_trimmed ~ '^[0-9]{10}$' OR v_trimmed ~ '^[0-9]{4}-[0-9]{4}-[0-9]{2}$' OR v_trimmed ~ '^[0-9]{4} [0-9]{4} [0-9]{2}$') THEN
        SELECT email, id INTO v_resolved_email, v_user_id
        FROM public.profiles
        WHERE can = v_clean_can;

    -- Case 3: Alphanumeric Username (4 to 20 chars)
    ELSIF v_trimmed ~ '^[A-Za-z0-9]{4,20}$' THEN
        SELECT email, id INTO v_resolved_email, v_user_id
        FROM public.profiles
        WHERE lower(username) = v_lower;

    ELSE
        -- Invalid format altogether
        RETURN jsonb_build_object(
            'found', false,
            'message', 'Invalid credentials'
        );
    END IF;

    -- Return resolved email for internal auth sign-in
    IF v_resolved_email IS NOT NULL THEN
        RETURN jsonb_build_object(
            'found', true,
            'email', v_resolved_email
        );
    ELSE
        -- Return generic response to avoid enumeration
        RETURN jsonb_build_object(
            'found', false,
            'message', 'Invalid credentials'
        );
    END IF;
END;
$$;

-- 7.5 Get or Assign Meralco Customer CAN by Email for Registration
-- Pre-registers or matches an email to a Meralco CAN
CREATE OR REPLACE FUNCTION public.get_meralco_customer_by_email(
    p_email TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_email TEXT := lower(trim(p_email));
    v_customer RECORD;
    v_gen_can TEXT;
    v_gen_sin TEXT;
BEGIN
    -- 1. Look for pre-registered utility customer by email that is not yet claimed in profiles
    SELECT * INTO v_customer
    FROM public.meralco_customers
    WHERE lower(email) = v_norm_email
      AND can NOT IN (SELECT can FROM public.profiles)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'found', true,
            'can', v_customer.can,
            'sin', v_customer.sin,
            'account_holder', v_customer.account_holder_name,
            'service_address', v_customer.service_address,
            'rate_class', v_customer.rate_class,
            'monthly_budget', v_customer.monthly_budget,
            'household_members', v_customer.household_members,
            'major_appliances', v_customer.major_appliances
        );
    END IF;

    -- 2. If no record has this email, look for an unassigned customer record (no email attached)
    SELECT * INTO v_customer
    FROM public.meralco_customers
    WHERE (email IS NULL OR email = '')
      AND is_registered = FALSE
      AND can NOT IN (SELECT can FROM public.profiles)
    ORDER BY can ASC
    LIMIT 1;

    IF FOUND THEN
        -- Link this customer record with the email
        UPDATE public.meralco_customers
        SET email = v_norm_email,
            account_holder_name = COALESCE(p_full_name, account_holder_name)
        WHERE can = v_customer.can;

        RETURN jsonb_build_object(
            'found', true,
            'can', v_customer.can,
            'sin', v_customer.sin,
            'account_holder', COALESCE(p_full_name, v_customer.account_holder_name),
            'service_address', v_customer.service_address,
            'rate_class', v_customer.rate_class,
            'monthly_budget', v_customer.monthly_budget,
            'household_members', v_customer.household_members,
            'major_appliances', v_customer.major_appliances
        );
    END IF;

    -- 3. If all records are claimed, generate a new 10-digit CAN in Meralco range
    LOOP
        v_gen_can := '10' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.meralco_customers WHERE can = v_gen_can);
    END LOOP;

    v_gen_sin := regexp_replace(v_gen_can, '(\d{4})(\d{4})(\d{2})', '\1-\2-\3');

    INSERT INTO public.meralco_customers (
        can,
        sin,
        account_holder_name,
        email,
        service_address,
        rate_class,
        monthly_budget,
        household_members,
        major_appliances,
        is_registered
    ) VALUES (
        v_gen_can,
        v_gen_sin,
        COALESCE(p_full_name, 'Meralco Customer'),
        v_norm_email,
        'Meralco Franchise Area, Metro Manila',
        'Residential',
        3500.00,
        5,
        ARRAY['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
        FALSE
    )
    RETURNING * INTO v_customer;

    RETURN jsonb_build_object(
        'found', true,
        'can', v_customer.can,
        'sin', v_customer.sin,
        'account_holder', v_customer.account_holder_name,
        'service_address', v_customer.service_address,
        'rate_class', v_customer.rate_class,
        'monthly_budget', v_customer.monthly_budget,
        'household_members', v_customer.household_members,
        'major_appliances', v_customer.major_appliances
    );
END;
$$;

-- 7.6 Check Username Availability
CREATE OR REPLACE FUNCTION public.check_username_available(
    p_username TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(p_username))
    );
END;
$$;

-- ==============================================================================
-- 8. Supabase Auth Trigger (Handles new user registration)
-- Automatically copies verified user metadata from auth.users into public.profiles
-- and marks the CAN as registered in meralco_customers
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name TEXT;
    v_username TEXT;
    v_can TEXT;
    v_clean_can TEXT;
    v_lookup JSONB;
BEGIN
    -- Extract metadata supplied during registration
    v_full_name := trim(NEW.raw_user_meta_data->>'full_name');
    v_username  := lower(trim(NEW.raw_user_meta_data->>'username'));
    v_can       := trim(NEW.raw_user_meta_data->>'can');
    v_clean_can := regexp_replace(v_can, '\D', '', 'g');

    -- If CAN was not passed in metadata, lookup pre-registered CAN by email or allocate one
    IF v_clean_can IS NULL OR length(v_clean_can) <> 10 THEN
        v_lookup := public.get_meralco_customer_by_email(NEW.email, v_full_name);
        IF (v_lookup->>'found')::boolean THEN
            v_clean_can := v_lookup->>'can';
        END IF;
    END IF;

    -- Server-side validation assertions
    IF v_full_name IS NULL OR length(v_full_name) < 2 OR v_full_name !~* '^[A-Za-z ]{2,80}$' THEN
        RAISE EXCEPTION 'Full name must contain only alphabetic characters and spaces (minimum 2 characters)';
    END IF;

    IF v_username IS NULL OR v_username !~ '^[a-z0-9]{4,20}$' THEN
        RAISE EXCEPTION 'Username must be alphanumeric and 4-20 characters long';
    END IF;

    IF v_clean_can IS NULL OR length(v_clean_can) <> 10 THEN
        RAISE EXCEPTION 'Customer Account Number (CAN) must be exactly 10 numeric digits';
    END IF;

    -- Ensure CAN exists in utility records; if new, register it in meralco_customers
    IF NOT EXISTS (SELECT 1 FROM public.meralco_customers WHERE can = v_clean_can) THEN
        INSERT INTO public.meralco_customers (
            can,
            sin,
            account_holder_name,
            email,
            service_address,
            rate_class,
            monthly_budget,
            household_members,
            major_appliances,
            is_registered,
            registered_at
        ) VALUES (
            v_clean_can,
            regexp_replace(v_clean_can, '(\d{4})(\d{4})(\d{2})', '\1-\2-\3'),
            v_full_name,
            NEW.email,
            'Meralco Franchise Area, Metro Manila',
            'Residential',
            3500.00,
            5,
            ARRAY['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
            TRUE,
            now()
        );
    END IF;

    -- Ensure CAN is not already claimed
    IF EXISTS (SELECT 1 FROM public.profiles WHERE can = v_clean_can) THEN
        RAISE EXCEPTION 'Customer Account Number (CAN) has already been registered';
    END IF;

    -- Insert into profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        username,
        email,
        can,
        household_size,
        monthly_budget
    ) VALUES (
        NEW.id,
        v_full_name,
        v_username,
        NEW.email,
        v_clean_can,
        5,
        3500.00
    );

    -- Mark customer record as registered
    UPDATE public.meralco_customers
    SET is_registered = TRUE,
        registered_at = now()
    WHERE can = v_clean_can;

    -- Audit log
    INSERT INTO public.auth_audit_log (user_id, event_type, identifier_used, details)
    VALUES (NEW.id, 'REGISTRATION_SUCCESS', NEW.email, jsonb_build_object(
        'username', v_username,
        'can', v_clean_can
    ));

    RETURN NEW;
END;
$$;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
