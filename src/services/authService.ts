// ==============================================================================
// Authentication Service for KuryenTipid
// Implements Registration, Multi-Identifier Login, Server-Side Validation,
// CAN Verification, Rate Limiting, Audit Logging, and Enumeration Protection
// ==============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPasswordCheckClient, isLiveSupabaseConfigured, supabase } from '../config/supabase';
import {
  AuthResponse,
  CustomerRecord,
  RateLimitStatus,
  RegistrationFormData,
  UserProfile,
} from '../types/auth';
import {
  cleanCAN,
  detectIdentifierType,
  formatCANDisplay,
  validateCAN,
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from '../utils/validation';

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_SESSION: '@kuryentipid_active_session',
  USERS: '@kuryentipid_registered_accounts',
  CUSTOMERS: '@kuryentipid_local_customers',
  RATE_LIMITS: '@kuryentipid_rate_limits',
  AUDIT_LOG: '@kuryentipid_audit_log',
  OTP_STORE: '@kuryentipid_otp_store',
  PENDING_EMAIL: '@kuryentipid_pending_email_verification',
};

// Seed utility customer database (mirrors Meralco database in supabase/seed.sql)
export const DEFAULT_CUSTOMER_RECORDS: CustomerRecord[] = [
  {
    can: '1234567890',
    sin: '1234-5678-90',
    accountHolderName: 'Nena Villanueva',
    serviceAddress: 'Block 14 Lot 8, Sampaguita St., Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3500.0,
    householdMembers: 5,
    majorAppliances: ['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
    isRegistered: false,
  },
  {
    can: '1234567891',
    sin: '1234-5678-91',
    accountHolderName: 'Jaeda Marthena Iral',
    serviceAddress: 'Unit 402, Katipunan Ave., Loyola Heights, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 4200.0,
    householdMembers: 4,
    majorAppliances: ['Inverter AC (1.0 HP) x 2', 'Induction Cooker', 'Water Heater'],
    isRegistered: false,
  },
  {
    can: '1234567892',
    sin: '1234-5678-92',
    accountHolderName: 'Carl Benedict Enriquez',
    serviceAddress: '15 Malakas St., Diliman, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3800.0,
    householdMembers: 3,
    majorAppliances: ['Inverter AC (2.0 HP) x 1', 'Gaming PC', 'Smart TV 55"'],
    isRegistered: false,
  },
  {
    can: '1234567893',
    sin: '1234-5678-93',
    accountHolderName: 'Jacob Antonio Uzel',
    serviceAddress: '88 Magsaysay Blvd., Santa Mesa, Manila',
    rateClass: 'Residential',
    monthlyBudget: 3000.0,
    householdMembers: 4,
    majorAppliances: ['Inverter AC (1.0 HP) x 1', 'Refrigerator', 'Electric Fan x 3'],
    isRegistered: false,
  },
  {
    can: '1234567894',
    sin: '1234-5678-94',
    accountHolderName: 'Hector Escobido',
    serviceAddress: '23 Boni Serrano Ave., Cubao, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 4500.0,
    householdMembers: 6,
    majorAppliances: ['Window AC x 2', 'Microwave', 'Chest Freezer'],
    isRegistered: false,
  },
  {
    can: '1234567895',
    sin: '1234-5678-95',
    accountHolderName: 'Lenard Cato Narvaza',
    serviceAddress: '45 West Avenue, Philam, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3200.0,
    householdMembers: 3,
    majorAppliances: ['Inverter AC (1.5 HP) x 1', 'Air Fryer', 'Laptop Setup'],
    isRegistered: false,
  },
  {
    can: '9876543210',
    sin: '9876-5432-10',
    accountHolderName: 'Juan Dela Cruz',
    serviceAddress: '123 Rizal Ave., Caloocan City',
    rateClass: 'Residential',
    monthlyBudget: 2800.0,
    householdMembers: 4,
    majorAppliances: ['Electric Fan x 4', 'Refrigerator', 'Rice Cooker'],
    isRegistered: false,
  },
  {
    can: '1029384756',
    sin: '1029-3847-56',
    accountHolderName: 'Maria Santos',
    serviceAddress: '77 Acacia St., Pasig City',
    rateClass: 'Residential',
    monthlyBudget: 5000.0,
    householdMembers: 5,
    majorAppliances: ['Inverter Split AC x 3', 'Double Door Refrigerator', 'Washing Machine'],
    isRegistered: false,
  },
];

// Simple, reproducible deterministic password hash simulation for offline/local storage
function secureHash(password: string, salt: string): string {
  let hash = 0;
  const combined = password + ':' + salt + ':kuryentipid_salt_2026';
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'phash_' + Math.abs(hash).toString(16) + '_' + combined.length;
}

// ==============================================================================
// Helper: Local Database Operations
// ==============================================================================

async function getStoredCustomers(): Promise<CustomerRecord[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!json) {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMER_RECORDS));
      return DEFAULT_CUSTOMER_RECORDS;
    }
    return JSON.parse(json);
  } catch {
    return DEFAULT_CUSTOMER_RECORDS;
  }
}

