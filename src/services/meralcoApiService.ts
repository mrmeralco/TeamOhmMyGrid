// ==============================================================================
// KuryenTipid - Simulated Meralco API Service
// Handles CAN Meter Classification (AMI vs Analog), Seed Profile Lookups,
// Parity Fallbacks, and Simulated Latency / Network Error Handling
// ==============================================================================

import { MeterType } from '../types';
import { cleanCAN, formatCANDisplay } from '../utils/validation';

export { MeterType };

export interface MeralcoMeterDetails {
  can: string;                          // Normalized numeric digits (10 or 12)
  formattedCan: string;                 // Display formatted CAN (e.g., '1234-5678-90')
  meterType: MeterType;                 // 'AMI' | 'Analog'
  meterSerialNumber: string;            // e.g., 'MR-AMI-7890' or 'MR-ANA-7893'
  meterModel: string;                   // Hardware model name
  installationDate: string;             // ISO-8601 date (e.g., '2023-01-15')
  accountHolderName: string;            // e.g., 'Nena Villanueva'
  serviceAddress: string;               // e.g., 'Block 14 Lot 8, Sampaguita St., QC'
  rateClass: string;                    // e.g., 'Residential'
  serviceStatus: 'ACTIVE' | 'DISCONNECTED' | 'PENDING_INSPECTION';
  supportsIntervalTelemetry: boolean;   // true for AMI, false for Analog
}

export interface MeralcoApiResponse<T> {
  success: boolean;
  statusCode: number;                   // 200, 400, 404, 500
  data?: T;
  error?: {
    code: 'INVALID_CAN' | 'ACCOUNT_NOT_FOUND' | 'TELEMETRY_UNAVAILABLE' | 'SIMULATED_NETWORK_ERROR';
    message: string;
  };
  latencyMs: number;
  timestamp: string;                    // ISO-8601 string
}

export interface ClassifyCANOptions {
  simulatedDelayMs?: number;            // Default: 400ms (0 in tests)
  allowParityFallback?: boolean;        // Default: true; if false, unknown CAN -> 404
  forceNetworkError?: boolean;          // Default: false; if true -> 500
}

/**
 * Pre-seeded Meralco Customer Account dictionary.
 * Explicit entries MUST take precedence over odd/even parity fallback.
 */
