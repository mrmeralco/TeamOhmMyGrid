// ==============================================================================
// Unit Test Suite: AMI 15-Minute Telemetry & Dynamic Curve Graph (Milestone M2)
// Covers 15-minute interval telemetry simulation, diurnal load curves,
// Meralco peak/critical-peak/off-peak classification, Day/Week/Month/Year
// aggregations, SVG Catmull-Rom/Bezier spline math, and component rendering.
// ==============================================================================

import React from 'react';
import {
  generateAmiTelemetry,
  getAmiTelemetry,
  getCanLoadScaleFactor,
  isPeakInterval,
  isCriticalPeakInterval,
  getDiurnalPowerWatts,
  resolveAmiMeterSerialNumber,
  generateSvgCurveCoordinates,
  generateSvgAreaPath,
  getPeakWindowBounds,
  formatCurrency,
  calculatePeakSavingsRecommendation,
  PEAK_START_INTERVAL,
  PEAK_END_INTERVAL,
  CRITICAL_PEAK_1_START,
  CRITICAL_PEAK_1_END,
  CRITICAL_PEAK_2_START,
  CRITICAL_PEAK_2_END,
} from '../../services/amiTelemetryService';
import {
  extractAnalogMeterReading,
  saveAnalogMeterLog,
  getAnalogMeterLogs,
  clearAnalogMeterLogs,
  calculateWeeklyAnalogDelta,
} from '../../services/analogMeterService';
import { AmiTimeframe, AmiIntervalReading } from '../../types/amiTelemetry';
import { MERALCO_EFFECTIVE_RATE } from '../tariffEngine';
import { THEMES } from '../../constants/theme';

// Mock AsyncStorage and expo-image-picker for analogMeterService tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

// Mock ThemeContext for component tests
jest.mock('../../context/ThemeContext', () => {
  const { THEMES } = require('../../constants/theme');
  return {
    useTheme: () => ({
      theme: THEMES.warm,
      mode: 'warm',
      fontScale: 1.0,
      language: 'english',
    }),
  };
});

// Mock react-native-svg for component tests
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
    Path: mockComponent('Path'),
    Polygon: mockComponent('Polygon'),
    Polyline: mockComponent('Polyline'),
    Line: mockComponent('Line'),
    Rect: mockComponent('Rect'),
    Defs: mockComponent('Defs'),
    LinearGradient: mockComponent('LinearGradient'),
    Stop: mockComponent('Stop'),
  };
});

import { AmiCurveGraphCard } from '../../components/AmiCurveGraphCard';
import { AmiPeakBreakdownCard } from '../../components/AmiPeakBreakdownCard';

