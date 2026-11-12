// ==============================================================================
// KuryenTipid - AMI Telemetry Type Definitions
// Defines 15-minute interval telemetry data structures, timeframe views,
// peak classifications, and SVG curve visualization coordinates.
// Conforms to PROJECT.md § Interface Contracts
// ==============================================================================

export type AmiTimeframe = 'day' | 'week' | 'month' | 'year';

export interface AmiIntervalReading {
  timestamp: string;         // ISO-8601 string
  intervalIndex: number;     // 0-95
  timeLabel: string;         // "HH:MM" e.g. "00:00", "14:15", "23:45"
  kwh: number;               // 15-min energy consumption (kWh)
  powerWatts: number;        // Average instantaneous power (Watts)
  isPeak: boolean;           // Peak hours (Mon-Sat 08:00 - 21:00 PST)
  isCriticalPeak: boolean;   // Critical peak hours (14:00-17:00 and 18:00-21:00)
  cumulativeKwh: number;     // Cumulative kWh progression for timeframe
  estimatedCost: number;     // Cumulative estimated cost (PHP)
}

export interface AmiTelemetrySummaryBucket {
  label: string;
  kwh: number;
  isPeak?: boolean;
  peakKwh?: number;
  offPeakKwh?: number;
}

export interface AmiTelemetryDataset {
  can: string;
  meterSerialNumber: string;
  timeframe: AmiTimeframe;
  dateRange: {
    start: string;
    end: string;
  };
  totalKwh: number;
  peakKwh: number;
  offPeakKwh: number;
  peakPercentage: number;
  estimatedTotalCost: number;
  potentialShiftSavings: number;
  readings: AmiIntervalReading[];
  summaryByBucket: AmiTelemetrySummaryBucket[];
}

export interface AmiTelemetryOverrides {
  constantPowerWatts?: number;
  powerSpikeIndex?: number;
  spikeWatts?: number;
  rate?: number;
}

export interface SvgCurvePoint {
  x: number;
  y: number;
}

export interface SvgCurveResult {
  pathString: string;
  points: SvgCurvePoint[];
  isFlatline: boolean;
}
