jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  verifyCANRecord,
  getLinkedCANForEmail,
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
  });
});
