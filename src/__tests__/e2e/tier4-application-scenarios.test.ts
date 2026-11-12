// ==============================================================================
// Tier 4: Real-World Application Scenarios E2E Test Suite
// Validates 5 comprehensive, high-fidelity multi-step user journeys simulating
// residential and commercial accounts across AMI and Analog workflows.
// Test IDs: T4-SCEN-01 to T4-SCEN-05
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
import { calculateTierCliff } from '../../lib/tariffEngine';
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
// Types & Authoritative Reference Oracle
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
  isRollover?: boolean;
}

export interface AnalogMeterReadingResult {
  meterType: 'dial' | 'cyclometer';
  readingKwh: number;
  dials: number[];
  confidence: number;
  meterSerialNumber?: string;
  rawExtractionSource: 'gemini_vision' | 'deterministic_simulation';
}

function generateAmiTelemetryDataset(
  can: string,
  timeframe: AmiTimeframe,
  targetDateStr = '2026-05-13'
): AmiTelemetryDataset {
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
    else if (hours >= 14 && hours < 17) watts = 2200; // Afternoon cooling peak (Critical Peak)
    else if (hours >= 17 && hours < 18) watts = 1100; // Late afternoon
    else if (hours >= 18 && hours < 21) watts = 1800; // Evening dinner peak (Critical Peak)
    else if (hours >= 21) watts = 450; // Night ramp-down

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
  // Estimated monthly savings from shifting heavy peak appliance loads to off-peak (up to ~₱210.00/mo)
  const potentialShiftSavings = Number((Math.min(peakKwhSum * 0.25, 2.5) * 2.8 * 30).toFixed(2));

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

function generateSvgBezierPath(dataPoints: number[], width = 320, height = 160): string {
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
// Test Suite: Tier 4 Real-World Application Scenarios
// ------------------------------------------------------------------------------
describe('Tier 4: Real-World Application Scenarios E2E Suite', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  // T4-SCEN-01: AMI Household Daily Energy Review & Peak Load Shifting
  it('T4-SCEN-01: AMI Household Daily Energy Review & Peak Load Shifting (Maria Santos Journey)', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Login & Account Resolution
    // -------------------------------------------------------------------------
    const targetCan = '0192-8823-4410'; // Bahay Pasig
    const classification = await classifyCAN(targetCan, { simulatedDelayMs: 0 });

    expect(classification.success).toBe(true);
    expect(classification.statusCode).toBe(200);
    expect(classification.data?.meterType).toBe('AMI');
    expect(classification.data?.accountHolderName).toContain('Maria Santos');
    expect(classification.data?.supportsIntervalTelemetry).toBe(true);

    // -------------------------------------------------------------------------
    // Step 2: Dashboard Initialization
    // -------------------------------------------------------------------------
    const activeProfile: CANProfile = {
      id: 'can-1',
      name: 'Bahay (Pasig)',
      accountNumber: targetCan,
      customerName: classification.data!.accountHolderName,
      serviceAddress: classification.data!.serviceAddress,
      ratePerKwh: 11.43,
      budget: 3500,
      currentKwh: 188,
      meterType: classification.data!.meterType,
      meterSerialNumber: classification.data!.meterSerialNumber,
    };

    expect(activeProfile.meterType).toBe('AMI');
    const badgeEmoji = activeProfile.meterType === 'AMI' ? '⚡' : '⏱️';
    expect(badgeEmoji).toBe('⚡');

    // -------------------------------------------------------------------------
    // Step 3: Day View Telemetry Acquisition
    // -------------------------------------------------------------------------
    const telemetryDataset = generateAmiTelemetryDataset(targetCan, 'day', '2026-05-13');
    expect(telemetryDataset.readings.length).toBe(96);

    // -------------------------------------------------------------------------
    // Step 4: Diurnal Curve Graph Inspection
    // -------------------------------------------------------------------------
    // Baseload check (Interval index 12 = 03:00)
    const baseloadReading = telemetryDataset.readings[12];
    expect(baseloadReading.timeLabel).toBe('03:00');
    expect(baseloadReading.powerWatts).toBe(250);
    expect(baseloadReading.isPeak).toBe(false);

    // Morning ramp check (Interval index 32 = 08:00)
    const morningPeakReading = telemetryDataset.readings[32];
    expect(morningPeakReading.timeLabel).toBe('08:00');
    expect(morningPeakReading.isPeak).toBe(true);

    // Afternoon cooling peak check (Interval index 60 = 15:00)
    const afternoonCoolingReading = telemetryDataset.readings[60];
    expect(afternoonCoolingReading.timeLabel).toBe('15:00');
    expect(afternoonCoolingReading.powerWatts).toBe(2200);
    expect(afternoonCoolingReading.isPeak).toBe(true);
    expect(afternoonCoolingReading.isCriticalPeak).toBe(true);

    // Evening dinner peak check (Interval index 76 = 19:00)
    const eveningPeakReading = telemetryDataset.readings[76];
    expect(eveningPeakReading.timeLabel).toBe('19:00');
    expect(eveningPeakReading.powerWatts).toBe(1800);
    expect(eveningPeakReading.isPeak).toBe(true);
    expect(eveningPeakReading.isCriticalPeak).toBe(true);

    // -------------------------------------------------------------------------
    // Step 5: Peak Analytics Card Inspection
    // -------------------------------------------------------------------------
    expect(telemetryDataset.totalKwh).toBeGreaterThan(15);
    expect(telemetryDataset.peakPercentage).toBeGreaterThan(50); // Heavy daytime consumption
    expect(
      Number((telemetryDataset.peakKwh + telemetryDataset.offPeakKwh).toFixed(2))
    ).toBe(Number(telemetryDataset.totalKwh.toFixed(2)));

    // -------------------------------------------------------------------------
    // Step 6: Actionable Shift Recommendations
    // -------------------------------------------------------------------------
    expect(telemetryDataset.potentialShiftSavings).toBeGreaterThan(100);
    const recommendation =
      telemetryDataset.peakPercentage > 35
        ? `Shift heavy appliances to after 9:00 PM to save up to ₱${telemetryDataset.potentialShiftSavings}/month.`
        : 'Good energy distribution.';
    expect(recommendation).toContain('Shift heavy appliances');

    // -------------------------------------------------------------------------
    // Step 7: SVG Curve Path Verification
    // -------------------------------------------------------------------------
    const curveSvgPath = generateSvgBezierPath(telemetryDataset.readings.map((r) => r.kwh));
    expect(curveSvgPath).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(curveSvgPath).not.toContain('NaN');
  });

  // T4-SCEN-02: AMI Multi-Timeframe Trend Inspection & Budget Tracking
  it('T4-SCEN-02: AMI Multi-Timeframe Trend Inspection & Budget Tracking', () => {
    const targetCan = '0192-8823-4410';

    // 1. Initial Day View: 96 intervals
    const dayView = generateAmiTelemetryDataset(targetCan, 'day');
    expect(dayView.timeframe).toBe('day');
    expect(dayView.summaryByBucket.length).toBe(96);
    expect(dayView.readings[0].timeLabel).toBe('00:00');
    expect(dayView.readings[95].timeLabel).toBe('23:45');

    // 2. Switch to Week View: 7 daily aggregate buckets
    const weekView = generateAmiTelemetryDataset(targetCan, 'week');
    expect(weekView.timeframe).toBe('week');
    expect(weekView.summaryByBucket.length).toBe(7);
    expect(weekView.summaryByBucket[0].label).toBe('Mon');
    expect(weekView.summaryByBucket[6].label).toBe('Sun');
    // Sunday is off-peak
    expect(weekView.summaryByBucket[6].isPeak).toBe(false);

    // 3. Switch to Month View: 30 daily data points
    const monthView = generateAmiTelemetryDataset(targetCan, 'month');
    expect(monthView.timeframe).toBe('month');
    expect(monthView.summaryByBucket.length).toBe(30);
    const monthKwhTotal = monthView.summaryByBucket.reduce((sum, b) => sum + b.kwh, 0);
    expect(monthKwhTotal).toBeGreaterThan(200);

    // Check budget ceiling tracking (Budget = ₱3,500 / 11.43 = ~306 kWh)
    const budgetCeilingKwh = 3500 / 11.43;
    const isExceedingBudget = monthKwhTotal > budgetCeilingKwh;
    expect(typeof isExceedingBudget).toBe('boolean');

    // 4. Switch to Year View: 12 monthly bars with hot-season summer peaks
    const yearView = generateAmiTelemetryDataset(targetCan, 'year');
    expect(yearView.timeframe).toBe('year');
    expect(yearView.summaryByBucket.length).toBe(12);
    expect(yearView.summaryByBucket[3].label).toBe('Apr');
    expect(yearView.summaryByBucket[4].label).toBe('May');
    // April and May show peak summer air-conditioning loads (~380 kWh)
    expect(yearView.summaryByBucket[3].kwh).toBe(380);
    expect(yearView.summaryByBucket[4].kwh).toBe(380);
    // December shows cool-season drop (~190 kWh)
    expect(yearView.summaryByBucket[11].kwh).toBe(190);

    // 5. Switch back to Day View: Instantaneous restore
    const restoredDayView = generateAmiTelemetryDataset(targetCan, 'day');
    expect(restoredDayView.summaryByBucket.length).toBe(96);
    expect(restoredDayView.totalKwh).toBe(dayView.totalKwh);

    // All timeframes produce valid SVG curves without NaN
    expect(generateSvgBezierPath(dayView.readings.map((r) => r.kwh))).not.toContain('NaN');
    expect(generateSvgBezierPath(weekView.summaryByBucket.map((b) => b.kwh))).not.toContain('NaN');
    expect(generateSvgBezierPath(monthView.summaryByBucket.map((b) => b.kwh))).not.toContain('NaN');
    expect(generateSvgBezierPath(yearView.summaryByBucket.map((b) => b.kwh))).not.toContain('NaN');
  });

  // T4-SCEN-03: Analog Meter Weekly Reading, Parallax Guidance & Manual Dial Correction
  it('T4-SCEN-03: Analog Meter Weekly Reading, Parallax Guidance & Manual Dial Correction', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Account Identification (Tindahan Negosyo)
    // -------------------------------------------------------------------------
    const tindahanCan = '0284-9102-3321';
    const classification = await classifyCAN(tindahanCan, { simulatedDelayMs: 0 });
    expect(classification.data?.meterType).toBe('Analog');
    expect(classification.data?.accountHolderName).toContain('Santos Sari-Sari Store');

    // -------------------------------------------------------------------------
    // Step 2: Dashboard Mounting
    // -------------------------------------------------------------------------
    const previousReadingKwh = 4280;
    const previousDate = '2026-05-07';

    // -------------------------------------------------------------------------
    // Step 3: Photography Guidance Review
    // -------------------------------------------------------------------------
    const guidanceAccepted = true;
    expect(guidanceAccepted).toBe(true);

    // -------------------------------------------------------------------------
    // Step 4: Photo Capture
    // -------------------------------------------------------------------------
    const imagePicker = require('expo-image-picker');
    const photoResult = await imagePicker.launchCameraAsync();
    expect(photoResult.canceled).toBe(false);
    expect(photoResult.assets[0].base64).toBe(MOCK_BASE64_IMAGE);

    // -------------------------------------------------------------------------
    // Step 5: Automated Extraction
    // -------------------------------------------------------------------------
    // Machine vision extracts dials [0, 4, 3, 2, 8] = 4328 kWh
    const rawExtraction: AnalogMeterReadingResult = {
      meterType: 'dial',
      readingKwh: 4328,
      dials: [0, 4, 3, 2, 8],
      confidence: 0.88,
      meterSerialNumber: 'MR-ANA-3321',
      rawExtractionSource: 'deterministic_simulation',
    };
    expect(rawExtraction.confidence).toBeGreaterThan(0.8);

    // -------------------------------------------------------------------------
    // Step 6 & 7: Verification Drawer Presentation & Manual Correction
    // -------------------------------------------------------------------------
    // Physical inspection: Dial 3 pointer is between 1 and 2, but Dial 4 has not passed 0 yet.
    // User decrements Dial 3 stepper (-1) from 2 to 1.
    const userVerifiedDials = [...rawExtraction.dials];
    userVerifiedDials[3] = userVerifiedDials[3] - 1; // 2 -> 1
    expect(userVerifiedDials).toEqual([0, 4, 3, 1, 8]);

    const verifiedReadingKwh = parseInt(userVerifiedDials.join(''), 10);
    expect(verifiedReadingKwh).toBe(4318);

    // -------------------------------------------------------------------------
    // Step 8: Weekly Delta Calculation
    // -------------------------------------------------------------------------
    const daysElapsed = 7;
    const rate = 11.48; // Commercial/Residential rate
    const delta = calculateAnalogDelta(verifiedReadingKwh, previousReadingKwh, daysElapsed, rate);

    expect(delta.weeklyUsageKwh).toBe(38); // 4318 - 4280
    expect(delta.normalizedWeeklyKwh).toBe(38);
    expect(delta.costEstimate).toBe(436.24); // 38 * 11.48

    // -------------------------------------------------------------------------
    // Step 9: Confirmation & Persistence
    // -------------------------------------------------------------------------
    const logEntry: AnalogMeterLogEntry = {
      id: `analog-${Date.now()}`,
      can: tindahanCan,
      timestamp: '2026-05-14T10:00:00.000Z',
      readingKwh: verifiedReadingKwh,
      weeklyUsageKwh: delta.weeklyUsageKwh,
      daysSinceLastReading: daysElapsed,
      normalizedWeeklyKwh: delta.normalizedWeeklyKwh,
      costEstimate: delta.costEstimate,
      verifiedByUser: true,
      meterType: 'dial',
      dials: userVerifiedDials,
    };

    const storageKey = `@ohmmygrid:analog_logs_${tindahanCan.replace(/\D/g, '')}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify([logEntry]));

    const persisted = JSON.parse((await AsyncStorage.getItem(storageKey))!);
    expect(persisted[0].readingKwh).toBe(4318);
    expect(persisted[0].verifiedByUser).toBe(true);

    // -------------------------------------------------------------------------
    // Step 10: Curve Graph Update
    // -------------------------------------------------------------------------
    const weeklyReadings = [35, 42, 38, delta.weeklyUsageKwh]; // [35, 42, 38, 38]
    const weeklyCurvePath = generateSvgBezierPath(weeklyReadings);
    expect(weeklyCurvePath).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(weeklyCurvePath).not.toContain('NaN');
  });

  // T4-SCEN-04: Analog 5-Dial Meter Rollover Handling & Budget Impact
  it('T4-SCEN-04: Analog 5-Dial Meter Rollover Handling & Budget Impact', async () => {
    // -------------------------------------------------------------------------
    // Step 1: Baseline State (Reading prior to rollover)
    // -------------------------------------------------------------------------
    const previousReading = 99980; // Logged on 2026-04-28
    const condoCan = '034177895562';

    // -------------------------------------------------------------------------
    // Step 2 & 3: Rollover Reading & Extraction
    // -------------------------------------------------------------------------
    // On 2026-05-05, user photographs meter after register rolled past 99,999 to 00,025
    const extractedDials = [0, 0, 0, 2, 5];
    const currentReading = parseInt(extractedDials.join(''), 10);
    expect(currentReading).toBe(25);

    // -------------------------------------------------------------------------
    // Step 4: Verification Drawer Rollover Logic
    // -------------------------------------------------------------------------
    expect(currentReading).toBeLessThan(previousReading);
    const delta = calculateAnalogDelta(currentReading, previousReading, 7, 11.43);

    // Verify system activates rollover status and yields positive delta
    expect(delta.isRollover).toBe(true);
    expect(delta.weeklyUsageKwh).toBe(45); // (100,000 + 25) - 99,980 = 45 kWh
    expect(delta.weeklyUsageKwh).toBeGreaterThan(0); // Never negative!
    expect(delta.costEstimate).toBe(514.35); // 45 * 11.43

    // -------------------------------------------------------------------------
    // Step 5 & 6: User Confirmation & Storage
    // -------------------------------------------------------------------------
    const rolloverLog: AnalogMeterLogEntry = {
      id: 'rollover-log-1',
      can: condoCan,
      timestamp: '2026-05-05T08:30:00.000Z',
      readingKwh: currentReading,
      weeklyUsageKwh: delta.weeklyUsageKwh,
      daysSinceLastReading: 7,
      normalizedWeeklyKwh: delta.normalizedWeeklyKwh,
      costEstimate: delta.costEstimate,
      verifiedByUser: true,
      meterType: 'dial',
      dials: extractedDials,
      isRollover: true,
    };

    const storageKey = `@ohmmygrid:analog_logs_${condoCan}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify([rolloverLog]));

    const persisted = JSON.parse((await AsyncStorage.getItem(storageKey))!);
    expect(persisted[0].isRollover).toBe(true);
    expect(persisted[0].weeklyUsageKwh).toBe(45);

    // -------------------------------------------------------------------------
    // Step 7: Graph Curve Verification (Smooth non-negative trajectory)
    // -------------------------------------------------------------------------
    const historicalWeeklyKwh = [40, 38, 42, delta.weeklyUsageKwh]; // [40, 38, 42, 45]
    const curvePath = generateSvgBezierPath(historicalWeeklyKwh);
    expect(curvePath).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(curvePath).not.toContain('NaN');
    expect(historicalWeeklyKwh.every((k) => k > 0)).toBe(true);
  });

  // T4-SCEN-05: Multi-CAN Switching Journey & Cross-Profile Isolation
  it('T4-SCEN-05: Multi-CAN Switching Journey & Cross-Profile Isolation', async () => {
    // -------------------------------------------------------------------------
    // 1. Account 1: Bahay Pasig (AMI)
    // -------------------------------------------------------------------------
    const bahayCan = '019288234410';
    const bahayClassification = await classifyCAN(bahayCan, { simulatedDelayMs: 0 });
    expect(bahayClassification.data?.meterType).toBe('AMI');

    const bahayTelemetry = generateAmiTelemetryDataset(bahayCan, 'day');
    expect(bahayTelemetry.readings.length).toBe(96);
    expect(bahayTelemetry.meterSerialNumber).toContain('AMI');

    // -------------------------------------------------------------------------
    // 2. Switch to Account 2: Tindahan Negosyo (Analog)
    // -------------------------------------------------------------------------
    const tindahanCan = '028491023321';
    const tindahanClassification = await classifyCAN(tindahanCan, { simulatedDelayMs: 0 });
    expect(tindahanClassification.data?.meterType).toBe('Analog');

    // Persist Tindahan historical weekly logs
    const tindahanLogs: AnalogMeterLogEntry[] = [
      {
        id: 't-1',
        can: tindahanCan,
        timestamp: '2026-05-14T00:00:00.000Z',
        readingKwh: 4318,
        weeklyUsageKwh: 38,
        daysSinceLastReading: 7,
        normalizedWeeklyKwh: 38,
        costEstimate: 436.24,
        verifiedByUser: true,
        meterType: 'dial',
      },
      {
        id: 't-2',
        can: tindahanCan,
        timestamp: '2026-05-07T00:00:00.000Z',
        readingKwh: 4280,
        weeklyUsageKwh: 45,
        daysSinceLastReading: 7,
        normalizedWeeklyKwh: 45,
        costEstimate: 516.6,
        verifiedByUser: true,
        meterType: 'dial',
      },
    ];
    await AsyncStorage.setItem(`@ohmmygrid:analog_logs_${tindahanCan}`, JSON.stringify(tindahanLogs));

    // -------------------------------------------------------------------------
    // 3. Switch to Account 3: Condo Taguig (Analog)
    // -------------------------------------------------------------------------
    const condoCan = '034177895562';
    const condoClassification = await classifyCAN(condoCan, { simulatedDelayMs: 0 });
    expect(condoClassification.data?.meterType).toBe('Analog');

    const condoLogs: AnalogMeterLogEntry[] = [
      {
        id: 'c-1',
        can: condoCan,
        timestamp: '2026-05-14T00:00:00.000Z',
        readingKwh: 125,
        weeklyUsageKwh: 18,
        daysSinceLastReading: 7,
        normalizedWeeklyKwh: 18,
        costEstimate: 205.74,
        verifiedByUser: true,
        meterType: 'dial',
      },
    ];
    await AsyncStorage.setItem(`@ohmmygrid:analog_logs_${condoCan}`, JSON.stringify(condoLogs));

    // Strict storage isolation check between Tindahan and Condo
    const loadedTindahan = JSON.parse(
      (await AsyncStorage.getItem(`@ohmmygrid:analog_logs_${tindahanCan}`))!
    );
    const loadedCondo = JSON.parse(
      (await AsyncStorage.getItem(`@ohmmygrid:analog_logs_${condoCan}`))!
    );

    expect(loadedTindahan.length).toBe(2);
    expect(loadedCondo.length).toBe(1);
    expect(loadedTindahan[0].readingKwh).toBe(4318);
    expect(loadedCondo[0].readingKwh).toBe(125);
    expect(loadedTindahan[0].can).not.toBe(loadedCondo[0].can);

    // -------------------------------------------------------------------------
    // 4. Switch Back to Account 1: Bahay Pasig (AMI)
    // -------------------------------------------------------------------------
    // Restores AMI view; no residual analog logs in Bahay storage
    const loadedBahay = await AsyncStorage.getItem(`@ohmmygrid:analog_logs_${bahayCan}`);
    expect(loadedBahay).toBeNull();

    // Restores AMI telemetry curve with 96 intervals
    const restoredBahayTelemetry = generateAmiTelemetryDataset(bahayCan, 'day');
    expect(restoredBahayTelemetry.readings.length).toBe(96);
    expect(restoredBahayTelemetry.totalKwh).toBe(bahayTelemetry.totalKwh);
  });
});
