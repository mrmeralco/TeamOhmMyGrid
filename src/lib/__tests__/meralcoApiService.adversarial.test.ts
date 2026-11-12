// ==============================================================================
// Adversarial Stress Testing Suite: Simulated Meralco API Service
// Challenger 1 (Milestone M1)
//
// Rigorous adversarial challenge verifying:
// 1. Seed Dictionary Override Immutability & Exhaustive Verification
// 2. Parity Generator Stress (200 random CANs, 100 even + 100 odd)
// 3. High-Entropy Input Fuzzing (Injection, Unicode, Formatting, Extreme Lengths)
// 4. Latency Accuracy, Promise Isolation & High-Concurrency Interleaving
// 5. Synchronous Fallback & Robust Error Boundaries
// ==============================================================================

import {
  classifyCAN,
  getStoredMeterDetails,
  resolveMeterType,
  determineMeterTypeByParity,
  createFallbackMeterDetails,
  MERALCO_SEED_ACCOUNTS,
  MeralcoMeterDetails,
} from '../../services/meralcoApiService';

describe('Adversarial Stress Test: Meralco API Service (M1 Challenger)', () => {
  // ----------------------------------------------------------------------------
  // SECTION 1: Exhaustive Pre-seeded Account Verification & Parity Overrides
  // ----------------------------------------------------------------------------
  describe('1. Seed Integrity & Parity Override Defense', () => {
    const seedKeys = Object.keys(MERALCO_SEED_ACCOUNTS);

    it('contains all required seed accounts specified in SCOPE.md', () => {
      const requiredCans = [
        '1234567890', // AMI (Nena)
        '1234567891', // AMI (Jaeda) - ODD digit override
        '1234567892', // AMI (Carl)
        '1029384756', // AMI (Maria Santos Bahay 10-digit)
        '019288234410', // AMI (Maria Santos Bahay 12-digit)
        '1234567893', // Analog (Jacob)
        '1234567894', // Analog (Hector) - EVEN digit override
        '1234567895', // Analog (Lenard)
        '9876543210', // Analog (Juan Dela Cruz) - EVEN digit override
        '028491023321', // Analog (Tindahan 12-digit)
        '034177895562', // Analog (Condo 12-digit) - EVEN digit override
      ];

      for (const can of requiredCans) {
        expect(MERALCO_SEED_ACCOUNTS[can]).toBeDefined();
      }
    });

    it('validates every single seed account in MERALCO_SEED_ACCOUNTS without exception', async () => {
      for (const can of seedKeys) {
        const expected = MERALCO_SEED_ACCOUNTS[can];
        const res = await classifyCAN(can, { simulatedDelayMs: 0 });

        expect(res.success).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(res.data).toBeDefined();
        expect(res.data?.meterType).toBe(expected.meterType);
        expect(res.data?.supportsIntervalTelemetry).toBe(expected.meterType === 'AMI');
        expect(res.data?.accountHolderName).toBe(expected.accountHolderName);
        expect(res.data?.meterSerialNumber).toBe(expected.meterSerialNumber);
        expect(res.data?.meterModel).toBe(expected.meterModel);
      }
    });

    it('rigorously tests all 4 parity-contradicting overrides (both async and sync)', async () => {
      // 1. Jaeda: terminal '1' (odd), but MUST be AMI
      const resJaeda = await classifyCAN('1234567891', { simulatedDelayMs: 0 });
      expect(resJaeda.data?.meterType).toBe('AMI');
      expect(resJaeda.data?.supportsIntervalTelemetry).toBe(true);
      expect(resolveMeterType('1234567891')).toBe('AMI');

      // 2. Hector: terminal '4' (even), but MUST be Analog
      const resHector = await classifyCAN('1234567894', { simulatedDelayMs: 0 });
      expect(resHector.data?.meterType).toBe('Analog');
      expect(resHector.data?.supportsIntervalTelemetry).toBe(false);
      expect(resolveMeterType('1234567894')).toBe('Analog');

      // 3. Juan Dela Cruz: terminal '0' (even), but MUST be Analog
      const resJuan = await classifyCAN('9876543210', { simulatedDelayMs: 0 });
      expect(resJuan.data?.meterType).toBe('Analog');
      expect(resJuan.data?.supportsIntervalTelemetry).toBe(false);
      expect(resolveMeterType('9876543210')).toBe('Analog');

      // 4. Maria Santos Condo: terminal '2' (even), but MUST be Analog
      const resCondo = await classifyCAN('0341-7789-5562', { simulatedDelayMs: 0 });
      expect(resCondo.data?.meterType).toBe('Analog');
      expect(resCondo.data?.supportsIntervalTelemetry).toBe(false);
      expect(resolveMeterType('034177895562')).toBe('Analog');
    });

    it('ensures mutation of response data does not corrupt internal seed records (immutability)', async () => {
      const res1 = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(res1.data?.meterType).toBe('AMI');

      // Attempt malicious mutation of returned object
      if (res1.data) {
        (res1.data as any).meterType = 'Analog';
        (res1.data as any).accountHolderName = 'HACKED';
      }

      // Re-query: internal dictionary must remain uncorrupted
      const res2 = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(res2.data?.meterType).toBe('AMI');
      expect(res2.data?.accountHolderName).toBe('Nena Villanueva');
      expect(MERALCO_SEED_ACCOUNTS['1234567890'].meterType).toBe('AMI');
      expect(MERALCO_SEED_ACCOUNTS['1234567890'].accountHolderName).toBe('Nena Villanueva');
    });
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: Parity Edge Cases & Random CAN Generation (Stress Harness)
  // ----------------------------------------------------------------------------
  describe('2. Parity Edge Cases & High-Volume Generator (200 CANs)', () => {
    // Generate pseudo-random unseeded CANs
    function generateRandomCan(lastDigit: number, length: 10 | 12 = 10): string {
      let prefix = '';
      // Ensure first digit is not 0 for normal variety, length-1 digits
      prefix += Math.floor(1 + Math.random() * 9).toString();
      for (let i = 1; i < length - 1; i++) {
        prefix += Math.floor(Math.random() * 10).toString();
      }
      return `${prefix}${lastDigit}`;
    }

    it('validates 100 randomly generated even-ending CANs strictly resolve to AMI', async () => {
      const evenDigits = [0, 2, 4, 6, 8];
      const testCans: string[] = [];

      for (let i = 0; i < 100; i++) {
        const lastDigit = evenDigits[i % evenDigits.length];
        const can = generateRandomCan(lastDigit, i % 2 === 0 ? 10 : 12);
        // Exclude seeded accounts
        if (!MERALCO_SEED_ACCOUNTS[can]) {
          testCans.push(can);
        }
      }

      for (const can of testCans) {
        const res = await classifyCAN(can, { simulatedDelayMs: 0 });
        expect(res.success).toBe(true);
        expect(res.data?.meterType).toBe('AMI');
        expect(res.data?.supportsIntervalTelemetry).toBe(true);
        expect(res.data?.meterSerialNumber).toContain('MR-AMI-');
        expect(resolveMeterType(can)).toBe('AMI');
        expect(determineMeterTypeByParity(can)).toBe('AMI');
      }
    });

    it('validates 100 randomly generated odd-ending CANs strictly resolve to Analog', async () => {
      const oddDigits = [1, 3, 5, 7, 9];
      const testCans: string[] = [];

      for (let i = 0; i < 100; i++) {
        const lastDigit = oddDigits[i % oddDigits.length];
        const can = generateRandomCan(lastDigit, i % 2 === 0 ? 10 : 12);
        if (!MERALCO_SEED_ACCOUNTS[can]) {
          testCans.push(can);
        }
      }

      for (const can of testCans) {
        const res = await classifyCAN(can, { simulatedDelayMs: 0 });
        expect(res.success).toBe(true);
        expect(res.data?.meterType).toBe('Analog');
        expect(res.data?.supportsIntervalTelemetry).toBe(false);
        expect(res.data?.meterSerialNumber).toContain('MR-ANA-');
        expect(resolveMeterType(can)).toBe('Analog');
        expect(determineMeterTypeByParity(can)).toBe('Analog');
      }
    });

    it('correctly handles all boundary terminal digits (0 through 9)', async () => {
      for (let d = 0; d <= 9; d++) {
        const testCan = `777777777${d}`;
        const res = await classifyCAN(testCan, { simulatedDelayMs: 0 });
        expect(res.success).toBe(true);
        const expectedType = d % 2 === 0 ? 'AMI' : 'Analog';
        expect(res.data?.meterType).toBe(expectedType);
        expect(res.data?.supportsIntervalTelemetry).toBe(expectedType === 'AMI');
      }
    });

    it('handles leading-zero CANs with parity correctly (e.g., "0000000002" vs "0000000001")', async () => {
      const resEven = await classifyCAN('0000000002', { simulatedDelayMs: 0 });
      expect(resEven.success).toBe(true);
      expect(resEven.data?.meterType).toBe('AMI');

      const resOdd = await classifyCAN('0000000001', { simulatedDelayMs: 0 });
      expect(resOdd.success).toBe(true);
      expect(resOdd.data?.meterType).toBe('Analog');
    });
  });

  // ----------------------------------------------------------------------------
  // SECTION 3: Input Fuzzing, Delimiter Stress & Security Injection
  // ----------------------------------------------------------------------------
  describe('3. Input Fuzzing, Delimiters & Injection Attacks', () => {
    it('accepts legitimate delimiter variations and spaces around valid digits', async () => {
      const variations = [
        '1234-5678-90',
        '12-34-56-78-90',
        '1 2 3 4 5 6 7 8 9 0',
        '  1234 5678 90  ',
        '\t1234-5678-90\n',
        '1234--5678--90', // consecutive hyphens
        '-1234567890-',   // leading/trailing hyphen with 10 digits
      ];

      for (const variant of variations) {
        const res = await classifyCAN(variant, { simulatedDelayMs: 0 });
        expect(res.success).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(res.data?.can).toBe('1234567890');
      }
    });

    it('gracefully rejects SQL injection payloads with statusCode 400 and INVALID_CAN', async () => {
      const sqlInjections = [
        "' OR '1'='1",
        "1234567890; DROP TABLE customers;--",
        "UNION SELECT * FROM users--",
        "12345' OR '1'='1",
        "admin'--",
      ];

      for (const payload of sqlInjections) {
        const res = await classifyCAN(payload, { simulatedDelayMs: 0 });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });

    it('gracefully rejects NoSQL, XSS and format string payloads with 400', async () => {
      const attacks = [
        '{"$gt": ""}',
        '<script>alert("XSS")</script>',
        '%s%s%s%s%s',
        '${7*7}',
        '{{7*7}}',
        'javascript:void(0)',
      ];

      for (const payload of attacks) {
        const res = await classifyCAN(payload, { simulatedDelayMs: 0 });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });

    it('gracefully rejects Unicode digits and non-ASCII numerals with 400', async () => {
      const unicodeInputs = [
        '١٢٣٤٥٦٧٨٩٠', // Arabic-Indic digits
        '１２３４５６７８９０', // Fullwidth digits
        '১২৩৪৫৬৭৮৯০', // Bengali digits
        '①②③④⑤⑥⑦⑧⑨⓪', // Circled numbers
        '123456789\u0000', // Null byte suffix
      ];

      for (const input of unicodeInputs) {
        const res = await classifyCAN(input, { simulatedDelayMs: 0 });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });

    it('gracefully rejects alphanumeric and letter-containing strings with 400', async () => {
      const letterInputs = [
        '123456789a',
        '123456789O', // Letter O instead of zero
        'MR-AMI-7890',
        'can-1234567890',
        'abcdefghij',
      ];

      for (const input of letterInputs) {
        const res = await classifyCAN(input, { simulatedDelayMs: 0 });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });

    it('gracefully rejects extreme lengths and boundary digit counts with 400', async () => {
      const invalidLengths = [
        '', // 0
        ' ', // 0
        '1', // 1
        '12', // 2
        '123456789', // 9
        '12345678901', // 11
        '1234567890123', // 13
        '9'.repeat(50), // 50
        '8'.repeat(500), // 500
        '7'.repeat(5000), // 5000 (stress test regex ReDoS)
      ];

      for (const input of invalidLengths) {
        const res = await classifyCAN(input, { simulatedDelayMs: 0 });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });

    it('survives non-string and malformed types without throwing unhandled exceptions', async () => {
      const badTypes = [
        null,
        undefined,
        1234567890 as any,
        true as any,
        false as any,
        {} as any,
        [] as any,
        NaN as any,
        (() => {}) as any,
      ];

      for (const val of badTypes) {
        const res = await classifyCAN(val, { simulatedDelayMs: 0 });
        expect(res).toBeDefined();
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.error?.code).toBe('INVALID_CAN');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // SECTION 4: Concurrency Isolation & Latency Bounds
  // ----------------------------------------------------------------------------
  describe('4. High Concurrency & Latency Bounds', () => {
    it('handles 50 concurrent requests simultaneously with zero state contamination', async () => {
      const concurrentRequests = Array.from({ length: 50 }, (_, i) => {
        // Interleave seeded AMI, seeded Analog, and arbitrary fallback CANs
        if (i % 3 === 0) {
          return { can: '1234567890', expectedType: 'AMI', expectedName: 'Nena Villanueva' };
        } else if (i % 3 === 1) {
          return { can: '1234567893', expectedType: 'Analog', expectedName: 'Jacob Antonio Uzel' };
        } else {
          const arbitraryEven = `66660000${(i * 2).toString().padStart(2, '0')}`;
          return { can: arbitraryEven, expectedType: 'AMI', expectedName: 'Meralco Customer' };
        }
      });

      const promises = concurrentRequests.map((req) =>
        classifyCAN(req.can, { simulatedDelayMs: 10 })
      );

      const results = await Promise.all(promises);

      results.forEach((res, idx) => {
        const expected = concurrentRequests[idx];
        expect(res.success).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(res.data?.can).toBe(expected.can);
        expect(res.data?.meterType).toBe(expected.expectedType);
        expect(res.data?.accountHolderName).toBe(expected.expectedName);
      });
    });

    it('executes asynchronous non-blocking scheduling where faster delay finishes first', async () => {
      const order: string[] = [];

      const pSlow = classifyCAN('1234567890', { simulatedDelayMs: 60 }).then((res) => {
        order.push('slow');
        return res;
      });

      const pFast = classifyCAN('1234567893', { simulatedDelayMs: 10 }).then((res) => {
        order.push('fast');
        return res;
      });

      await Promise.all([pSlow, pFast]);

      expect(order).toEqual(['fast', 'slow']);
    });

    it('correctly tracks latencyMs within a realistic bound of simulatedDelayMs', async () => {
      const delay = 45;
      const res = await classifyCAN('1234567890', { simulatedDelayMs: delay });

      expect(res.success).toBe(true);
      // latencyMs should be >= simulatedDelayMs (within reasonable event loop jitter)
      expect(res.latencyMs).toBeGreaterThanOrEqual(delay - 10);
      expect(res.latencyMs).toBeLessThan(delay + 250);
    });

    it('handles mixed concurrent workloads including errors, strict 404s, and valid 200s', async () => {
      const requests = [
        classifyCAN('1234567890', { simulatedDelayMs: 5 }), // Seeded 200
        classifyCAN('INVALID!', { simulatedDelayMs: 5 }),   // Invalid 400
        classifyCAN('7777777777', { simulatedDelayMs: 5, allowParityFallback: false }), // Strict unseeded 404
        classifyCAN('1234567890', { simulatedDelayMs: 5, forceNetworkError: true }),    // Network 500
        classifyCAN('8888888888', { simulatedDelayMs: 5 }), // Fallback 200
      ];

      const [r1, r2, r3, r4, r5] = await Promise.all(requests);

      expect(r1.statusCode).toBe(200);
      expect(r1.success).toBe(true);

      expect(r2.statusCode).toBe(400);
      expect(r2.error?.code).toBe('INVALID_CAN');

      expect(r3.statusCode).toBe(404);
      expect(r3.error?.code).toBe('ACCOUNT_NOT_FOUND');

      expect(r4.statusCode).toBe(500);
      expect(r4.error?.code).toBe('SIMULATED_NETWORK_ERROR');

      expect(r5.statusCode).toBe(200);
      expect(r5.data?.meterType).toBe('AMI');
    });
  });

  // ----------------------------------------------------------------------------
  // SECTION 5: Synchronous Resolvers & Resiliency Boundaries
  // ----------------------------------------------------------------------------
  describe('5. Synchronous Resolver Resilience', () => {
    it('resolveMeterType returns safe default ("AMI") on non-string or empty inputs', () => {
      expect(resolveMeterType('')).toBe('AMI');
      expect(resolveMeterType(null as any)).toBe('AMI');
      expect(resolveMeterType(undefined as any)).toBe('AMI');
      expect(resolveMeterType('   ')).toBe('AMI');
      expect(resolveMeterType('abc')).toBe('AMI');
    });

    it('determineMeterTypeByParity returns safe default ("AMI") when no digits exist', () => {
      expect(determineMeterTypeByParity('')).toBe('AMI');
      expect(determineMeterTypeByParity('NONNUMERIC')).toBe('AMI');
    });

    it('getStoredMeterDetails returns null safely on invalid or unseeded inputs', () => {
      expect(getStoredMeterDetails('')).toBeNull();
      expect(getStoredMeterDetails('9999999999')).toBeNull();
      expect(getStoredMeterDetails(null as any)).toBeNull();
    });

    it('createFallbackMeterDetails formats 10-digit and 12-digit CANs with valid masks', () => {
      const details10 = createFallbackMeterDetails('1234567890');
      expect(details10.formattedCan).toBe('1234-5678-90');
      expect(details10.meterSerialNumber).toBe('MR-AMI-7890');

      const details12 = createFallbackMeterDetails('123456789012');
      expect(details12.formattedCan).toBe('1234-5678-9012');
      expect(details12.meterSerialNumber).toBe('MR-AMI-9012');
    });
  });
});
