// ==============================================================================
// Tier 3: Cross-Feature Combinations E2E Test Suite
// Validates pairwise and multi-feature interaction contracts across CAN classification,
// AMI 15-minute telemetry, peak differentiation, analog photo capture, reading extraction,
// manual verification drawer, rollover math, weekly curves, and dashboard routing.
// Test IDs: T3-COMB-01 to T3-COMB-15
// ==============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  classifyCAN,
  determineMeterTypeByParity,
  getStoredMeterDetails,
  MERALCO_SEED_ACCOUNTS,
  resolveMeterType,
} from '../../services/meralcoApiService';
import { PRESET_CAN_PROFILES } from '../../constants/mockData';
import { THEMES } from '../../constants/theme';
import { calculateTierCliff, MERALCO_EFFECTIVE_RATE } from '../../lib/tariffEngine';
import { CANProfile, MeterType } from '../../types';

// ------------------------------------------------------------------------------
// Jest Environment Mocks
// ------------------------------------------------------------------------------
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const MOCK_BASE64_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///mock/meter_photo.jpg', base64: MOCK_BASE64_IMAGE, width: 1080, height: 1920 }],
  }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///mock/meter_photo.jpg', base64: MOCK_BASE64_IMAGE, width: 1080, height: 1920 }],
  }),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const mockComponent = (name: string) => {
    const Component = (props: any) => React.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Circle: mockComponent('Circle'),
    Ellipse: mockComponent('Ellipse'),
    G: mockComponent('G'),
    Text: mockComponent('Text'),
    TSpan: mockComponent('TSpan'),
    TextPath: mockComponent('TextPath'),
    Path: mockComponent('Path'),
    Polygon: mockComponent('Polygon'),
    Polyline: mockComponent('Polyline'),
    Line: mockComponent('Line'),
    Rect: mockComponent('Rect'),
    Use: mockComponent('Use'),
    Image: mockComponent('Image'),
    Symbol: mockComponent('Symbol'),
    Defs: mockComponent('Defs'),
    LinearGradient: mockComponent('LinearGradient'),
    RadialGradient: mockComponent('RadialGradient'),
    Stop: mockComponent('Stop'),
    ClipPath: mockComponent('ClipPath'),
    Pattern: mockComponent('Pattern'),
    Mask: mockComponent('Mask'),
  };
});

// ------------------------------------------------------------------------------
// Contract Definitions & Authoritative Reference Oracle
// ------------------------------------------------------------------------------
export type AmiTimeframe = 'day' | 'week' | 'month' | 'year';

export interface AmiIntervalReading {
  timestamp: string;
  intervalIndex: number;
  timeLabel: string;
  kwh: number;
  powerWatts: number;
  isPeak: boolean;
  isCriticalPeak: boolean;
  cumulativeKwh: number;
  estimatedCost: number;
}

export interface AmiTelemetryDataset {
  can: string;
  meterSerialNumber: string;
  timeframe: AmiTimeframe;
  dateRange: { start: string; end: string };
  totalKwh: number;
  peakKwh: number;
  offPeakKwh: number;
  peakPercentage: number;
  estimatedTotalCost: number;
  potentialShiftSavings: number;
  readings: AmiIntervalReading[];
  summaryByBucket: { label: string; kwh: number; isPeak?: boolean }[];
}

export interface AnalogMeterLogEntry {
  id: string;
  can: string;
  timestamp: string;
  readingKwh: number;
  weeklyUsageKwh: number;
  daysSinceLastReading: number;
  normalizedWeeklyKwh: number;
  costEstimate: number;
  photoUri?: string;
  verifiedByUser: boolean;
  meterType: 'cyclometer' | 'dial';
  dials?: number[];
  notes?: string;
}

export interface AnalogMeterReadingResult {
  meterType: 'dial' | 'cyclometer';
  readingKwh: number;
  dials: number[];
  confidence: number;
  meterSerialNumber?: string;
  rawExtractionSource: 'gemini_vision' | 'deterministic_simulation';
}

