jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  verifyCANRecord,
  getLinkedCANForEmail,
  getPendingEmailVerification,
  checkUsernameUnique,
  checkEmailUnique,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  loginUser,
  getActiveSession,
  logoutUser,
  resetDatabaseToSeed,
  DEFAULT_CUSTOMER_RECORDS,
} from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatCANDisplay } from '../../utils/validation';

describe('Security & Auth Integration Tests', () => {
  beforeEach(async () => {
    await resetDatabaseToSeed();
  });

  describe('1. CAN Verification against Meralco Utility Database', () => {
    it('verifies an unregistered valid pre-seeded Meralco CAN', async () => {
      const result = await verifyCANRecord('1234567891');
      expect(result.valid).toBe(true);
      expect(result.customer?.accountHolderName).toBe('Jaeda Marthena Iral');
      expect(result.customer?.can).toBe('1234567891');
    });

    it('rejects a CAN that is already registered by an existing user', async () => {
      const result = await verifyCANRecord('1234567890');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('already registered');
    });

    it('rejects a CAN not present in utility records', async () => {
      const result = await verifyCANRecord('9999999999');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('CAN was not found');
    });

    it('rejects a CAN with invalid digit count', async () => {
      const result = await verifyCANRecord('123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('10 numeric digits');
    });
  });

  describe('2. Uniqueness Checks', () => {
    it('verifies available and taken usernames', async () => {
      const isFree = await checkUsernameUnique('brand_new_user_2026');
      expect(isFree).toBe(true);
    });

    it('verifies available and taken emails', async () => {
      const isFree = await checkEmailUnique('new.resident@example.com');
      expect(isFree).toBe(true);
    });
  });

  describe('3. Multi-Identifier Login (Local / Demo Engine)', () => {
    it('logs in successfully using pre-seeded CAN and password', async () => {
      const res = await loginUser('1234567890', 'P@ssword123');
      expect(res.success).toBe(true);
      expect(res.data?.fullName).toBe('Nena Villanueva');
      expect(res.data?.can).toBe('1234567890');
    });

    it('logs in successfully using pre-seeded Username and password', async () => {
      const res = await loginUser('nenav', 'P@ssword123');
      expect(res.success).toBe(true);
      expect(res.data?.fullName).toBe('Nena Villanueva');
    });

    it('logs in successfully using pre-seeded Email and password', async () => {
      const res = await loginUser('nena.villanueva@gmail.com', 'P@ssword123');
      expect(res.success).toBe(true);
      expect(res.data?.fullName).toBe('Nena Villanueva');
    });

    it('logs in successfully using formatted CAN with hyphens', async () => {
      const res = await loginUser('1234-5678-90', 'P@ssword123');
      expect(res.success).toBe(true);
      expect(res.data?.fullName).toBe('Nena Villanueva');
    });

    it('logs in successfully with any pre-seeded demo account from DEFAULT_CUSTOMER_RECORDS (Quick Fill)', async () => {
      // Test Jaeda Marthena Iral via CAN
      const resJaeda = await loginUser('1234567891', 'P@ssword123');
      expect(resJaeda.success).toBe(true);
      expect(resJaeda.data?.fullName).toBe('Jaeda Marthena Iral');
      expect(resJaeda.data?.can).toBe('1234567891');

      // Test Carl Benedict Enriquez via Email
      const resCarl = await loginUser('carl.enriquez@teamohmygrid.ph', 'P@ssword123');
      expect(resCarl.success).toBe(true);
      expect(resCarl.data?.fullName).toBe('Carl Benedict Enriquez');
      expect(resCarl.data?.monthlyBudget).toBe(3800);

      // Test Hector Escobido via CAN
      const resHector = await loginUser('1234-5678-94', 'P@ssword123');
      expect(resHector.success).toBe(true);
      expect(resHector.data?.fullName).toBe('Hector Escobido');

      // Test Maria Santos via CAN
      const resMaria = await loginUser('1029384756', 'P@ssword123');
      expect(resMaria.success).toBe(true);
      expect(resMaria.data?.fullName).toBe('Maria Santos');
    });
  });

  describe('4. Account Enumeration Defense', () => {
    const GENERIC_MSG = 'Invalid credentials. Please check your identifier and password.';

    it('returns generic error for wrong password', async () => {
      const res = await loginUser('nenav', 'WrongPassword123');
      expect(res.success).toBe(false);
      expect(res.error).toBe(GENERIC_MSG);
    });

    it('returns EXACT same generic error for non-existent username', async () => {
      const res = await loginUser('nonexistentuser999', 'P@ssword123');
      expect(res.success).toBe(false);
      expect(res.error).toBe(GENERIC_MSG);
    });

    it('returns EXACT same generic error for non-existent CAN', async () => {
      const res = await loginUser('9999999999', 'P@ssword123');
      expect(res.success).toBe(false);
      expect(res.error).toBe(GENERIC_MSG);
    });
  });

  describe('5. Rate Limiting & Brute-Force Attack Protection', () => {
    it('enforces lockout after 5 consecutive failed attempts', async () => {
      const target = 'attacker_test_user';

      // 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        const res = await loginUser(target, `WrongPass${i}`);
        expect(res.success).toBe(false);
      }

      // 6th attempt should be blocked
      const blocked = await loginUser(target, 'AnyPasswordNow');
      expect(blocked.success).toBe(false);
      expect(blocked.rateLimited).toBe(true);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.error).toContain('Too many failed login attempts');
    });

    it('clears rate limit when reset', async () => {
      const target = 'reset_user_test';
      await recordFailedAttempt(target);
      await clearRateLimit(target);
      const status = await checkRateLimit(target);
      expect(status.allowed).toBe(true);
      expect(status.remainingAttempts).toBe(5);
    });
  });

  describe('6. Active Session & Logout', () => {
    it('stores active session and clears on logout', async () => {
      await loginUser('1234567890', 'P@ssword123');
      const session = await getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.can).toBe('1234567890');

      await logoutUser();
      const afterLogout = await getActiveSession();
      expect(afterLogout).toBeNull();
    });
  });

  describe('7. Pre-registered Email-to-CAN Linking for Meralco Utility Database', () => {
    it('associates all pre-seeded Meralco utility customer records with valid email addresses', () => {
      DEFAULT_CUSTOMER_RECORDS.forEach((record) => {
        expect(record.email).toBeDefined();
        expect(record.email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      });
    });

    it('returns the linked Meralco CAN for a pre-registered email', async () => {
      const linked = await getLinkedCANForEmail('jaeda.iral@teamohmygrid.ph', 'Jaeda Marthena Iral');
      expect(linked.can).toBe('1234567891');
      expect(linked.customer.accountHolderName).toBe('Jaeda Marthena Iral');
      expect(linked.customer.email).toBe('jaeda.iral@teamohmygrid.ph');
    });

    it('matches pre-registered email case-insensitively and handles whitespace', async () => {
      const linked = await getLinkedCANForEmail('   CARL.ENRIQUEZ@TEAMOHMYGRID.PH   ');
      expect(linked.can).toBe('1234567892');
      expect(linked.customer.accountHolderName).toBe('Carl Benedict Enriquez');
    });

    it('verifies and returns an explicitly provided preferred CAN when valid', async () => {
      const linked = await getLinkedCANForEmail('custom.user@example.com', 'Jaeda Marthena Iral', '1234567891');
      expect(linked.can).toBe('1234567891');
    });

    it('seamlessly assigns an available Meralco CAN for a new/custom unregistered email', async () => {
      const linked = await getLinkedCANForEmail('new.customer@gmail.com', 'New Customer');
      expect(linked.can).toBeDefined();
      expect(linked.can).toHaveLength(10);
      expect(linked.customer.email).toBe('new.customer@gmail.com');
    });

    it('generates a valid 10-digit CAN in official Meralco range when all records are exhausted', async () => {
      const results: string[] = [];
      // Request 15 unique emails to exceed the 8 pre-seeded records
      for (let i = 0; i < 15; i++) {
        const res = await getLinkedCANForEmail(`resident${i}@example.com`, `Resident ${i}`);
        results.push(res.can);
        expect(res.can).toMatch(/^\d{10}$/);
      }
      // Each allocated CAN should be distinct
      const unique = new Set(results);
      expect(unique.size).toBe(15);
    });

    it('stores and recovers linked Meralco CAN in pending email verification', async () => {
      const email = 'resident.test@example.com';
      const can = '1234567891';
      await AsyncStorage.setItem(
        '@kuryentipid_pending_email_verification',
        JSON.stringify({ email, sentAt: Date.now(), can })
      );

      const pending = await getPendingEmailVerification();
      expect(pending).not.toBeNull();
      expect(pending?.email).toBe(email);
      expect(pending?.can).toBe(can);
      expect(formatCANDisplay(pending!.can!)).toBe('1234-5678-91');
    });

    it('does not steal or reassign another user pre-registered CAN when allocating for an unseeded email', async () => {
      // Allocate CAN for a new unseeded email
      const unseeded = await getLinkedCANForEmail('unseeded.resident@example.com', 'Unseeded Resident');
      expect(unseeded.can).toBeDefined();
      expect(unseeded.can).toHaveLength(10);
      // It must NOT steal Jaeda's pre-registered CAN (1234567891) or Nena's (1234567890)
      expect(unseeded.can).not.toBe('1234567891');
      expect(unseeded.can).not.toBe('1234567890');

      // Jaeda should still be linked to her own pre-registered CAN
      const jaeda = await getLinkedCANForEmail('jaeda.iral@teamohmygrid.ph', 'Jaeda Marthena Iral');
      expect(jaeda.can).toBe('1234567891');
      expect(jaeda.customer.accountHolderName).toBe('Jaeda Marthena Iral');
    });

    it('clears pending email verification state on resetDatabaseToSeed', async () => {
      await AsyncStorage.setItem(
        '@kuryentipid_pending_email_verification',
        JSON.stringify({ email: 'cleanup.test@example.com', sentAt: Date.now(), can: '1234567891' })
      );
      expect(await getPendingEmailVerification()).not.toBeNull();

      await resetDatabaseToSeed();
      expect(await getPendingEmailVerification()).toBeNull();
    });

    it('handles empty or undefined CAN gracefully in formatCANDisplay and cleanCAN without throwing', () => {
      expect(formatCANDisplay('')).toBe('');
      expect(formatCANDisplay(undefined as any)).toBe('');
      expect(formatCANDisplay('1234567890')).toBe('1234-5678-90');
    });
  });
});