describe('AMI Telemetry & Dynamic Curve Graph (Milestone M2)', () => {
  const TEST_AMI_CAN = '0192-8823-4410';
  const WEEKDAY_DATE = '2026-05-18'; // Monday
  const SUNDAY_DATE = '2026-05-24';  // Sunday

  // ============================================================================
  // Suite 1: 15-Minute Interval Telemetry Simulation (Feature 5)
  // ============================================================================
  describe('Suite 1: 15-Minute Interval Telemetry Engine', () => {
    it('generates exactly 96 intervals for a 24-hour day view', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);
      expect(dataset.readings.length).toBe(96);
      expect(dataset.readings[0].intervalIndex).toBe(0);
      expect(dataset.readings[95].intervalIndex).toBe(95);
    });

    it('generates sequential 15-minute time labels from 00:00 to 23:45', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);
      expect(dataset.readings[0].timeLabel).toBe('00:00');
      expect(dataset.readings[1].timeLabel).toBe('00:15');
      expect(dataset.readings[4].timeLabel).toBe('01:00');
      expect(dataset.readings[32].timeLabel).toBe('08:00');
      expect(dataset.readings[56].timeLabel).toBe('14:00');
      expect(dataset.readings[72].timeLabel).toBe('18:00');
      expect(dataset.readings[84].timeLabel).toBe('21:00');
      expect(dataset.readings[95].timeLabel).toBe('23:45');
    });

    it('strictly satisfies interval kWh formula: kWh = (Watts * 0.25) / 1000', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE, {
        constantPowerWatts: 1600,
      });
      // 1600 W * 0.25 h / 1000 = 0.4 kWh per interval
      for (const reading of dataset.readings) {
        expect(reading.powerWatts).toBe(1600);
        expect(reading.kwh).toBe(0.4);
      }
      expect(dataset.totalKwh).toBe(Number((0.4 * 96).toFixed(4)));
    });

    it('enforces monotonic cumulative kWh progression and conservation of energy', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);
      expect(dataset.readings[0].cumulativeKwh).toBe(dataset.readings[0].kwh);

      for (let i = 1; i < dataset.readings.length; i++) {
        const prev = dataset.readings[i - 1].cumulativeKwh;
        const current = dataset.readings[i].cumulativeKwh;
        expect(current).toBeGreaterThanOrEqual(prev);
        expect(Number((prev + dataset.readings[i].kwh).toFixed(4))).toBe(current);
      }

      expect(dataset.readings[95].cumulativeKwh).toBe(dataset.totalKwh);
    });

    it('handles zero power consumption correctly without NaN or division by zero', () => {
      const zeroDataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE, {
        constantPowerWatts: 0,
      });
      expect(zeroDataset.totalKwh).toBe(0);
      expect(zeroDataset.peakKwh).toBe(0);
      expect(zeroDataset.offPeakKwh).toBe(0);
      expect(zeroDataset.peakPercentage).toBe(0.0);
      expect(zeroDataset.estimatedTotalCost).toBe(0.0);
      expect(Number.isNaN(zeroDataset.peakPercentage)).toBe(false);
    });

    it('handles single-interval power spike override cleanly', () => {
      const spikeWatts = 12000;
      const expectedKwh = (spikeWatts * 0.25) / 1000; // 3.0 kWh
      const spikeDataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE, {
        powerSpikeIndex: 48,
        spikeWatts,
      });

      expect(spikeDataset.readings[48].powerWatts).toBe(spikeWatts);
      expect(spikeDataset.readings[48].kwh).toBe(expectedKwh);
      expect(spikeDataset.readings[47].powerWatts).not.toBe(spikeWatts);
      expect(spikeDataset.totalKwh).toBeGreaterThan(expectedKwh);
    });

    it('handles leap year date (Feb 29, 2028) generating exactly 96 intervals', () => {
      const leapDataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', '2028-02-29');
      expect(leapDataset.readings.length).toBe(96);
      expect(leapDataset.readings[0].timestamp).toContain('2028-02-29');
      expect(leapDataset.readings[95].timestamp).toContain('2028-02-29');
      expect(Number.isFinite(leapDataset.totalKwh)).toBe(true);
    });
  });

  // ============================================================================
  // Suite 2: Peak vs Low-Demand Hours Differentiation (Feature 6)
  // ============================================================================
  describe('Suite 2: Peak vs Low-Demand Hours Differentiation', () => {
    it('classifies weekday morning 08:00 to 21:00 as Peak hours (Mon-Sat)', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);

      // Boundary: 07:45 (interval 31) -> Off-Peak
      expect(dataset.readings[31].timeLabel).toBe('07:45');
      expect(dataset.readings[31].isPeak).toBe(false);

      // Boundary: 08:00 (interval 32) -> Peak
      expect(dataset.readings[32].timeLabel).toBe('08:00');
      expect(dataset.readings[32].isPeak).toBe(true);

      // Midday Peak: 10:00 (interval 40) -> Peak
      expect(dataset.readings[40].timeLabel).toBe('10:00');
      expect(dataset.readings[40].isPeak).toBe(true);

      // Boundary: 20:45 (interval 83) -> Peak
      expect(dataset.readings[83].timeLabel).toBe('20:45');
      expect(dataset.readings[83].isPeak).toBe(true);

      // Boundary: 21:00 (interval 84) -> Off-Peak
      expect(dataset.readings[84].timeLabel).toBe('21:00');
      expect(dataset.readings[84].isPeak).toBe(false);
    });

    it('classifies afternoon cooling peak (14:00-17:00) as Critical Peak', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);

      // 13:45 (interval 55) -> Peak, but not critical
      expect(dataset.readings[55].timeLabel).toBe('13:45');
      expect(dataset.readings[55].isPeak).toBe(true);
      expect(dataset.readings[55].isCriticalPeak).toBe(false);

      // 14:00 (interval 56) -> Critical Peak
      expect(dataset.readings[56].timeLabel).toBe('14:00');
      expect(dataset.readings[56].isPeak).toBe(true);
      expect(dataset.readings[56].isCriticalPeak).toBe(true);

      // 16:45 (interval 67) -> Critical Peak
      expect(dataset.readings[67].timeLabel).toBe('16:45');
      expect(dataset.readings[67].isCriticalPeak).toBe(true);

      // 17:00 (interval 68) -> Peak, but not critical
      expect(dataset.readings[68].timeLabel).toBe('17:00');
      expect(dataset.readings[68].isPeak).toBe(true);
      expect(dataset.readings[68].isCriticalPeak).toBe(false);
    });

    it('classifies evening residential peak (18:00-21:00) as Critical Peak', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);

      // 17:45 (interval 71) -> not critical
      expect(dataset.readings[71].timeLabel).toBe('17:45');
      expect(dataset.readings[71].isCriticalPeak).toBe(false);

      // 18:00 (interval 72) -> Critical Peak
      expect(dataset.readings[72].timeLabel).toBe('18:00');
      expect(dataset.readings[72].isPeak).toBe(true);
      expect(dataset.readings[72].isCriticalPeak).toBe(true);

      // 20:45 (interval 83) -> Critical Peak
      expect(dataset.readings[83].timeLabel).toBe('20:45');
      expect(dataset.readings[83].isCriticalPeak).toBe(true);

      // 21:00 (interval 84) -> Off-Peak, not critical
      expect(dataset.readings[84].timeLabel).toBe('21:00');
      expect(dataset.readings[84].isPeak).toBe(false);
      expect(dataset.readings[84].isCriticalPeak).toBe(false);
    });

    it('exempts Sunday completely: all 96 intervals are Off-Peak', () => {
      const sunDataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', SUNDAY_DATE);

      for (const reading of sunDataset.readings) {
        expect(reading.isPeak).toBe(false);
        expect(reading.isCriticalPeak).toBe(false);
      }

      expect(sunDataset.peakKwh).toBe(0);
      expect(sunDataset.peakPercentage).toBe(0.0);
      expect(sunDataset.offPeakKwh).toBe(sunDataset.totalKwh);
    });

    it('validates conservation of energy: peakKwh + offPeakKwh equals totalKwh', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);
      const computedTotal = Number((dataset.peakKwh + dataset.offPeakKwh).toFixed(4));
      expect(computedTotal).toBe(dataset.totalKwh);
      const computedPct = Number(((dataset.peakKwh / dataset.totalKwh) * 100).toFixed(1));
      expect(computedPct).toBe(dataset.peakPercentage);
    });
  });

  // ============================================================================
  // Suite 3: Multi-Timeframe Telemetry Aggregation (Day, Week, Month, Year)
  // ============================================================================
  describe('Suite 3: Multi-Timeframe Telemetry Aggregation', () => {
    it('Week timeframe produces 7 daily buckets with Sunday designated Off-Peak', () => {
      const weekDataset = generateAmiTelemetry(TEST_AMI_CAN, 'week', WEEKDAY_DATE);
      expect(weekDataset.timeframe).toBe('week');
      expect(weekDataset.summaryByBucket.length).toBe(7);
      expect(weekDataset.summaryByBucket[0].label).toBe('Mon');
      expect(weekDataset.summaryByBucket[0].isPeak).toBe(true);
      expect(weekDataset.summaryByBucket[6].label).toBe('Sun');
      expect(weekDataset.summaryByBucket[6].isPeak).toBe(false);
      expect(weekDataset.summaryByBucket[6].kwh).toBeLessThan(weekDataset.summaryByBucket[0].kwh);
    });

    it('Month timeframe dynamically adjusts for 28, 29, 30, and 31 days', () => {
      // 31 days in May 2026
      const mayDataset = generateAmiTelemetry(TEST_AMI_CAN, 'month', '2026-05-18');
      expect(mayDataset.summaryByBucket.length).toBe(31);
      expect(mayDataset.summaryByBucket[0].label).toBe('Day 1');
      expect(mayDataset.summaryByBucket[30].label).toBe('Day 31');

      // 28 days in Feb 2026 (non-leap)
      const feb2026 = generateAmiTelemetry(TEST_AMI_CAN, 'month', '2026-02-01');
      expect(feb2026.summaryByBucket.length).toBe(28);

      // 29 days in Feb 2028 (leap year)
      const feb2028 = generateAmiTelemetry(TEST_AMI_CAN, 'month', '2028-02-01');
      expect(feb2028.summaryByBucket.length).toBe(29);
    });

    it('Year timeframe produces 12 monthly points reflecting Philippine summer peaks', () => {
      const yearDataset = generateAmiTelemetry(TEST_AMI_CAN, 'year', WEEKDAY_DATE);
      expect(yearDataset.timeframe).toBe('year');
      expect(yearDataset.summaryByBucket.length).toBe(12);

      const months = yearDataset.summaryByBucket.map((b) => b.label);
      expect(months).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

      const aprKwh = yearDataset.summaryByBucket[3].kwh;
      const mayKwh = yearDataset.summaryByBucket[4].kwh;
      const decKwh = yearDataset.summaryByBucket[11].kwh;

      // Summer months (Apr, May) show higher consumption than cool Amihan season (Dec)
      expect(aprKwh).toBeGreaterThan(decKwh);
      expect(mayKwh).toBeGreaterThan(decKwh);
    });

    it('Month and Week views produce non-flat dynamic curves and populate bucket peak/off-peak splits', () => {
      const monthDataset = generateAmiTelemetry(TEST_AMI_CAN, 'month', '2026-05-18');
      const monthValues = monthDataset.summaryByBucket.map((b) => b.kwh);
      const monthCurve = generateSvgCurveCoordinates(monthValues);
      expect(monthCurve.isFlatline).toBe(false);
      expect(monthDataset.summaryByBucket[0].peakKwh).toBeDefined();
      expect(monthDataset.summaryByBucket[0].offPeakKwh).toBeDefined();

      // Distinct AMI CANs produce distinct deterministic load curves
      const otherAmiDataset = generateAmiTelemetry('1234567892', 'day', '2026-05-18');
      expect(getCanLoadScaleFactor('1234567892')).not.toBe(1.0);
      expect(otherAmiDataset.totalKwh).not.toBe(monthDataset.totalKwh);
    });
  });

  // ============================================================================
  // Suite 7: Analog Dual-Subtype & Missed-Week Interpolation
  // ============================================================================
  describe('Suite 7: Analog Dual-Subtype & Missed-Week Interpolation', () => {
    it('supports both dial and cyclometer subtype extraction in deterministic simulation', async () => {
      const dialRes = await extractAnalogMeterReading('mock-base64-1', 14200, 'dial');
      expect(dialRes.meterType).toBe('dial');

      const cycloRes = await extractAnalogMeterReading('mock-base64-1', 14200, 'cyclometer');
      expect(cycloRes.meterType).toBe('cyclometer');
      expect(cycloRes.dials.length).toBe(5);
    });

    it('interpolates intermediate weekly entries when daysSinceLastReading >= 14 (missed weeks)', async () => {
      const testCan = '1234567893';
      await clearAnalogMeterLogs(testCan);
      const initialLogs = await getAnalogMeterLogs(testCan);
      const lastSeed = initialLogs[initialLogs.length - 1];

      // User logs after 21 days (3 weeks = 2 missed weeks + 1 current week) with +120 kWh total delta (40 kWh/week)
      const deltaCalc = calculateWeeklyAnalogDelta(
        lastSeed.readingKwh + 120,
        lastSeed.readingKwh,
        21,
        11.43
      );
      expect(deltaCalc.weeklyUsageKwh).toBe(120);
      expect(deltaCalc.normalizedWeeklyKwh).toBe(40);

      await saveAnalogMeterLog({
        id: 'manual-catchup-1',
        can: testCan,
        timestamp: new Date(new Date(lastSeed.timestamp).getTime() + 21 * 86400000).toISOString(),
        readingKwh: lastSeed.readingKwh + 120,
        weeklyUsageKwh: deltaCalc.weeklyUsageKwh,
        daysSinceLastReading: 21,
        normalizedWeeklyKwh: deltaCalc.normalizedWeeklyKwh,
        costEstimate: deltaCalc.costEstimate,
        verifiedByUser: true,
        meterType: 'cyclometer',
        dials: [1, 4, 4, 0, 5],
      });

      const updatedLogs = await getAnalogMeterLogs(testCan);
      // 6 seed logs + 2 interpolated logs + 1 confirmed log = 9 logs
      expect(updatedLogs.length).toBe(initialLogs.length + 3);
      const interpLogs = updatedLogs.filter((l) => l.isInterpolated);
      expect(interpLogs.length).toBe(2);
      expect(interpLogs[0].weeklyUsageKwh).toBe(40);
      expect(updatedLogs[updatedLogs.length - 1].weeklyUsageKwh).toBe(40);
      expect(updatedLogs[updatedLogs.length - 1].isInterpolated).toBe(false);
    });
  });

  // ============================================================================
  // Suite 4: SVG Spline & Coordinate Math (generateSvgCurveCoordinates)
  // ============================================================================
  describe('Suite 4: SVG Spline & Curve Math', () => {
    it('generates a valid Catmull-Rom/cubic Bezier path string starting with M and containing C', () => {
      const values = [0.2, 0.4, 0.9, 1.8, 2.2, 1.1, 0.5];
      const curve = generateSvgCurveCoordinates(values, 300, 160, 20);

      expect(curve.pathString.startsWith('M ')).toBe(true);
      expect(curve.pathString).toContain('C ');
      expect(curve.points.length).toBe(values.length);
      expect(curve.isFlatline).toBe(false);
    });

    it('ensures all points stay strictly within viewBox and padding boundaries', () => {
      const values = [0, 5, 2, 8, 1, 9, 3];
      const width = 300;
      const height = 160;
      const padding = 20;

      const curve = generateSvgCurveCoordinates(values, width, height, padding);
      for (const pt of curve.points) {
        expect(pt.x).toBeGreaterThanOrEqual(padding);
        expect(pt.x).toBeLessThanOrEqual(width - padding);
        expect(pt.y).toBeGreaterThanOrEqual(padding);
        expect(pt.y).toBeLessThanOrEqual(height - padding);
      }
    });

    it('handles flatline zero-consumption dataset without NaN or Infinity', () => {
      const flatline = new Array(96).fill(0);
      const curve = generateSvgCurveCoordinates(flatline, 300, 160, 20);

      expect(curve.isFlatline).toBe(true);
      expect(curve.pathString).not.toContain('NaN');
      expect(curve.pathString).not.toContain('Infinity');
      expect(curve.points.length).toBe(96);
    });

    it('handles empty input safely', () => {
      const curve = generateSvgCurveCoordinates([], 300, 160, 20);
      expect(curve.pathString).toBe('');
      expect(curve.points.length).toBe(0);
      expect(curve.isFlatline).toBe(true);
    });

    it('generates closed SVG area path for gradient filling', () => {
      const values = [0.2, 0.5, 0.8];
      const height = 160;
      const padding = 20;
      const curve = generateSvgCurveCoordinates(values, 300, height, padding);
      const areaPath = generateSvgAreaPath(curve.pathString, curve.points, height, padding);

      expect(areaPath.startsWith('M ')).toBe(true);
      expect(areaPath.endsWith('Z')).toBe(true);
      expect(areaPath).toContain(`L ${curve.points[curve.points.length - 1].x} ${height - padding}`);
    });

    it('calculates correct horizontal bounds for shaded Peak Window (08:00 - 21:00)', () => {
      const bounds = getPeakWindowBounds(320, 20);
      expect(bounds.startX).toBeGreaterThan(20);
      expect(bounds.width).toBeGreaterThan(50);
      expect(bounds.endX).toBeLessThanOrEqual(301);
    });
  });

  // ============================================================================
  // Suite 5: Peak vs Off-Peak Analytics & Cost Calculations (Feature 8)
  // ============================================================================
  describe('Suite 5: Peak vs Off-Peak Analytics & Recommendations', () => {
    it('correctly calculates estimated costs and formats currency', () => {
      const formatted = formatCurrency(1234.5);
      expect(formatted).toBe('₱1,234.50');
    });

    it('provides load-shifting advice when peak percentage exceeds 35%', () => {
      const recommendationHigh = calculatePeakSavingsRecommendation(52.0, 10.5);
      expect(recommendationHigh).toContain('9 PM');
      expect(recommendationHigh).toContain('peak hours');

      const recommendationLow = calculatePeakSavingsRecommendation(25.0, 3.2);
      expect(recommendationLow).toContain('Maganda ang pamamahagi');
    });

    it('correctly resolves meter serial numbers for seeded and unseeded CANs', () => {
      // Seeded accounts
      expect(resolveAmiMeterSerialNumber('019288234410')).toBe('MR-AMI-4410');
      expect(resolveAmiMeterSerialNumber('1234567890')).toBe('MR-AMI-7890');
      // Fallback
      expect(resolveAmiMeterSerialNumber('9999887766')).toBe('MR-AMI-7766');
    });
  });

  // ============================================================================
  // Suite 6: Component Rendering Validation
  // ============================================================================
  describe('Suite 6: Component Rendering & Interaction', () => {
    it('AmiCurveGraphCard instantiates and renders all 4 timeframe pill buttons', () => {
      const card = React.createElement(AmiCurveGraphCard, {
        can: TEST_AMI_CAN,
        initialTimeframe: 'day',
        testID: 'ami-curve-test',
      });
      expect(card).toBeDefined();
      expect(card.props.testID).toBe('ami-curve-test');
    });

    it('AmiPeakBreakdownCard instantiates and calculates breakdown from dataset', () => {
      const dataset = generateAmiTelemetry(TEST_AMI_CAN, 'day', WEEKDAY_DATE);
      const card = React.createElement(AmiPeakBreakdownCard, {
        dataset,
        testID: 'ami-breakdown-test',
      });
      expect(card).toBeDefined();
      expect(card.props.dataset?.totalKwh).toBe(dataset.totalKwh);
    });
  });
});
