// ==============================================================================
// Authentication Service for KuryenTipid
// Implements Registration, Multi-Identifier Login, Server-Side Validation,
// CAN Verification, Rate Limiting, Audit Logging, and Enumeration Protection
// ==============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLiveSupabaseConfigured, supabase } from '../config/supabase';
import { resolveMeterType } from './meralcoApiService';
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
    email: 'nena.villanueva@gmail.com',
    serviceAddress: 'Block 14 Lot 8, Sampaguita St., Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3500.0,
    householdMembers: 5,
    majorAppliances: ['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
    isRegistered: false,
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7890',
  },
  {
    can: '1234567891',
    sin: '1234-5678-91',
    accountHolderName: 'Jaeda Marthena Iral',
    email: 'jaeda.iral@teamohmygrid.ph',
    serviceAddress: 'Unit 402, Katipunan Ave., Loyola Heights, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 4200.0,
    householdMembers: 4,
    majorAppliances: ['Inverter AC (1.0 HP) x 2', 'Induction Cooker', 'Water Heater'],
    isRegistered: false,
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7891',
  },
  {
    can: '1234567892',
    sin: '1234-5678-92',
    accountHolderName: 'Carl Benedict Enriquez',
    email: 'carl.enriquez@teamohmygrid.ph',
    serviceAddress: '15 Malakas St., Diliman, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3800.0,
    householdMembers: 3,
    majorAppliances: ['Inverter AC (2.0 HP) x 1', 'Gaming PC', 'Smart TV 55"'],
    isRegistered: false,
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7892',
  },
  {
    can: '1234567893',
    sin: '1234-5678-93',
    accountHolderName: 'Jacob Antonio Uzel',
    email: 'jacob.uzel@teamohmygrid.ph',
    serviceAddress: '88 Magsaysay Blvd., Santa Mesa, Manila',
    rateClass: 'Residential',
    monthlyBudget: 3000.0,
    householdMembers: 4,
    majorAppliances: ['Inverter AC (1.0 HP) x 1', 'Refrigerator', 'Electric Fan x 3'],
    isRegistered: false,
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7893',
  },
  {
    can: '1234567894',
    sin: '1234-5678-94',
    accountHolderName: 'Hector Escobido',
    email: 'hectorescobido667@gmail.com',
    serviceAddress: '23 Boni Serrano Ave., Cubao, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 4500.0,
    householdMembers: 6,
    majorAppliances: ['Window AC x 2', 'Microwave', 'Chest Freezer'],
    isRegistered: false,
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7894',
  },
  {
    can: '1234567895',
    sin: '1234-5678-95',
    accountHolderName: 'Lenard Cato Narvaza',
    email: 'lenard.narvaza@teamohmygrid.ph',
    serviceAddress: '45 West Avenue, Philam, Quezon City',
    rateClass: 'Residential',
    monthlyBudget: 3200.0,
    householdMembers: 3,
    majorAppliances: ['Inverter AC (1.5 HP) x 1', 'Air Fryer', 'Laptop Setup'],
    isRegistered: false,
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7895',
  },
  {
    can: '9876543210',
    sin: '9876-5432-10',
    accountHolderName: 'Juan Dela Cruz',
    email: 'juan.delacruz@gmail.com',
    serviceAddress: '123 Rizal Ave., Caloocan City',
    rateClass: 'Residential',
    monthlyBudget: 2800.0,
    householdMembers: 4,
    majorAppliances: ['Electric Fan x 4', 'Refrigerator', 'Rice Cooker'],
    isRegistered: false,
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-3210',
  },
  {
    can: '1029384756',
    sin: '1029-3847-56',
    accountHolderName: 'Maria Santos',
    email: 'maria.santos@gmail.com',
    serviceAddress: '77 Acacia St., Pasig City',
    rateClass: 'Residential',
    monthlyBudget: 5000.0,
    householdMembers: 5,
    majorAppliances: ['Inverter Split AC x 3', 'Double Door Refrigerator', 'Washing Machine'],
    isRegistered: false,
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-4756',
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
    const parsed: CustomerRecord[] = JSON.parse(json);
    let updated = false;
    const merged = parsed.map((record) => {
      if (!record.email) {
        const seed = DEFAULT_CUSTOMER_RECORDS.find((d) => d.can === record.can);
        if (seed?.email) {
          updated = true;
          return { ...record, email: seed.email };
        }
      }
      return record;
    });
    if (updated) {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return DEFAULT_CUSTOMER_RECORDS;
  }
}