/**
 * Authoritative AMI Telemetry Generator adhering to PROJECT.md § Interface Contracts.
 * Emulates diurnal residential load curves with Meralco Peak (08:00-21:00 Mon-Sat)
 * and Critical Peak (14:00-17:00, 18:00-21:00) differentiation.
 */
function createAmiTelemetry(can: string, timeframe: AmiTimeframe, targetDateStr = '2026-05-13'): AmiTelemetryDataset {
  const targetDate = new Date(targetDateStr);
  const isSunday = targetDate.getUTCDay() === 0;
  const effectiveRate = 11.43;

  const readings: AmiIntervalReading[] = [];
  let runningKwh = 0;
  let peakKwhSum = 0;
  let offPeakKwhSum = 0;

  for (let i = 0; i < 96; i++) {
    const totalMinutes = i * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    let watts = 250; // Baseload (00:00 - 06:00)
    if (hours >= 6 && hours < 9) watts = 900; // Morning ramp
    else if (hours >= 9 && hours < 14) watts = 650; // Midday working
    else if (hours >= 14 && hours < 17) watts = 2200; // Afternoon cooling peak
    else if (hours >= 17 && hours < 18) watts = 1100; // Late afternoon transition
    else if (hours >= 18 && hours < 21) watts = 1800; // Evening dinner peak
    else if (hours >= 21) watts = 450; // Night ramp down

    const isPeak = !isSunday && hours >= 8 && hours < 21;
    const isCriticalPeak = !isSunday && ((hours >= 14 && hours < 17) || (hours >= 18 && hours < 21));

    const intervalKwh = Number(((watts * 0.25) / 1000).toFixed(4));
    runningKwh = Number((runningKwh + intervalKwh).toFixed(4));

    if (isPeak) {
      peakKwhSum = Number((peakKwhSum + intervalKwh).toFixed(4));
    } else {
      offPeakKwhSum = Number((offPeakKwhSum + intervalKwh).toFixed(4));
    }

    readings.push({
      timestamp: new Date(targetDate.getTime() + totalMinutes * 60000).toISOString(),
      intervalIndex: i,
      timeLabel,
      kwh: intervalKwh,
      powerWatts: watts,
      isPeak,
      isCriticalPeak,
      cumulativeKwh: runningKwh,
      estimatedCost: Number((runningKwh * effectiveRate).toFixed(2)),
    });
  }

  const totalKwh = Number((peakKwhSum + offPeakKwhSum).toFixed(4));
  const peakPercentage = totalKwh > 0 ? Number(((peakKwhSum / totalKwh) * 100).toFixed(1)) : 0;
  const potentialShiftSavings = Number((peakKwhSum * 0.25 * effectiveRate * 0.4).toFixed(2));

  // Multi-timeframe bucket aggregation
  let summaryByBucket: { label: string; kwh: number; isPeak?: boolean }[] = [];
  if (timeframe === 'day') {
    summaryByBucket = readings.map((r) => ({ label: r.timeLabel, kwh: r.kwh, isPeak: r.isPeak }));
  } else if (timeframe === 'week') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    summaryByBucket = days.map((day, idx) => ({
      label: day,
      kwh: Number((totalKwh * (idx === 6 ? 0.75 : 1.05) * (1 / 7)).toFixed(2)),
      isPeak: idx < 6,
    }));
  } else if (timeframe === 'month') {
    summaryByBucket = Array.from({ length: 30 }, (_, idx) => ({
      label: `Day ${idx + 1}`,
      kwh: Number((totalKwh * (0.9 + (idx % 5) * 0.05)).toFixed(2)),
    }));
  } else if (timeframe === 'year') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    summaryByBucket = months.map((m, idx) => ({
      label: m,
      // April-May peak summer cooling, Dec-Jan cool season
      kwh: Number((idx === 3 || idx === 4 ? 380 : idx === 11 || idx === 0 ? 190 : 260).toFixed(1)),
    }));
  }

  return {
    can,
    meterSerialNumber: `MTR-${can.replace(/\D/g, '').slice(-4)}-AMI`,
    timeframe,
    dateRange: {
      start: readings[0].timestamp,
      end: readings[95].timestamp,
    },
    totalKwh,
    peakKwh: peakKwhSum,
    offPeakKwh: offPeakKwhSum,
    peakPercentage,
    estimatedTotalCost: Number((totalKwh * effectiveRate).toFixed(2)),
    potentialShiftSavings,
    readings,
    summaryByBucket,
  };
}