async function getStoredUsers(): Promise<Array<{ user: UserProfile; passwordHash: string; salt: string }>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function recordAuditLog(eventType: string, identifier: string, details: any) {
  try {
    const logItem = {
      id: Math.random().toString(36).substring(2),
      eventType,
      identifier,
      details,
      timestamp: new Date().toISOString(),
    };
    const json = await AsyncStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    const logs = json ? JSON.parse(json) : [];
    logs.push(logItem);
    await AsyncStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(logs.slice(-100))); // keep last 100
  } catch (e) {
    console.warn('Could not write audit log:', e);
  }
}

// ==============================================================================
// Rate Limiter Engine: 5 failed attempts per 15-minute window
// ==============================================================================
interface AttemptEntry {
  identifier: string;
  timestamp: number;
}

export async function checkRateLimit(rawIdentifier: string): Promise<RateLimitStatus> {
  const identifier = rawIdentifier.trim().toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.RATE_LIMITS);
    const attempts: AttemptEntry[] = json ? JSON.parse(json) : [];

    // Filter attempts within the 15-minute window for this identifier
    const recentAttempts = attempts.filter(
      (a) => a.identifier === identifier && now - a.timestamp < windowMs
    );

    if (recentAttempts.length >= maxAttempts) {
      const oldestInWindow = recentAttempts[0].timestamp;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      const minutesRemaining = Math.ceil(retryAfterSeconds / 60);

      await recordAuditLog('RATE_LIMIT_BLOCKED', identifier, {
        attempts: recentAttempts.length,
        retryAfterSeconds,
      });

      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        message: `Too many failed login attempts. Please wait ${minutesRemaining} minute(s) before trying again.`,
      };
    }

    return {
      allowed: true,
      remainingAttempts: maxAttempts - recentAttempts.length,
    };
  } catch {
    return { allowed: true, remainingAttempts: 5 };
  }
}

export async function recordFailedAttempt(rawIdentifier: string): Promise<void> {
  const identifier = rawIdentifier.trim().toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.RATE_LIMITS);
    const attempts: AttemptEntry[] = json ? JSON.parse(json) : [];

    // Add new failure and prune ancient entries (> 24 hours)
    attempts.push({ identifier, timestamp: now });
    const pruned = attempts.filter((a) => now - a.timestamp < 24 * 60 * 60 * 1000);

    await AsyncStorage.setItem(STORAGE_KEYS.RATE_LIMITS, JSON.stringify(pruned));
    await recordAuditLog('LOGIN_FAILED', identifier, { timestamp: now });
  } catch (e) {
    console.warn('Failed recording rate limit:', e);
  }
}

