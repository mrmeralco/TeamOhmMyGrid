// ==============================================================================
// Unit Test Suite: Simulated Meralco API Service (Milestone M1)
// Covers CAN Classification (AMI vs Analog), Seed Profiles, Parity Fallbacks,
// Input Formatting / Normalization, Latency Simulation, and Error Handling
// ==============================================================================

import {
  classifyCAN,
  getStoredMeterDetails,
  resolveMeterType,
  determineMeterTypeByParity,
  createFallbackMeterDetails,
  MERALCO_SEED_ACCOUNTS,
} from '../../services/meralcoApiService';

describe('Meralco API Service - Milestone M1', () => {
  describe('Suite 1: Pre-seeded AMI Account Classification', () => {
    it('correctly classifies Nena Villanueva (1234567890) as AMI Smart Meter with interval telemetry', async () => {
      const res = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data?.meterType).toBe('AMI');
      expect(res.data?.supportsIntervalTelemetry).toBe(true);
      expect(res.data?.accountHolderName).toBe('Nena Villanueva');
      expect(res.data?.meterModel).toBe('GE I-210+c Smart AMI');
      expect(res.data?.meterSerialNumber).toBe('MR-AMI-7890');
    });

    it('correctly classifies Jaeda Marthena Iral (1234567891) as AMI, ensuring seed dictionary overrides odd parity', async () => {
      // Last digit is '1' (odd), which would evaluate to Analog by parity,
      // but seed profile MUST override to AMI
      const res = await classifyCAN('1234567891', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('AMI');
      expect(res.data?.supportsIntervalTelemetry).toBe(true);
      expect(res.data?.accountHolderName).toBe('Jaeda Marthena Iral');
      expect(res.data?.meterModel).toBe('Landis+Gyr FOCUS AXR-SD');
      expect(res.data?.meterSerialNumber).toBe('MR-AMI-7891');
    });

    it('correctly classifies Carl Benedict Enriquez (1234567892) as AMI Smart Meter', async () => {
      const res = await classifyCAN('1234567892', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('AMI');
      expect(res.data?.supportsIntervalTelemetry).toBe(true);
      expect(res.data?.accountHolderName).toBe('Carl Benedict Enriquez');
      expect(res.data?.meterModel).toBe('Itron OpenWay CENTRON');
      expect(res.data?.meterSerialNumber).toBe('MR-AMI-7892');
    });

    it('correctly classifies Maria Santos Bahay (1029384756 and 0192-8823-4410) as AMI', async () => {
      const res10 = await classifyCAN('1029384756', { simulatedDelayMs: 0 });
      expect(res10.success).toBe(true);
      expect(res10.data?.meterType).toBe('AMI');
      expect(res10.data?.accountHolderName).toBe('Maria Santos');
      expect(res10.data?.supportsIntervalTelemetry).toBe(true);

      const res12 = await classifyCAN('0192-8823-4410', { simulatedDelayMs: 0 });
      expect(res12.success).toBe(true);
      expect(res12.data?.meterType).toBe('AMI');
      expect(res12.data?.accountHolderName).toBe('Maria Santos (Bahay)');
      expect(res12.data?.supportsIntervalTelemetry).toBe(true);
    });

    it('verifies all expected metadata properties for AMI response', async () => {
      const res = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(res.data).toMatchObject({
        can: '1234567890',
        formattedCan: '1234-5678-90',
        meterType: 'AMI',
        rateClass: 'Residential',
        serviceStatus: 'ACTIVE',
        supportsIntervalTelemetry: true,
      });
      expect(typeof res.data?.installationDate).toBe('string');
      expect(typeof res.data?.serviceAddress).toBe('string');
    });
  });

  describe('Suite 2: Pre-seeded Analog Account Classification', () => {
    it('correctly classifies Jacob Antonio Uzel (1234567893) as Analog Electromechanical Meter', async () => {
      const res = await classifyCAN('1234567893', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('Analog');
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
      expect(res.data?.accountHolderName).toBe('Jacob Antonio Uzel');
      expect(res.data?.meterSerialNumber).toBe('MR-ANA-7893');
    });

    it('correctly classifies Hector Escobido (1234567894) as Analog, ensuring seed dictionary overrides even parity', async () => {
      // Last digit is '4' (even), which would evaluate to AMI by parity,
      // but seed profile MUST override to Analog
      const res = await classifyCAN('1234567894', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('Analog');
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
      expect(res.data?.accountHolderName).toBe('Hector Escobido');
      expect(res.data?.meterModel).toBe('Westinghouse D5S Electromechanical');
      expect(res.data?.meterSerialNumber).toBe('MR-ANA-7894');
    });

    it('correctly classifies Lenard Cato Narvaza (1234567895) as Analog Electromechanical Meter', async () => {
      const res = await classifyCAN('1234567895', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('Analog');
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
      expect(res.data?.accountHolderName).toBe('Lenard Cato Narvaza');
    });

    it('correctly classifies Juan Dela Cruz (9876543210) as Analog, ensuring seed dictionary overrides even parity', async () => {
      // Last digit is '0' (even), which would evaluate to AMI by parity,
      // but seed profile MUST override to Analog
      const res = await classifyCAN('9876543210', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.data?.meterType).toBe('Analog');
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
      expect(res.data?.accountHolderName).toBe('Juan Dela Cruz');
      expect(res.data?.meterSerialNumber).toBe('MR-ANA-3210');
    });

    it('correctly classifies preset accounts Tindahan (0284-9102-3321) and Condo (0341-7789-5562) as Analog', async () => {
      const resTindahan = await classifyCAN('0284-9102-3321', { simulatedDelayMs: 0 });
      expect(resTindahan.success).toBe(true);
      expect(resTindahan.data?.meterType).toBe('Analog');
      expect(resTindahan.data?.supportsIntervalTelemetry).toBe(false);
      expect(resTindahan.data?.accountHolderName).toBe('Santos Sari-Sari Store');

      // Condo ends in '2' (even), but is pre-seeded as Analog
      const resCondo = await classifyCAN('0341-7789-5562', { simulatedDelayMs: 0 });
      expect(resCondo.success).toBe(true);
      expect(resCondo.data?.meterType).toBe('Analog');
      expect(resCondo.data?.supportsIntervalTelemetry).toBe(false);
      expect(resCondo.data?.accountHolderName).toBe('Maria Santos (Condo)');
    });

    it('verifies interval telemetry is disabled (supportsIntervalTelemetry === false) for Analog', async () => {
      const res = await classifyCAN('1234567893', { simulatedDelayMs: 0 });
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
    });
  });

  describe('Suite 3: Formatting & Normalization Resiliency', () => {
    it('handles CANs with hyphens (e.g. "1234-5678-90") identically to unhyphenated digits', async () => {
      const resHyphen = await classifyCAN('1234-5678-90', { simulatedDelayMs: 0 });
      const resRaw = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(resHyphen.success).toBe(true);
      expect(resHyphen.data?.can).toBe('1234567890');
      expect(resHyphen.data).toEqual(resRaw.data);
    });

    it('handles CANs with space delimiters (e.g. "1234 5678 90")', async () => {
      const res = await classifyCAN('1234 5678 90', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.data?.can).toBe('1234567890');
      expect(res.data?.meterType).toBe('AMI');
    });

    it('trims leading and trailing whitespace around CAN input', async () => {
      const res = await classifyCAN('   1234567890   ', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.data?.can).toBe('1234567890');
    });

    it('populates formattedCan in standard SIN mask (XXXX-XXXX-XX) while can remains raw digits', async () => {
      const res = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      expect(res.data?.can).toBe('1234567890');
      expect(res.data?.formattedCan).toBe('1234-5678-90');
    });
  });

  describe('Suite 4: Deterministic Parity Fallback for Arbitrary CANs', () => {
    it('assigns AMI meter type to arbitrary CAN with even ending digit (e.g. "8877665542")', async () => {
      const res = await classifyCAN('8877665542', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.data?.meterType).toBe('AMI');
      expect(res.data?.supportsIntervalTelemetry).toBe(true);
      expect(res.data?.meterModel).toBe('GE I-210+c Smart AMI');
      expect(res.data?.meterSerialNumber).toBe('MR-AMI-5542');
    });

    it('assigns Analog meter type to arbitrary CAN with odd ending digit (e.g. "8877665547")', async () => {
      const res = await classifyCAN('8877665547', { simulatedDelayMs: 0 });
      expect(res.success).toBe(true);
      expect(res.data?.meterType).toBe('Analog');
      expect(res.data?.supportsIntervalTelemetry).toBe(false);
      expect(res.data?.meterModel).toBe('General Electric I-70-S Electromechanical');
      expect(res.data?.meterSerialNumber).toBe('MR-ANA-5547');
    });

    it('produces deterministic output when called repeatedly with the same arbitrary CAN', async () => {
      const res1 = await classifyCAN('9988776654', { simulatedDelayMs: 0 });
      const res2 = await classifyCAN('9988776654', { simulatedDelayMs: 0 });
      expect(res1.data).toEqual(res2.data);
    });

    it('assigns proper hardware model names for fallback meters', () => {
      const evenDetails = createFallbackMeterDetails('5555444422');
      expect(evenDetails.meterType).toBe('AMI');
      expect(evenDetails.meterModel).toContain('AMI');

      const oddDetails = createFallbackMeterDetails('5555444433');
      expect(oddDetails.meterType).toBe('Analog');
      expect(oddDetails.meterModel).toContain('Electromechanical');
    });
  });

  describe('Suite 5: Validation & Error Handling for Invalid CANs', () => {
    it('returns statusCode 400 and INVALID_CAN for empty string or whitespace', async () => {
      const emptyRes = await classifyCAN('', { simulatedDelayMs: 0 });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.statusCode).toBe(400);
      expect(emptyRes.error?.code).toBe('INVALID_CAN');

      const spaceRes = await classifyCAN('    ', { simulatedDelayMs: 0 });
      expect(spaceRes.success).toBe(false);
      expect(spaceRes.statusCode).toBe(400);
      expect(spaceRes.error?.code).toBe('INVALID_CAN');
    });

    it('returns statusCode 400 and INVALID_CAN for alphabetic or non-numeric input', async () => {
      const alphaRes = await classifyCAN('12345ABCDE', { simulatedDelayMs: 0 });
      expect(alphaRes.success).toBe(false);
      expect(alphaRes.statusCode).toBe(400);
      expect(alphaRes.error?.code).toBe('INVALID_CAN');
    });

    it('returns statusCode 400 and INVALID_CAN for CANs shorter than 10 digits', async () => {
      const shortRes = await classifyCAN('12345678', { simulatedDelayMs: 0 });
      expect(shortRes.success).toBe(false);
      expect(shortRes.statusCode).toBe(400);
      expect(shortRes.error?.code).toBe('INVALID_CAN');
    });

    it('returns statusCode 400 and INVALID_CAN for CANs longer than allowed format', async () => {
      const longRes = await classifyCAN('123456789012345', { simulatedDelayMs: 0 });
      expect(longRes.success).toBe(false);
      expect(longRes.statusCode).toBe(400);
      expect(longRes.error?.code).toBe('INVALID_CAN');
    });

    it('resolves safely without throwing unhandled exceptions on invalid inputs', async () => {
      await expect(classifyCAN(null as any, { simulatedDelayMs: 0 })).resolves.toHaveProperty('success', false);
      await expect(classifyCAN(undefined as any, { simulatedDelayMs: 0 })).resolves.toHaveProperty('success', false);
    });
  });

  describe('Suite 6: Synchronous Lookup & Missing Accounts (Strict Mode)', () => {
    it('getStoredMeterDetails returns MeralcoMeterDetails for pre-seeded CAN', () => {
      const details = getStoredMeterDetails('1234567890');
      expect(details).not.toBeNull();
      expect(details?.accountHolderName).toBe('Nena Villanueva');
      expect(details?.meterType).toBe('AMI');
    });

    it('getStoredMeterDetails returns null for unseeded CAN', () => {
      const details = getStoredMeterDetails('8888888888');
      expect(details).toBeNull();
    });

    it('classifyCAN with allowParityFallback: false returns statusCode 404 and ACCOUNT_NOT_FOUND for unseeded CAN', async () => {
      const res = await classifyCAN('8888888888', {
        simulatedDelayMs: 0,
        allowParityFallback: false,
      });
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(404);
      expect(res.error?.code).toBe('ACCOUNT_NOT_FOUND');
    });

    it('resolveMeterType correctly resolves both seeded accounts (including overrides) and arbitrary parity CANs', () => {
      // Seeded override: 1234567891 has odd digit '1', but resolves to 'AMI'
      expect(resolveMeterType('1234567891')).toBe('AMI');
      // Seeded override: 1234567894 has even digit '4', but resolves to 'Analog'
      expect(resolveMeterType('1234567894')).toBe('Analog');
      // Seeded override: 9876543210 has even digit '0', but resolves to 'Analog'
      expect(resolveMeterType('9876543210')).toBe('Analog');
      // Arbitrary parity:
      expect(resolveMeterType('5555555552')).toBe('AMI');
      expect(resolveMeterType('5555555557')).toBe('Analog');
    });
  });

  describe('Suite 7: Simulated Latency & Network Error Simulation', () => {
    it('executes instantaneously when simulatedDelayMs is set to 0', async () => {
      const start = Date.now();
      const res = await classifyCAN('1234567890', { simulatedDelayMs: 0 });
      const elapsed = Date.now() - start;
      expect(res.success).toBe(true);
      expect(elapsed).toBeLessThan(100);
    });

    it('simulates delay and records latencyMs and ISO timestamp in response', async () => {
      const res = await classifyCAN('1234567890', { simulatedDelayMs: 40 });
      expect(res.success).toBe(true);
      expect(res.latencyMs).toBeGreaterThanOrEqual(20);
      expect(new Date(res.timestamp).getTime()).not.toBeNaN();
    });

    it('returns statusCode 500 and SIMULATED_NETWORK_ERROR when forceNetworkError is true', async () => {
      const res = await classifyCAN('1234567890', {
        simulatedDelayMs: 0,
        forceNetworkError: true,
      });
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(500);
      expect(res.error?.code).toBe('SIMULATED_NETWORK_ERROR');
    });
  });
});