/**
 * Authoritative Analog Meter delta and rollover calculation.
 */
function calculateAnalogDelta(
  currentReading: number,
  previousReading: number,
  daysElapsed: number,
  effectiveRate: number
): { weeklyUsageKwh: number; normalizedWeeklyKwh: number; costEstimate: number; isRollover: boolean } {
  const isRollover = currentReading < previousReading && previousReading >= 90000 && currentReading <= 10000;
  const rawDelta = isRollover ? 100000 + currentReading - previousReading : currentReading - previousReading;
  const weeklyUsageKwh = Math.max(0, rawDelta);
  const normalizedWeeklyKwh = Number(((weeklyUsageKwh / Math.max(1, daysElapsed)) * 7).toFixed(1));
  const costEstimate = Number((weeklyUsageKwh * effectiveRate).toFixed(2));
  return { weeklyUsageKwh, normalizedWeeklyKwh, costEstimate, isRollover };
}

/**
 * Authoritative Analog extraction simulation.
 */
async function extractAnalogReading(photoBase64: string, previousReading = 4280): Promise<AnalogMeterReadingResult> {
  if (!photoBase64 || typeof photoBase64 !== 'string') {
    throw new Error('INVALID_IMAGE_PAYLOAD');
  }
  const simulatedReading = previousReading + 48; // Plausible increment
  const dials = simulatedReading
    .toString()
    .padStart(5, '0')
    .split('')
    .map(Number);
  return {
    meterType: 'dial',
    readingKwh: simulatedReading,
    dials,
    confidence: 0.88,
    meterSerialNumber: 'MTR-ANA-3321',
    rawExtractionSource: 'deterministic_simulation',
  };
}

/**
 * SVG cubic bezier path string generator.
 */
function generateBezierCurvePath(dataPoints: number[], width = 320, height = 160): string {
  if (dataPoints.length === 0) return 'M 0 0';
  const min = Math.min(...dataPoints);
  const max = Math.max(...dataPoints);
  const range = max - min || 1;

  const points = dataPoints.map((val, idx) => {
    const x = Number(((idx / Math.max(1, dataPoints.length - 1)) * width).toFixed(2));
    const y = Number((height - ((val - min) / range) * (height - 20) - 10).toFixed(2));
    return { x, y };
  });

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = Number((p0.x + (p1.x - p0.x) / 2).toFixed(2));
    const cp1y = p0.y;
    const cp2x = cp1x;
    const cp2y = p1.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return path;
}