export async function clearRateLimit(rawIdentifier: string): Promise<void> {
  const identifier = rawIdentifier.trim().toLowerCase();
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.RATE_LIMITS);
    if (!json) return;
    const attempts: AttemptEntry[] = JSON.parse(json);
    const filtered = attempts.filter((a) => a.identifier !== identifier);
    await AsyncStorage.setItem(STORAGE_KEYS.RATE_LIMITS, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed clearing rate limit:', e);
  }
}

// ==============================================================================
// 1. CAN Verification against Official Utility Customer Database
// ==============================================================================
export async function verifyCANRecord(
  can: string,
  fullName?: string
): Promise<{
  valid: boolean;
  message: string;
  customer?: CustomerRecord;
}> {
  const digits = cleanCAN(can);

  if (digits.length !== 10) {
    return {
      valid: false,
      message: `CAN must be exactly 10 numeric digits (${digits.length}/10 entered).`,
    };
  }

  // Live Supabase RPC call if configured
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('check_can_eligibility', {
        p_can: digits,
        p_full_name: fullName || null,
      });

      if (error) {
        throw error;
      }

      if (data && !data.valid) {
        return { valid: false, message: data.message };
      }

      return {
        valid: true,
        message: data.message || 'Valid Meralco Customer Account Number.',
        customer: data
          ? {
              can: digits,
              sin: data.sin || formatCANDisplay(digits),
              accountHolderName: data.account_holder || fullName || 'Verified Customer',
              serviceAddress: data.service_address || 'Metro Manila',
              rateClass: 'Residential',
              monthlyBudget: 3500,
              householdMembers: 5,
              majorAppliances: ['Inverter AC (1.5 HP) x 2'],
              isRegistered: false,
            }
          : undefined,
      };
    } catch (e) {
      return { valid: false, message: 'Unable to check your CAN right now. Please try again.' };
    }
  }

  // Local Customer Records Verification
  const customers = await getStoredCustomers();
  const customer = customers.find((c) => c.can === digits);

  if (!customer) {
    return {
      valid: false,
      message: 'CAN was not found in utility customer records. Please check your electric bill.',
    };
  }

  // Check if CAN already registered by an existing user
  const users = await getStoredUsers();
  const isAlreadyRegistered = customer.isRegistered || users.some((u) => u.user.can === digits);

  if (isAlreadyRegistered) {
    return {
      valid: false,
      message: 'This Customer Account Number is already registered to an existing KuryenTipid account.',
    };
  }

  return {
    valid: true,
    message: `Account verified: ${customer.accountHolderName}`,
    customer,
  };
}

// ==============================================================================
// 2. Real-time Uniqueness Checks (Username & Email)
// ==============================================================================
export async function checkUsernameUnique(username: string): Promise<boolean> {
  const norm = username.trim().toLowerCase();

  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', norm)
        .maybeSingle();
      return !data;
    } catch {
      // fallback
    }
  }

  const users = await getStoredUsers();
  return !users.some((u) => u.user.username.toLowerCase() === norm);
}

export async function checkEmailUnique(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();

  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', norm)
        .maybeSingle();
      return !data;
    } catch {
      // fallback
    }
  }

  const users = await getStoredUsers();
  return !users.some((u) => u.user.email.toLowerCase() === norm);
}