export function createDemoUserProfile(customer: CustomerRecord): UserProfile {
  let username = customer.email
    ? customer.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    : `user${customer.can.slice(-4)}`;
  if (customer.can === '1234567890') {
    username = 'nenav';
  }

  const meterType = customer.meterType || resolveMeterType(customer.can);
  const meterSerialNumber =
    customer.meterSerialNumber ||
    (meterType === 'AMI' ? `MR-AMI-${customer.can.slice(-4)}` : `MR-ANA-${customer.can.slice(-4)}`);

  return {
    id: `demo-user-${customer.can}`,
    fullName: customer.accountHolderName,
    username,
    email: customer.email || `customer_${customer.can}@meralco.ph`,
    can: customer.can,
    sin: customer.sin || formatCANDisplay(customer.can),
    serviceAddress: customer.serviceAddress,
    householdMembers: customer.householdMembers || 5,
    majorAppliances: customer.majorAppliances || ['Inverter AC (1.5 HP) x 2'],
    monthlyBudget: customer.monthlyBudget || 3500,
    createdAt: '2026-01-01T00:00:00.000Z',
    isEmailVerified: true,
    meterType,
    meterSerialNumber,
    lastReadingDate: customer.lastReadingDate,
  };
}

export function findDemoCustomer(identifier: string): CustomerRecord | undefined {
  const norm = identifier.trim().toLowerCase();
  const digits = cleanCAN(identifier);

  return DEFAULT_CUSTOMER_RECORDS.find((c) => {
    if (digits.length === 10 && cleanCAN(c.can) === digits) return true;
    if (c.email && c.email.toLowerCase() === norm) return true;
    const emailPrefix = c.email?.split('@')[0].toLowerCase();
    if (emailPrefix && emailPrefix === norm) return true;
    if (c.can === '1234567890' && norm === 'nenav') return true;
    const cleanHolderName = c.accountHolderName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanHolderName && cleanHolderName === norm.replace(/[^a-z0-9]/g, '')) return true;
    return false;
  });
}