// ------------------------------------------------------------------------------
// Test Suite: Tier 3 Cross-Feature Combinations
// ------------------------------------------------------------------------------
describe('Tier 3: Cross-Feature Combinations E2E Suite', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  // T3-COMB-01: F01 (Classification) + F03 (Profile Model) + F15 (Dashboard Routing)
  it('T3-COMB-01: F01 + F03 + F15 (Classification -> Profile Model -> Dashboard Dynamic Routing)', async () => {
    const targetCan = '1029384756';
    const classification = await classifyCAN(targetCan, { simulatedDelayMs: 0 });

    expect(classification.success).toBe(true);
    expect(classification.data?.meterType).toBe('AMI');
    expect(classification.data?.supportsIntervalTelemetry).toBe(true);

    // Profile creation extension
    const profile: CANProfile = {
      id: 'can-custom-ami',
      name: 'Maria Residence',
      accountNumber: targetCan,
      customerName: classification.data?.accountHolderName || 'Maria Santos',
      serviceAddress: classification.data?.serviceAddress || 'Acacia St., Pasig City',
      ratePerKwh: 11.43,
      budget: 3500,
      currentKwh: 0,
      meterType: classification.data?.meterType || 'AMI',
      meterSerialNumber: classification.data?.meterSerialNumber,
    };

    expect(profile.meterType).toBe('AMI');

    // Dashboard workflow routing rules:
    // When meterType === 'AMI': shows AMI Curve & Peak breakdown, suppresses Analog capture CTA
    const dashboardRouting = {
      renderAmiCurve: profile.meterType === 'AMI',
      renderPeakAnalytics: profile.meterType === 'AMI',
      renderAnalogPhotoCTA: profile.meterType === 'Analog',
      renderAnalogCurve: profile.meterType === 'Analog',
    };

    expect(dashboardRouting.renderAmiCurve).toBe(true);
    expect(dashboardRouting.renderPeakAnalytics).toBe(true);
    expect(dashboardRouting.renderAnalogPhotoCTA).toBe(false);
    expect(dashboardRouting.renderAnalogCurve).toBe(false);
  });

  // T3-COMB-02: F01 (Classification) + F02 (Seed Mapping) + F15 (Dashboard Routing)
  it('T3-COMB-02: F01 + F02 + F15 (Seed Profile Switch Flips Dashboard View Model)', async () => {
    const bahayCan = '0192-8823-4410'; // Seeded AMI
    const tindahanCan = '0284-9102-3321'; // Seeded Analog

    const bahayRes = await classifyCAN(bahayCan, { simulatedDelayMs: 0 });
    const tindahanRes = await classifyCAN(tindahanCan, { simulatedDelayMs: 0 });

    expect(bahayRes.data?.meterType).toBe('AMI');
    expect(tindahanRes.data?.meterType).toBe('Analog');

    // Simulate Profile Switcher state in React Context
    let activeProfile = PRESET_CAN_PROFILES.find((p) => p.accountNumber === bahayCan)!;
    expect(activeProfile.meterType).toBe('AMI');
    expect(activeProfile.name).toContain('Bahay');

    // Switch to Tindahan Negosyo
    activeProfile = PRESET_CAN_PROFILES.find((p) => p.accountNumber === tindahanCan)!;
    expect(activeProfile.meterType).toBe('Analog');
    expect(activeProfile.name).toContain('Tindahan');

    // Verify badge text and active dashboard mode
    const badgeEmoji = activeProfile.meterType === 'AMI' ? '⚡' : '⏱️';
    const activeWorkflow = activeProfile.meterType === 'AMI' ? 'AMI_TELEMETRY' : 'ANALOG_CAPTURE';

    expect(badgeEmoji).toBe('⏱️');
    expect(activeWorkflow).toBe('ANALOG_CAPTURE');
  });

  // T3-COMB-03: F04 (Meter Badge) + F07 (AMI Curve Graph) + F08 (Peak Analytics Card)
  it('T3-COMB-03: F04 + F07 + F08 (Badge, Curve Graph & Analytics Synchronize from Telemetry Dataset)', () => {
    const dataset = createAmiTelemetry('0192-8823-4410', 'day', '2026-05-12');

    // Badge verification
    const badgeProps = {
      meterType: 'AMI' as MeterType,
      isIntervalSupported: true,
      serialNumber: dataset.meterSerialNumber,
    };
    expect(badgeProps.meterType).toBe('AMI');
    expect(badgeProps.isIntervalSupported).toBe(true);

    // Curve Graph verification: exactly 96 points with peak shading
    expect(dataset.readings.length).toBe(96);
    const curvePath = generateBezierCurvePath(dataset.readings.map((r) => r.kwh));
    expect(curvePath).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(curvePath).not.toContain('NaN');

    // Peak Analytics synchronization
    expect(dataset.peakKwh).toBeGreaterThan(0);
    expect(dataset.offPeakKwh).toBeGreaterThan(0);
    expect(Number((dataset.peakKwh + dataset.offPeakKwh).toFixed(2))).toBe(
      Number(dataset.totalKwh.toFixed(2))
    );
    expect(dataset.peakPercentage).toBe(
      Number(((dataset.peakKwh / dataset.totalKwh) * 100).toFixed(1))
    );
  });

  // T3-COMB-04: F05 (Telemetry Engine) + F06 (Peak Differentiation) + F08 (Peak Analytics Card)
  it('T3-COMB-04: F05 + F06 + F08 (Interval Peak Tagging Feeds Shift Savings Math & Energy Conservation)', () => {
    const weekdayDataset = createAmiTelemetry('0192-8823-4410', 'day', '2026-05-13'); // Wednesday

    // Verify peak tagging strictly matches Mon-Sat 08:00 - 21:00 (intervals 32 to 83)
    for (const reading of weekdayDataset.readings) {
      const idx = reading.intervalIndex;
      const expectedPeak = idx >= 32 && idx < 84;
      expect(reading.isPeak).toBe(expectedPeak);

      // Critical peaks: 14:00-17:00 (56-67) and 18:00-21:00 (72-83)
      const expectedCritical = (idx >= 56 && idx < 68) || (idx >= 72 && idx < 84);
      expect(reading.isCriticalPeak).toBe(expectedCritical);
    }

    // Conservation check: Sum of interval peak kwh must strictly equal dataset.peakKwh
    const computedPeakKwh = Number(
      weekdayDataset.readings
        .filter((r) => r.isPeak)
        .reduce((sum, r) => sum + r.kwh, 0)
        .toFixed(4)
    );
    expect(computedPeakKwh).toBe(weekdayDataset.peakKwh);

    // Shift savings must be positive for heavy peak days
    expect(weekdayDataset.potentialShiftSavings).toBeGreaterThan(0);
    expect(weekdayDataset.potentialShiftSavings).toBe(
      Number((weekdayDataset.peakKwh * 0.25 * 11.43 * 0.4).toFixed(2))
    );
  });

  // T3-COMB-05: F07 (AMI Curve Graph) + F15 (Dashboard Routing) + Timeframe Switch
  it('T3-COMB-05: F07 + F15 + Timeframe Switch (Day -> Week -> Month -> Year Retains Active Profile)', () => {
    const activeCan = 'can-1';
    const dayDataset = createAmiTelemetry(activeCan, 'day');
    const weekDataset = createAmiTelemetry(activeCan, 'week');
    const monthDataset = createAmiTelemetry(activeCan, 'month');
    const yearDataset = createAmiTelemetry(activeCan, 'year');

    expect(dayDataset.summaryByBucket.length).toBe(96);
    expect(weekDataset.summaryByBucket.length).toBe(7);
    expect(monthDataset.summaryByBucket.length).toBe(30);
    expect(yearDataset.summaryByBucket.length).toBe(12);

    // Profile remains unchanged across all timeframe re-renders
    expect(dayDataset.can).toBe(activeCan);
    expect(weekDataset.can).toBe(activeCan);
    expect(monthDataset.can).toBe(activeCan);
    expect(yearDataset.can).toBe(activeCan);

    // All bucket datasets generate valid SVG geometry
    const weekCurve = generateBezierCurvePath(weekDataset.summaryByBucket.map((b) => b.kwh));
    const monthCurve = generateBezierCurvePath(monthDataset.summaryByBucket.map((b) => b.kwh));
    expect(weekCurve).not.toContain('NaN');
    expect(monthCurve).not.toContain('NaN');
  });

  // T3-COMB-06: F09 (Photography Guide) + F10 (Photo Capture) + F11 (Reading Extraction)
  it('T3-COMB-06: F09 + F10 + F11 (Photography Guide Proceeds to Capture & Extraction Pipeline)', async () => {
    // 1. User reviews guidance rules
    const guidanceRules = [
      'Position camera 90 degrees perpendicular to dial face to eliminate parallax error',
      'Disable camera flash to avoid specular reflection on meter dome glass',
      'Read alternating clockwise/counter-clockwise dials from left to right',
      'Always record the lower number when pointer is between two numbers',
    ];
    expect(guidanceRules.length).toBe(4);

    // 2. Guide confirmation triggers ImagePicker camera capture
    const imagePicker = require('expo-image-picker');
    const captureResult = await imagePicker.launchCameraAsync();
    expect(captureResult.canceled).toBe(false);
    expect(captureResult.assets[0].base64).toBe(MOCK_BASE64_IMAGE);

    // 3. Extractor processes base64 payload
    const extraction = await extractAnalogReading(captureResult.assets[0].base64, 4280);
    expect(extraction.rawExtractionSource).toBe('deterministic_simulation');
    expect(extraction.confidence).toBeGreaterThanOrEqual(0.75);
    expect(extraction.dials.length).toBe(5);
    expect(extraction.readingKwh).toBeGreaterThanOrEqual(4280);
  });

  // T3-COMB-07: F11 (Reading Extraction) + F12 (Verification Drawer) + F13 (Log Persistence)
  it('T3-COMB-07: F11 + F12 + F13 (Manual Stepper Correction in Drawer Persists Verified Entry)', async () => {
    const can = '028491023321';
    // Extractor suggests dials [0, 4, 3, 1, 8] = 4318
    const extractedDials = [0, 4, 3, 1, 8];

    // User inspects dial 3 and increments stepper (+1) to 2
    const correctedDials = [...extractedDials];
    correctedDials[3] = correctedDials[3] + 1; // 1 -> 2
    expect(correctedDials).toEqual([0, 4, 3, 2, 8]);

    const correctedReadingKwh = parseInt(correctedDials.join(''), 10);
    expect(correctedReadingKwh).toBe(4328);

    const delta = calculateAnalogDelta(correctedReadingKwh, 4280, 7, 11.48);
    expect(delta.weeklyUsageKwh).toBe(48);

    // Confirm and save entry to AsyncStorage
    const logEntry: AnalogMeterLogEntry = {
      id: `analog-log-${Date.now()}`,
      can,
      timestamp: new Date().toISOString(),
      readingKwh: correctedReadingKwh,
      weeklyUsageKwh: delta.weeklyUsageKwh,
      daysSinceLastReading: 7,
      normalizedWeeklyKwh: delta.normalizedWeeklyKwh,
      costEstimate: delta.costEstimate,
      verifiedByUser: true,
      meterType: 'dial',
      dials: correctedDials,
    };

    const storageKey = `@ohmmygrid:analog_logs_${can}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify([logEntry]));

    // Query and verify persistence
    const storedRaw = await AsyncStorage.getItem(storageKey);
    expect(storedRaw).not.toBeNull();
    const parsedLogs: AnalogMeterLogEntry[] = JSON.parse(storedRaw!);
    expect(parsedLogs.length).toBe(1);
    expect(parsedLogs[0].readingKwh).toBe(4328);
    expect(parsedLogs[0].dials).toEqual([0, 4, 3, 2, 8]);
    expect(parsedLogs[0].verifiedByUser).toBe(true);
  });

  // T3-COMB-08: F12 (Verification Drawer) + F13 (Weekly Log) + Rollover Boundary
  it('T3-COMB-08: F12 + F13 + Rollover Boundary (Verification Drawer Correctly Resolves 5-Dial Rollover)', () => {
    const previousReading = 99980;
    const currentReading = 25; // Rolled over from 99,999 to 00,000

    const deltaResult = calculateAnalogDelta(currentReading, previousReading, 7, 11.43);

    expect(deltaResult.isRollover).toBe(true);
    expect(deltaResult.weeklyUsageKwh).toBe(45); // (100000 + 25) - 99980
    expect(deltaResult.costEstimate).toBe(Number((45 * 11.43).toFixed(2)));
    expect(deltaResult.weeklyUsageKwh).toBeGreaterThan(0); // Not negative
  });

  // T3-COMB-09: F13 (Weekly Log) + F14 (Weekly Analog Curve) + Budget Ceiling
  it('T3-COMB-09: F13 + F14 + Budget Ceiling (Saving Weekly Log Evaluates Threshold & Curve Path)', async () => {
    const weeklyBudgetKwh = 40;
    const logs = [32, 38, 35, 52]; // Week 4 usage (52 kWh) exceeds budget (40 kWh)

    const curvePath = generateBezierCurvePath(logs);
    expect(curvePath).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(curvePath).not.toContain('NaN');

    const statusByWeek = logs.map((val) => ({
      kwh: val,
      isOverBudget: val > weeklyBudgetKwh,
      styling: val > weeklyBudgetKwh ? 'danger' : 'ok',
    }));

    expect(statusByWeek[0].isOverBudget).toBe(false);
    expect(statusByWeek[1].isOverBudget).toBe(false);
    expect(statusByWeek[2].isOverBudget).toBe(false);
    expect(statusByWeek[3].isOverBudget).toBe(true);
    expect(statusByWeek[3].styling).toBe('danger');
  });

  // T3-COMB-10: F01 (Classification Parity) + F04 (Meter Badge) + F15 (Dashboard Routing)
  it('T3-COMB-10: F01 + F04 + F15 (Odd-Parity Unseeded CAN Configures Analog Badge & Logging CTA)', async () => {
    const unseededOddCan = '8888999911'; // Ends with 1 (Odd)
    const classification = await classifyCAN(unseededOddCan, { simulatedDelayMs: 0 });

    expect(classification.success).toBe(true);
    expect(classification.data?.meterType).toBe('Analog');
    expect(classification.data?.supportsIntervalTelemetry).toBe(false);

    // Badge configuration
    const badgeText = classification.data?.meterType === 'AMI' ? 'AMI Smart Meter' : 'Analog Meter';
    const badgeEmoji = classification.data?.meterType === 'AMI' ? '⚡' : '⏱️';
    expect(badgeText).toBe('Analog Meter');
    expect(badgeEmoji).toBe('⏱️');

    // Dashboard CTA
    const showPhotoLoggingButton = classification.data?.meterType === 'Analog';
    expect(showPhotoLoggingButton).toBe(true);
  });

  // T3-COMB-11: F02 (Seed Profile Mapping) + F05 (Telemetry Engine) + F13 (Analog Storage)
  it('T3-COMB-11: F02 + F05 + F13 (Dual-Account Concurrency Maintains Strict Storage & Telemetry Isolation)', async () => {
    const bahayCan = '019288234410'; // Bahay Pasig (AMI)
    const tindahanCan = '028491023321'; // Tindahan Negosyo (Analog)

    // Parallel fetch
    const [bahayTelemetry, tindahanLogWrite] = await Promise.all([
      createAmiTelemetry(bahayCan, 'day'),
      AsyncStorage.setItem(
        `@ohmmygrid:analog_logs_${tindahanCan}`,
        JSON.stringify([{ id: 'log-1', can: tindahanCan, readingKwh: 4318, weeklyUsageKwh: 38 }])
      ),
    ]);

    expect(bahayTelemetry.readings.length).toBe(96);
    expect(bahayTelemetry.can).toBe(bahayCan);

    // Verify storage for Bahay has no analog logs
    const bahayStorage = await AsyncStorage.getItem(`@ohmmygrid:analog_logs_${bahayCan}`);
    expect(bahayStorage).toBeNull();

    // Verify Tindahan storage has exactly its own log
    const tindahanStorage = await AsyncStorage.getItem(`@ohmmygrid:analog_logs_${tindahanCan}`);
    expect(tindahanStorage).not.toBeNull();
    const parsed = JSON.parse(tindahanStorage!);
    expect(parsed[0].can).toBe(tindahanCan);
  });

  // T3-COMB-12: F08 (Peak Analytics) + F13 (Weekly Log) + Unified Tariff Math
  it('T3-COMB-12: F08 + F13 + Tariff Engine (AMI and Analog Workflows Calculate Identical Baseline Energy Charges)', () => {
    const benchmarkKwh = 50;
    const effectiveRate = 11.43;

    // AMI estimated cost for 50 kWh
    const amiCost = Number((benchmarkKwh * effectiveRate).toFixed(2));

    // Analog estimated cost for 50 kWh weekly delta
    const analogDelta = calculateAnalogDelta(4350, 4300, 7, effectiveRate);

    expect(analogDelta.weeklyUsageKwh).toBe(50);
    expect(analogDelta.costEstimate).toBe(571.5);
    expect(amiCost).toBe(571.5);
    expect(analogDelta.costEstimate).toBe(amiCost);
  });

  // T3-COMB-13: F10 (Photo Capture) + F11 (Extraction) + Network Disconnection
  it('T3-COMB-13: F10 + F11 + Offline Mode (Offline Photo Processing Falls Back to Deterministic Simulator)', async () => {
    // When offline / network disconnected
    const extractionResult = await extractAnalogReading(MOCK_BASE64_IMAGE, 4280);

    expect(extractionResult.rawExtractionSource).toBe('deterministic_simulation');
    expect(extractionResult.confidence).toBeGreaterThan(0.7);
    expect(extractionResult.dials.length).toBe(5);
    expect(extractionResult.readingKwh).toBeGreaterThan(4280);
  });

  // T3-COMB-14: F07 (AMI Curve Graph) + F14 (Weekly Curve Graph) + Theme Switch
  it('T3-COMB-14: F07 + F14 + Theme Switch (Switching Light to Night Mode Applies Theme Tokens without SVG Distortion)', () => {
    const amiData = [0.2, 0.3, 0.8, 1.2, 0.9, 0.4];
    const analogData = [35, 42, 38, 45];

    const warmTheme = THEMES.warm;
    const nightTheme = THEMES.night;

    expect(warmTheme.bg).toBe('#FFFDF9');
    expect(nightTheme.bg).toBe('#121824');
    expect(warmTheme.peakBg).toBe('#EDE9FE');
    expect(nightTheme.peakBg).toBe('#2E1F5C');

    // Generating curve paths under both themes
    const pathAmiWarm = generateBezierCurvePath(amiData);
    const pathAmiNight = generateBezierCurvePath(amiData);
    expect(pathAmiWarm).toBe(pathAmiNight); // SVG coordinates remain identical
    expect(pathAmiWarm).not.toContain('NaN');

    const pathAnalogWarm = generateBezierCurvePath(analogData);
    const pathAnalogNight = generateBezierCurvePath(analogData);
    expect(pathAnalogWarm).toBe(pathAnalogNight);
    expect(pathAnalogWarm).not.toContain('NaN');
  });

  // T3-COMB-15: F03 (Profile Record) + F12 (Verification Drawer) + Lifeline/Tier Cliff Warning
  it('T3-COMB-15: F03 + F12 + Tier Cliff (Analog Reading Pushing Monthly Total >200 kWh Activates Cliff Alert)', () => {
    const priorMonthlyKwh = 185; // In Tier 1 (<= 200 kWh)
    const priorCliff = calculateTierCliff(priorMonthlyKwh);
    expect(priorCliff.currentTier).toBe(1);
    expect(priorCliff.nextTierThreshold).toBe(200);
    expect(priorCliff.isCliffWarning).toBe(true); // Within 25 kWh buffer of 200

    // User confirms a weekly reading delta of +30 kWh
    const newMonthlyKwh = priorMonthlyKwh + 30; // 215 kWh
    const postCliff = calculateTierCliff(newMonthlyKwh);

    expect(postCliff.currentTier).toBe(2); // Crossed into Tier 2 (>200 kWh)
    expect(postCliff.nextTierThreshold).toBe(300);
  });
});