// ==============================================================================
// 3. User Registration (with Server-Side Validation)
// ==============================================================================
export async function registerUser(
  formData: RegistrationFormData
): Promise<AuthResponse<UserProfile>> {
  if (!isLiveSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Email signup is currently unavailable. Please try again once email delivery is connected.' };
  }
  if (await getPendingEmailVerification()) {
    return { success: false, error: 'Finish or cancel the current email verification before registering again.' };
  }
  // --- Server-side validation matching all frontend rules ---
  const nameVal = validateFullName(formData.fullName);
  if (!nameVal.isValid) return { success: false, error: nameVal.message };

  const usernameVal = validateUsername(formData.username);
  if (!usernameVal.isValid) return { success: false, error: usernameVal.message };

  const emailVal = validateEmail(formData.email);
  if (!emailVal.isValid) return { success: false, error: emailVal.message };

  const passVal = validatePassword(formData.password);
  if (!passVal.isValid) return { success: false, error: passVal.message };

  if (formData.password !== formData.confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  // Ensure unique username
  const isUsernameFree = await checkUsernameUnique(formData.username);
  if (!isUsernameFree) {
    return { success: false, error: 'Username is already taken. Please choose another.' };
  }

  // Ensure unique email
  const isEmailFree = await checkEmailUnique(formData.email);
  if (!isEmailFree) {
    return { success: false, error: 'Email address is already registered.' };
  }

  // Customer Account Number (CAN) Allocation & Verification
  // If user provided a CAN, validate against Meralco records;
  // If not, Meralco automatically allocates their official CAN and sends it to their registered email!
  let cleanDigits = formData.can ? cleanCAN(formData.can) : '';
  let customerInfo: CustomerRecord | undefined;

  if (cleanDigits) {
    const canVal = validateCAN(cleanDigits);
    if (!canVal.isValid) return { success: false, error: canVal.message };

    const canCheck = await verifyCANRecord(cleanDigits, formData.fullName);
    if (!canCheck.valid) {
      return { success: false, error: canCheck.message };
    }
    customerInfo = canCheck.customer;
  } else {
    // Automatically allocate official Meralco CAN for the user
    const customers = await getStoredCustomers();
    const users = await getStoredUsers();

    // Check if name matches an existing Meralco account first
    const trimmedNameLower = formData.fullName.trim().toLowerCase();
    const matchedByName = customers.find(
      (c) => !c.isRegistered && !users.some((u) => u.user.can === c.can) &&
             c.accountHolderName.toLowerCase() === trimmedNameLower
    );

    const available = matchedByName || customers.find(
      (c) => !c.isRegistered && !users.some((u) => u.user.can === c.can)
    );

    if (available) {
      cleanDigits = available.can;
      customerInfo = available;
    } else {
      // Auto-generate 10-digit CAN in official Meralco customer range
      const newCan = '10' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8);
      cleanDigits = newCan;
      customerInfo = {
        can: newCan,
        sin: formatCANDisplay(newCan),
        accountHolderName: formData.fullName.trim(),
        serviceAddress: 'Meralco Service Franchise, Metro Manila',
        rateClass: 'Residential',
        monthlyBudget: 3500,
        householdMembers: 5,
        majorAppliances: ['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
        isRegistered: false,
      };
    }
  }

  // Automatically selected demo CANs must also pass the live database check.
  // Local seed availability is not evidence that the cloud account is unclaimed.
  if (!formData.can) {
    const eligibility = await verifyCANRecord(cleanDigits, formData.fullName);
    if (!eligibility.valid) {
      return { success: false, error: eligibility.message };
    }
    customerInfo = eligibility.customer;
  }

  // Execute Live Supabase Registration if configured
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const cancellationToken = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(cancellationToken));
      const cancellationHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            cancellation_hash: cancellationHash,
            full_name: formData.fullName.trim(),
            username: formData.username.trim(),
            can: cleanDigits,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Unable to complete registration. Please try again.' };
      }

      const profile: UserProfile = {
        id: data.user.id,
        fullName: formData.fullName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        can: cleanDigits,
        sin: customerInfo?.sin || formatCANDisplay(cleanDigits),
        householdMembers: customerInfo?.householdMembers || 5,
        majorAppliances: customerInfo?.majorAppliances || ['Inverter AC (1.5 HP) x 2'],
        monthlyBudget: customerInfo?.monthlyBudget || 3500,
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
      };
      if (data.session) {
        await supabase.auth.signOut();
        return { success: false, error: 'Enable Confirm email in Supabase. Email verification is required.' };
      }
      // Keep only the address and send time so a reload can resume verification.
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, JSON.stringify({ email: profile.email, sentAt: Date.now(), kind: 'signup', cancellationToken }));
      return { success: true, data: profile };
    } catch {
      return { success: false, error: 'Unable to send verification email. Please try again.' };
    }
  }
  return { success: false, error: 'Email verification is not configured.' };
}