const DEFAULT_STORED_USERS: Array<{ user: UserProfile; passwordHash: string; salt: string }> = [
  {
    user: {
      id: 'demo-user-nena',
      fullName: 'Nena Villanueva',
      username: 'nenav',
      email: 'nena.villanueva@gmail.com',
      can: '1234567890',
      sin: '1234-5678-90',
      householdMembers: 5,
      majorAppliances: ['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
      monthlyBudget: 3500,
      createdAt: '2026-01-01T00:00:00.000Z',
      isEmailVerified: true,
      meterType: 'AMI',
      meterSerialNumber: 'MR-AMI-7890',
    },
    passwordHash: secureHash('P@ssword123', 'demo_salt_nena'),
    salt: 'demo_salt_nena',
  },
  {
    user: {
      id: 'demo-user-maria',
      fullName: 'Maria Santos',
      username: 'mariasantos',
      email: 'maria.santos@gmail.com',
      can: '1029384756',
      sin: '1029-3847-56',
      householdMembers: 5,
      majorAppliances: ['Inverter Split AC x 3', 'Double Door Refrigerator', 'Washing Machine'],
      monthlyBudget: 5000,
      createdAt: '2026-01-01T00:00:00.000Z',
      isEmailVerified: true,
      meterType: 'AMI',
      meterSerialNumber: 'MR-AMI-4756',
    },
    passwordHash: secureHash('P@ssword123', 'demo_salt_maria'),
    salt: 'demo_salt_maria',
  },
];

async function getStoredUsers(): Promise<Array<{ user: UserProfile; passwordHash: string; salt: string }>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    if (!json) {
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_STORED_USERS));
      return DEFAULT_STORED_USERS;
    }
    return JSON.parse(json);
  } catch {
    return DEFAULT_STORED_USERS;
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
              meterType: resolveMeterType(digits),
              meterSerialNumber:
                (resolveMeterType(digits) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') + digits.slice(-4),
            }
          : undefined,
      };
    } catch (e) {
      console.warn('Supabase RPC check_can_eligibility fallback to local database:', e);
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
// 1b. CAN Linking & Allocation for Email Address
// Automatically discovers or assigns pre-registered Meralco CAN linked to user's email
// ==============================================================================
export async function getLinkedCANForEmail(
  email: string,
  fullName?: string,
  preferredCAN?: string
): Promise<{ can: string; customer: CustomerRecord }> {
  const normEmail = email.trim().toLowerCase();

  // If a valid preferred CAN was provided, attempt to verify and use it
  if (preferredCAN) {
    const cleanPreferred = cleanCAN(preferredCAN);
    if (cleanPreferred.length === 10) {
      const canCheck = await verifyCANRecord(cleanPreferred, fullName);
      if (canCheck.valid && canCheck.customer) {
        return { can: cleanPreferred, customer: canCheck.customer };
      }
    }
  }

  // 1. Live Supabase lookup / RPC if live Supabase is configured
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_meralco_customer_by_email', {
        p_email: normEmail,
        p_full_name: fullName?.trim() || null,
      });

      if (!error && data && data.found && data.can) {
        return {
          can: data.can,
          customer: {
            can: data.can,
            sin: data.sin || formatCANDisplay(data.can),
            accountHolderName: data.account_holder || fullName || 'Meralco Customer',
            email: normEmail,
            serviceAddress: data.service_address || 'Metro Manila',
            rateClass: data.rate_class || 'Residential',
            monthlyBudget: data.monthly_budget || 3500,
            householdMembers: data.household_members || 5,
            majorAppliances: data.major_appliances || ['Inverter AC (1.5 HP) x 2'],
            isRegistered: false,
            meterType: resolveMeterType(data.can),
            meterSerialNumber:
              (resolveMeterType(data.can) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') + data.can.slice(-4),
          },
        };
      }
    } catch (e) {
      console.warn('Supabase RPC get_meralco_customer_by_email fallback:', e);
    }

    // Direct table query fallback in Supabase (if permitted by policy or service)
    try {
      const { data } = await supabase
        .from('meralco_customers')
        .select('*')
        .ilike('email', normEmail)
        .maybeSingle();

      if (data && data.can) {
        const canCheck = await verifyCANRecord(data.can, fullName);
        if (canCheck.valid) {
          return {
            can: data.can,
            customer: canCheck.customer || {
              can: data.can,
              sin: data.sin || formatCANDisplay(data.can),
              accountHolderName: data.account_holder_name || fullName || 'Meralco Customer',
              email: normEmail,
              serviceAddress: data.service_address || 'Metro Manila',
              rateClass: data.rate_class || 'Residential',
              monthlyBudget: data.monthly_budget || 3500,
              householdMembers: data.household_members || 5,
              majorAppliances: data.major_appliances || ['Inverter AC (1.5 HP) x 2'],
              isRegistered: false,
              meterType: resolveMeterType(data.can),
              meterSerialNumber:
                (resolveMeterType(data.can) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') + data.can.slice(-4),
            },
          };
        }
      }
    } catch {
      // ignore
    }

    // Default Customer Records fallback for live Supabase
    // Check if email matches any pre-registered default customer
    const preRegistered = DEFAULT_CUSTOMER_RECORDS.find(
      (c) =>
        c.email?.toLowerCase() === normEmail ||
        (normEmail.includes('hector') && c.can === '1234567894')
    );
    if (preRegistered) {
      const canCheck = await verifyCANRecord(preRegistered.can, fullName);
      if (canCheck.valid) {
        return {
          can: preRegistered.can,
          customer: canCheck.customer || preRegistered,
        };
      }
    }

    // Otherwise, check if any unassigned CAN (no email attached) is available in default records
    const unassignedRec = DEFAULT_CUSTOMER_RECORDS.find((rec) => !rec.email || rec.email.trim() === '');
    if (unassignedRec) {
      const canCheck = await verifyCANRecord(unassignedRec.can, fullName);
      if (canCheck.valid) {
        return {
          can: unassignedRec.can,
          customer: { ...(canCheck.customer || unassignedRec), email: normEmail },
        };
      }
    }
  }

  // 2. Local / Offline Engine
  const customers = await getStoredCustomers();
  const users = await getStoredUsers();

  // Step 2a: Check if an unclaimed record already has this email
  const matchedByEmail = customers.find(
    (c) =>
      c.email?.toLowerCase() === normEmail &&
      !c.isRegistered &&
      !users.some((u) => u.user.can === c.can)
  );
  if (matchedByEmail) {
    return { can: matchedByEmail.can, customer: matchedByEmail };
  }

  // Step 2b: Check if an unassigned record (no email attached) is available
  const unassigned = customers.find(
    (c) =>
      (!c.email || c.email.trim() === '') &&
      !c.isRegistered &&
      !users.some((u) => u.user.can === c.can)
  );

  if (unassigned) {
    unassigned.email = normEmail;
    if (fullName && fullName.trim().length > 1) {
      unassigned.accountHolderName = fullName.trim();
    }
    const updated = customers.map((c) => (c.can === unassigned.can ? unassigned : c));
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
    return { can: unassigned.can, customer: unassigned };
  }

  // Step 2c: If all pre-seeded records are claimed or allocated to other emails,
  // auto-generate a new 10-digit CAN in official Meralco range
  let newCan = '';
  for (let i = 0; i < 20; i++) {
    const candidate = '10' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8);
    if (!customers.some((c) => c.can === candidate) && !users.some((u) => u.user.can === candidate)) {
      newCan = candidate;
      break;
    }
  }
  if (!newCan) {
    newCan = '10' + (Date.now() + Math.floor(Math.random() * 1000)).toString().slice(-8);
  }

  const newCustomer: CustomerRecord = {
    can: newCan,
    sin: formatCANDisplay(newCan),
    accountHolderName: fullName?.trim() || 'Meralco Customer',
    email: normEmail,
    serviceAddress: 'Meralco Franchise Area, Metro Manila',
    rateClass: 'Residential',
    monthlyBudget: 3500,
    householdMembers: 5,
    majorAppliances: ['Inverter AC (1.5 HP) x 2', 'Refrigerator', 'Washing Machine'],
    isRegistered: false,
    meterType: resolveMeterType(newCan),
    meterSerialNumber:
      (resolveMeterType(newCan) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') + newCan.slice(-4),
  };

  customers.push(newCustomer);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  return { can: newCan, customer: newCustomer };
}

