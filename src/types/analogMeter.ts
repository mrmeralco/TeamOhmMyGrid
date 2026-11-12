export type AnalogMeterType = 'dial' | 'cyclometer';

export interface AnalogMeterLogEntry {
  id: string;
  can: string;
  timestamp: string; // ISO-8601 string
  readingKwh: number;
  weeklyUsageKwh: number;
  daysSinceLastReading: number;
  normalizedWeeklyKwh: number;
  costEstimate: number;
  photoUri?: string;
  verifiedByUser: boolean;
  meterType: AnalogMeterType;
  dials?: number[];
  notes?: string;
  isInterpolated?: boolean;
}

export interface AnalogMeterReadingResult {
  meterType: AnalogMeterType;
  detectedMeterCategory?: 'electronic' | 'electromechanical' | 'unknown';
  readingKwh: number;
  dials: number[];
  dialCount?: 4 | 5;
  confidence: number;
  isMeterDetected?: boolean;
  failureReason?: 'not_a_meter' | 'blurry' | 'unreadable' | 'low_confidence';
  meterSerialNumber?: string;
  rawExtractionSource: 'gemini_vision' | 'deterministic_simulation';
}

export interface WeeklyDeltaCalculationResult {
  weeklyUsageKwh: number;
  normalizedWeeklyKwh: number;
  costEstimate: number;
  isRollover: boolean;
}

export interface WeeklyAnalogSummary {
  can: string;
  currentReadingKwh: number;
  previousReadingKwh: number;
  weeklyDeltaKwh: number;
  normalizedWeeklyKwh: number;
  estimatedCost: number;
  daysElapsed: number;
  averageWeeklyKwh: number;
  deltaPercentVsPriorWeek: number;
  isRollover: boolean;
  budgetCeilingKwh: number;
  logs: AnalogMeterLogEntry[];
}

export interface AnalogPhotoCaptureResult {
  uri?: string;
  base64?: string;
  canceled: boolean;
  error?: string;
}