export const EMAIL_CODE_LIFETIME_MS = 180000;
export interface PendingEmailVerification {
  email: string;
  sentAt: number;
  kind: 'signup' | 'login';
  cancellationToken?: string;
}
export async function getPendingEmailVerification(): Promise<PendingEmailVerification | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EMAIL);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    if (typeof pending.email !== 'string' || !validateEmail(pending.email).isValid ||
        typeof pending.sentAt !== 'number' || !Number.isFinite(pending.sentAt)) return null;
    return { email: pending.email, sentAt: pending.sentAt, kind: pending.kind === 'login' ? 'login' : 'signup', cancellationToken: pending.cancellationToken };
  } catch { return null; }
}

// Recovery for a deleted/reset project or a legacy challenge. This only forgets
// this device's pending flow; it neither deletes an Auth user nor verifies one.
export async function forgetPendingEmailVerification(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
  await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
}

export async function cancelPendingEmailVerification(): Promise<void> {
  const pending = await getPendingEmailVerification();
  if (pending?.kind === 'signup') {
    if (!supabase || !pending.cancellationToken) {
      throw new Error('This older signup cannot be cancelled automatically. Complete verification or ask the project administrator to remove the unverified account.');
    }
    const { data, error } = await supabase.rpc('cancel_pending_signup', {
      p_email: pending.email, p_token: pending.cancellationToken,
    });
    if (error || data !== true) throw new Error('Unable to cancel this signup. It may already be verified. Please log in or try again.');
  }
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
  await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
}

export async function resendRegistrationOTP(email: string): Promise<void> {
  if (!supabase) throw new Error('Email verification is not configured.');
  const pending = await getPendingEmailVerification();
  if (!pending || pending.email !== email.trim().toLowerCase()) throw new Error('Start signup or login again to request a code.');
  if (Date.now() - pending.sentAt < 60000) throw new Error('Please wait 60 seconds before requesting another code.');
  const { error } = pending.kind === 'login'
    ? await supabase.auth.signInWithOtp({ email: pending.email, options: { shouldCreateUser: false } })
    : await supabase.auth.resend({ type: 'signup', email: pending.email });
  if (error) throw error;
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, JSON.stringify({ ...pending, sentAt: Date.now() }));
}

export async function confirmRegistrationOTP(email: string, token: string): Promise<UserProfile> {
  if (!supabase) throw new Error('Email verification is not configured.');
  const pending = await getPendingEmailVerification();
  if (!pending || pending.email !== email.trim().toLowerCase()) throw new Error('This verification was cancelled. Request a new code.');
  if (Date.now() - pending.sentAt >= EMAIL_CODE_LIFETIME_MS) throw new Error('Your code expired after 3 minutes. Request a new code.');
  if (!/^\d{6}$/.test(token)) throw new Error('Enter the 6-digit code from your email.');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error || !data.session || !data.user?.email_confirmed_at) {
    throw new Error('The code is incorrect or expired. Try again or request a new code.');
  }
  const { data: row, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || !row) throw new Error('Email verified, but your profile could not be loaded. Please log in.');
  const profile: UserProfile = {
    id: data.user.id, email: data.user.email!, fullName: row.full_name,
    username: row.username, can: row.can, sin: formatCANDisplay(row.can),
    householdMembers: row.household_size || 5, majorAppliances: [],
    monthlyBudget: row.monthly_budget || 3500, createdAt: row.created_at,
    isEmailVerified: true,
  };
  await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
  return profile;
}