export const MERALCO_SEED_ACCOUNTS: Record<string, MeralcoMeterDetails> = {
  // --- AMI Smart Meter Accounts ---
  '1234567890': {
    can: '1234567890',
    formattedCan: '1234-5678-90',
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7890',
    meterModel: 'GE I-210+c Smart AMI',
    installationDate: '2023-01-15',
    accountHolderName: 'Nena Villanueva',
    serviceAddress: 'Block 14 Lot 8, Sampaguita St., Quezon City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: true,
  },
  '1234567891': {
    // Odd ending digit '1', but explicitly pre-seeded as AMI Smart Meter
    can: '1234567891',
    formattedCan: '1234-5678-91',
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7891',
    meterModel: 'Landis+Gyr FOCUS AXR-SD',
    installationDate: '2023-06-20',
    accountHolderName: 'Jaeda Marthena Iral',
    serviceAddress: 'Unit 402, Katipunan Ave., Loyola Heights, Quezon City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: true,
  },
  '1234567892': {
    can: '1234567892',
    formattedCan: '1234-5678-92',
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-7892',
    meterModel: 'Itron OpenWay CENTRON',
    installationDate: '2023-04-10',
    accountHolderName: 'Carl Benedict Enriquez',
    serviceAddress: '15 Malakas St., Diliman, Quezon City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: true,
  },
  '1029384756': {
    can: '1029384756',
    formattedCan: '1029-3847-56',
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-4756',
    meterModel: 'GE I-210+c Smart AMI',
    installationDate: '2022-11-05',
    accountHolderName: 'Maria Santos',
    serviceAddress: '77 Acacia St., Pasig City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: true,
  },
  '019288234410': {
    // Preset CAN 1 (Bahay)
    can: '019288234410',
    formattedCan: '0192-8823-4410',
    meterType: 'AMI',
    meterSerialNumber: 'MR-AMI-4410',
    meterModel: 'GE I-210+c Smart AMI',
    installationDate: '2022-11-05',
    accountHolderName: 'Maria Santos (Bahay)',
    serviceAddress: 'Brgy. San Antonio, Pasig City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: true,
  },

  // --- Analog Electromechanical Meter Accounts ---
  '1234567893': {
    can: '1234567893',
    formattedCan: '1234-5678-93',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7893',
    meterModel: 'General Electric I-70-S',
    installationDate: '2018-03-12',
    accountHolderName: 'Jacob Antonio Uzel',
    serviceAddress: '88 Magsaysay Blvd., Santa Mesa, Manila',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
  '1234567894': {
    // Even ending digit '4', but explicitly pre-seeded as Analog Meter
    can: '1234567894',
    formattedCan: '1234-5678-94',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7894',
    meterModel: 'Westinghouse D5S Electromechanical',
    installationDate: '2017-08-19',
    accountHolderName: 'Hector Escobido',
    serviceAddress: '23 Boni Serrano Ave., Cubao, Quezon City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
  '1234567895': {
    can: '1234567895',
    formattedCan: '1234-5678-95',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-7895',
    meterModel: 'Schlumberger J5S Analog',
    installationDate: '2019-02-14',
    accountHolderName: 'Lenard Cato Narvaza',
    serviceAddress: '45 West Avenue, Philam, Quezon City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
  '9876543210': {
    // Even ending digit '0', but explicitly pre-seeded as Analog Meter
    can: '9876543210',
    formattedCan: '9876-5432-10',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-3210',
    meterModel: 'General Electric I-70-S',
    installationDate: '2015-05-22',
    accountHolderName: 'Juan Dela Cruz',
    serviceAddress: '123 Rizal Ave., Caloocan City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
  '028491023321': {
    // Preset CAN 2 (Tindahan)
    can: '028491023321',
    formattedCan: '0284-9102-3321',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-3321',
    meterModel: 'Fuji Electric Single-Phase',
    installationDate: '2016-09-15',
    accountHolderName: 'Santos Sari-Sari Store',
    serviceAddress: 'Kapitolyo, Pasig City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
  '034177895562': {
    // Preset CAN 3 (Condo)
    can: '034177895562',
    formattedCan: '0341-7789-5562',
    meterType: 'Analog',
    meterSerialNumber: 'MR-ANA-5562',
    meterModel: 'General Electric I-70-S',
    installationDate: '2018-10-30',
    accountHolderName: 'Maria Santos (Condo)',
    serviceAddress: 'Grace Residences, Taguig City',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: false,
  },
};

/**
 * Deterministic odd/even parity rule for arbitrary CANs.
 * Even last digit = AMI Smart Meter.
 * Odd last digit = Analog Electromechanical Meter.
 */
export function determineMeterTypeByParity(cleanCan: string): MeterType {
  const lastChar = cleanCan.slice(-1);
  const lastDigit = parseInt(lastChar, 10);
  if (Number.isNaN(lastDigit)) {
    return 'AMI';
  }
  return lastDigit % 2 === 0 ? 'AMI' : 'Analog';
}

/**
 * Constructs synthesized Meralco meter details for arbitrary valid CANs
 * that are not in the pre-seeded dictionary.
 */
export function createFallbackMeterDetails(cleanCan: string): MeralcoMeterDetails {
  const meterType = determineMeterTypeByParity(cleanCan);
  const isAmi = meterType === 'AMI';
  const suffix = cleanCan.slice(-4);

  const formattedCan =
    cleanCan.length === 10
      ? formatCANDisplay(cleanCan)
      : cleanCan.length === 12
      ? `${cleanCan.slice(0, 4)}-${cleanCan.slice(4, 8)}-${cleanCan.slice(8)}`
      : cleanCan;

  return {
    can: cleanCan,
    formattedCan,
    meterType,
    meterSerialNumber: isAmi ? `MR-AMI-${suffix}` : `MR-ANA-${suffix}`,
    meterModel: isAmi ? 'GE I-210+c Smart AMI' : 'General Electric I-70-S Electromechanical',
    installationDate: '2021-08-15',
    accountHolderName: 'Meralco Customer',
    serviceAddress: 'Meralco Franchise Area, Metro Manila',
    rateClass: 'Residential',
    serviceStatus: 'ACTIVE',
    supportsIntervalTelemetry: isAmi,
  };
}

/**
 * Synchronous lookup of pre-seeded meter details.
 * Returns null if the CAN is unseeded.
 */
export function getStoredMeterDetails(can: string): MeralcoMeterDetails | null {
  const clean = cleanCAN(can || '');
  const record = MERALCO_SEED_ACCOUNTS[clean];
  return record ? { ...record } : null;
}

/**
 * Synchronous resolver for immediate React state and profile creation.
 * Checks seed accounts first, then falls back to parity.
 */
export function resolveMeterType(can: string): MeterType {
  const clean = cleanCAN(can || '');
  if (!clean) return 'AMI';
  if (MERALCO_SEED_ACCOUNTS[clean]) {
    return MERALCO_SEED_ACCOUNTS[clean].meterType;
  }
  return determineMeterTypeByParity(clean);
}

/**
 * Asynchronous simulated Meralco API call to classify a Customer Account Number (CAN).
 * Performs validation, simulated latency, seed account lookup, and fallback resolution.
 */
export async function classifyCAN(
  can: string,
  options?: ClassifyCANOptions
): Promise<MeralcoApiResponse<MeralcoMeterDetails>> {
  const start = Date.now();
  const delayMs = options?.simulatedDelayMs ?? 400;

  const waitDelay = async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  };

  // 1. Simulated Network Error
  if (options?.forceNetworkError) {
    await waitDelay();
    return {
      success: false,
      statusCode: 500,
      error: {
        code: 'SIMULATED_NETWORK_ERROR',
        message: 'Simulated Meralco API network failure. Please try again.',
      },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Input Validation
  if (!can || typeof can !== 'string' || !can.trim()) {
    await waitDelay();
    return {
      success: false,
      statusCode: 400,
      error: {
        code: 'INVALID_CAN',
        message: 'Customer Account Number cannot be empty.',
      },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  const rawTrimmed = can.trim();
  // Check for invalid non-delimiter characters (letters, special symbols other than hyphens and spaces)
  if (/[^\d\s\-]/.test(rawTrimmed)) {
    await waitDelay();
    return {
      success: false,
      statusCode: 400,
      error: {
        code: 'INVALID_CAN',
        message: 'Customer Account Number must contain only digits and optional hyphen separators.',
      },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  const clean = cleanCAN(rawTrimmed);
  if (clean.length < 10 || (clean.length !== 10 && clean.length !== 12)) {
    await waitDelay();
    return {
      success: false,
      statusCode: 400,
      error: {
        code: 'INVALID_CAN',
        message: 'Customer Account Number must contain exactly 10 digits (or 12 for preset billing accounts).',
      },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Pre-Seeded Dictionary Lookup (Takes Precedence over Parity)
  const seeded = MERALCO_SEED_ACCOUNTS[clean];
  if (seeded) {
    await waitDelay();
    return {
      success: true,
      statusCode: 200,
      data: { ...seeded },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  // 4. Unseeded Account Handling
  if (options?.allowParityFallback === false) {
    await waitDelay();
    return {
      success: false,
      statusCode: 404,
      error: {
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Customer Account Number was not found in Meralco records.',
      },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  // 5. Deterministic Parity Fallback
  const fallbackDetails = createFallbackMeterDetails(clean);
  await waitDelay();
  return {
    success: true,
    statusCode: 200,
    data: fallbackDetails,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}