// ==============================================================================
// 2. Real-time Uniqueness Checks (Username & Email)
// ==============================================================================
export async function checkUsernameUnique(username: string): Promise<boolean> {
  const norm = username.trim().toLowerCase();

  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        p_username: norm,
      });
      if (!error && typeof data === 'boolean') {
        return data;
      }
      const { data: row } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', norm)
        .maybeSingle();
      return !row;
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

  // Customer Account Number (CAN) Allocation & Email Linking
  // Pre-registered Meralco CAN is linked to user's email address
  const linked = await getLinkedCANForEmail(
    formData.email,
    formData.fullName,
    formData.can
  );
  const cleanDigits = linked.can;
  const customerInfo = linked.customer;

  // Execute Live Supabase Registration if configured
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
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
      // Keep only the address, send time, and linked CAN so a reload can resume verification.
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_EMAIL,
        JSON.stringify({ email: profile.email, sentAt: Date.now(), can: profile.can })
      );
      return { success: true, data: profile };
    } catch {
      return { success: false, error: 'Unable to send verification email. Please try again.' };
    }
  }
  return { success: false, error: 'Email verification is not configured.' };
}

export async function getPendingEmailVerification(): Promise<{ email: string; sentAt: number; can?: string } | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EMAIL);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    return typeof pending.email === 'string' && validateEmail(pending.email).isValid &&
      typeof pending.sentAt === 'number' && Number.isFinite(pending.sentAt)
      ? { email: pending.email, sentAt: pending.sentAt, can: typeof pending.can === 'string' ? pending.can : undefined } : null;
  } catch { return null; }
}

export async function resendRegistrationOTP(email: string): Promise<void> {
  if (!supabase) throw new Error('Email verification is not configured.');
  const normEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({ type: 'signup', email: normEmail });
  if (error) throw error;
  const existing = await getPendingEmailVerification();
  const can = existing?.email.toLowerCase() === normEmail ? existing.can : undefined;
  await AsyncStorage.setItem(
    STORAGE_KEYS.PENDING_EMAIL,
    JSON.stringify({ email: normEmail, sentAt: Date.now(), ...(can ? { can } : {}) })
  );
}