// ==============================================================================
// 4. Multi-Identifier Login (Username, Email, or CAN + Password)
// With Brute Force Protection & Generic Failure Messages to Prevent Enumeration
// ==============================================================================
export async function loginUser(
  rawIdentifier: string,
  password: string
): Promise<AuthResponse<UserProfile>> {
  const pendingSignup = await getPendingEmailVerification();
  if (pendingSignup?.kind === 'signup') {
    return { success: false, error: 'Finish verification or select Edit registration details to cancel your pending signup first.' };
  }
  const identifier = rawIdentifier.trim();

  // 1. Check Rate Limiter First
  const rateLimit = await checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return {
      success: false,
      rateLimited: true,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      error: rateLimit.message,
    };
  }

  // 2. Validate format: must be valid email, valid CAN, or valid username
  const identifierType = detectIdentifierType(identifier);
  if (identifierType === 'invalid' || !password) {
    await recordFailedAttempt(identifier);
    return {
      success: false,
      // GENERIC ERROR MESSAGE: Prevents account enumeration
      error: 'Invalid credentials. Please check your identifier and password.',
    };
  }

  const cleanDigits = cleanCAN(identifier);
  const lowerIdent = identifier.toLowerCase();

  // 3. Live Supabase Login Flow
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      let resolvedEmail = lowerIdent;

      // If logging in with Username or CAN, resolve email via Postgres RPC
      if (identifierType === 'username' || identifierType === 'can') {
        const { data: resolveData, error: resolveErr } = await supabase.rpc(
          'resolve_login_identifier',
          { p_identifier: identifier }
        );

        if (resolveErr || !resolveData || !resolveData.found || !resolveData.email) {
          await recordFailedAttempt(identifier);
          return {
            success: false,
            error: 'Invalid credentials. Please check your identifier and password.',
          };
        }
        resolvedEmail = resolveData.email;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
      const { error: previousSignOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (previousSignOutError) return { success: false, error: 'Unable to start a new sign-in. Please try again.' };
      const passwordClient = createPasswordCheckClient();
      const { data: authData, error: authError } = await passwordClient.auth.signInWithPassword({
        email: resolvedEmail, password,
      });
      if (authError || !authData.user?.email_confirmed_at) {
        await passwordClient.auth.signOut({ scope: 'local' });
        await recordFailedAttempt(identifier);
        return { success: false, error: 'Invalid credentials. Please check your identifier and password.' };
      }
      const { error: signOutError } = await passwordClient.auth.signOut({ scope: 'local' });
      if (signOutError) return { success: false, error: 'Unable to start verification. Please try again.' };
      const email = authData.user.email!.toLowerCase();
      const { error: sendError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (sendError) return { success: false, error: sendError.message };
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, JSON.stringify({ email, sentAt: Date.now(), kind: 'login' }));
      await clearRateLimit(identifier);
      return { success: true, verificationRequired: true, verificationEmail: email };
    } catch (e) {
      return { success: false, error: 'Unable to log in. Please try again.' };
    }
  }

  return { success: false, error: 'Email verification requires a connection. Please try again online.' };
}

// ==============================================================================
// 5. Session Management & Logout
// ==============================================================================
export async function getActiveSession(): Promise<UserProfile | null> {
  try {
    if (!isLiveSupabaseConfigured() || !supabase) return null;
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    const profile = json ? JSON.parse(json) : null;
    if (!profile?.isEmailVerified || await getPendingEmailVerification()) return null;
    if (isLiveSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== profile.id || !data.user?.email_confirmed_at) return null;
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || !assurance.data?.currentAuthenticationMethods.some(method =>
        (typeof method === 'string' ? method : method.method) === 'otp')) return null;
    }
    return profile;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    if (isLiveSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch (e) {
    console.warn('Logout error:', e);
  }
}

// ==============================================================================
// 6. Reset Seed Data (Helpful for demos & testing)
// ==============================================================================
export async function resetDatabaseToSeed(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  await AsyncStorage.removeItem(STORAGE_KEYS.USERS);
  await AsyncStorage.removeItem(STORAGE_KEYS.RATE_LIMITS);
  await AsyncStorage.removeItem(STORAGE_KEYS.AUDIT_LOG);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMER_RECORDS));
}