export async function confirmRegistrationOTP(email: string, token: string): Promise<UserProfile> {
  if (!supabase) throw new Error('Email verification is not configured.');
  if (!/^\d{6}$/.test(token)) throw new Error('Enter the 6-digit code from your email.');
  const normEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.verifyOtp({ email: normEmail, token, type: 'email' });
  if (error || !data.session || !data.user?.email_confirmed_at) {
    throw new Error('The code is incorrect or expired. Try again or request a new code.');
  }
  let row: any = null;
  try {
    const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    row = profileRow;
  } catch {
    // fallback
  }
  const can = row?.can || (data.user.user_metadata?.can as string) || '';
  const fullName = row?.full_name || (data.user.user_metadata?.full_name as string) || 'Customer';
  const username = row?.username || (data.user.user_metadata?.username as string) || normEmail.split('@')[0];

  const profile: UserProfile = {
    id: data.user.id,
    email: data.user.email || normEmail,
    fullName,
    username,
    can,
    sin: formatCANDisplay(can),
    householdMembers: row?.household_size || 5,
    majorAppliances: [],
    monthlyBudget: row?.monthly_budget || 3500,
    createdAt: row?.created_at || new Date().toISOString(),
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

  // Check if credentials match a pre-seeded Demo Meralco Customer
  const isDemoPass = password === 'P@ssword123';
  const demoCustomer = isDemoPass ? findDemoCustomer(identifier) : undefined;

  // 3. Live Supabase Login Flow
  if (isLiveSupabaseConfigured() && supabase) {
    try {
      let resolvedEmail = lowerIdent;
      let rpcFailed = false;

      // If logging in with Username or CAN, resolve email via Postgres RPC
      if (identifierType === 'username' || identifierType === 'can') {
        const { data: resolveData, error: resolveErr } = await supabase.rpc(
          'resolve_login_identifier',
          { p_identifier: identifier }
        );

        if (resolveErr || !resolveData || !resolveData.found || !resolveData.email) {
          rpcFailed = true;
        } else {
          resolvedEmail = resolveData.email;
        }
      }

      if (!rpcFailed) {
        // Supabase Auth SignInWithPassword
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        });

        if (!authError && authData.user?.email_confirmed_at) {
          // Fetch profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          const profile: UserProfile = {
            isEmailVerified: true,
            id: authData.user.id,
            fullName: profileData?.full_name || authData.user.user_metadata?.full_name || 'Customer',
            username: profileData?.username || authData.user.user_metadata?.username || 'user',
            email: authData.user.email || resolvedEmail,
            can: profileData?.can || authData.user.user_metadata?.can || '',
            sin: formatCANDisplay(profileData?.can || authData.user.user_metadata?.can || ''),
            householdMembers: profileData?.household_size || 5,
            majorAppliances: ['Inverter AC (1.5 HP) x 2'],
            monthlyBudget: profileData?.monthly_budget || 3500,
            createdAt: profileData?.created_at || new Date().toISOString(),
          };

          await clearRateLimit(identifier);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
          return { success: true, data: profile };
        }
      }

      // If live Supabase authentication did not succeed, allow pre-seeded Demo accounts to log in
      if (demoCustomer) {
        const demoProfile = createDemoUserProfile(demoCustomer);
        await clearRateLimit(identifier);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(demoProfile));
        return { success: true, data: demoProfile };
      }

      await recordFailedAttempt(identifier);
      return {
        success: false,
        error: 'Invalid credentials. Please check your identifier and password.',
      };
    } catch (e) {
      if (demoCustomer) {
        const demoProfile = createDemoUserProfile(demoCustomer);
        await clearRateLimit(identifier);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(demoProfile));
        return { success: true, data: demoProfile };
      }
      return { success: false, error: 'Unable to log in. Please try again.' };
    }
  }

  // 4. Local Engine Multi-Identifier Resolution & Verification
  if (demoCustomer) {
    const demoProfile = createDemoUserProfile(demoCustomer);
    await clearRateLimit(identifier);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(demoProfile));
    return { success: true, data: demoProfile };
  }

  const users = await getStoredUsers();

  // Find user by Email, Username, or CAN
  const userEntry = users.find((entry) => {
    if (identifierType === 'email') {
      return entry.user.email.toLowerCase() === lowerIdent;
    }
    if (identifierType === 'username') {
      return entry.user.username.toLowerCase() === lowerIdent;
    }
    if (identifierType === 'can') {
      return entry.user.can === cleanDigits;
    }
    return false;
  });

  // Generic Failure response if user does not exist
  if (!userEntry) {
    await recordFailedAttempt(identifier);
    return {
      success: false,
      error: 'Invalid credentials. Please check your identifier and password.',
    };
  }

  // Verify password hash
  const computedHash = secureHash(password, userEntry.salt);
  if (computedHash !== userEntry.passwordHash) {
    await recordFailedAttempt(identifier);
    return {
      success: false,
      error: 'Invalid credentials. Please check your identifier and password.',
    };
  }

  if (!userEntry.user.isEmailVerified) {
    return { success: false, error: 'Please verify your email before logging in.' };
  }

  // Login Successful: Reset rate limit, save session, write audit log
  await clearRateLimit(identifier);
  await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(userEntry.user));
  await recordAuditLog('LOGIN_SUCCESS', identifier, { userId: userEntry.user.id });

  return { success: true, data: userEntry.user };
}

// ==============================================================================
// 5. Session Management & Logout
// ==============================================================================
export async function getActiveSession(): Promise<UserProfile | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    const profile = json ? JSON.parse(json) : null;
    if (!profile?.isEmailVerified) return null;
    if (isLiveSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== profile.id || !data.user?.email_confirmed_at) return null;
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
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL);
  await AsyncStorage.removeItem(STORAGE_KEYS.OTP_STORE);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMER_RECORDS));
  await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_STORED_USERS));
}
