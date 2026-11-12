import { TelemetryReading } from '../types';

export interface SmartPlugClient {
  getLatestReadings(): Promise<TelemetryReading[]>;
  getHistoricalSlices(sinceTimestamp: string): Promise<TelemetryReading[]>;
}

export class MockSmartPlugService implements SmartPlugClient {
  private baseTimestamp: Date;
  private virtualDayOffset: number = 0;
  private injectedSpikeWatts: number = 0;

  constructor() {
    this.baseTimestamp = new Date();
  }

  public fastForwardDays(days: number): void {
    this.virtualDayOffset += days;
  }

  public injectSpikeLoad(watts: number): void {
    this.injectedSpikeWatts = watts;
  }

  public reset(): void {
    this.virtualDayOffset = 0;
    this.injectedSpikeWatts = 0;
    this.baseTimestamp = new Date();
  }

  public getVirtualCurrentDate(): Date {
    const d = new Date(this.baseTimestamp.getTime());
    d.setDate(d.getDate() + this.virtualDayOffset);
    return d;
  }

  public async getLatestReadings(): Promise<TelemetryReading[]> {
    const now = this.getVirtualCurrentDate();
    const iso = now.toISOString();

    const acWatts = this.injectedSpikeWatts > 0 ? this.injectedSpikeWatts : 320;
    const fridgeWatts = 120;
    const fanWatts = 65;

    return [
      {
        timestamp: iso,
        powerWatts: acWatts,
        intervalKwh: Number(((acWatts * 0.5) / 1000).toFixed(4)),
        applianceId: 'app-ac-1',
        applianceName: 'Inverter Aircon (Living Room)',
      },
      {
        timestamp: iso,
        powerWatts: fridgeWatts,
        intervalKwh: Number(((fridgeWatts * 0.5) / 1000).toFixed(4)),
        applianceId: 'app-ref-1',
        applianceName: 'Refrigerator (Kitchen)',
      },
      {
        timestamp: iso,
        powerWatts: fanWatts,
        intervalKwh: Number(((fanWatts * 0.5) / 1000).toFixed(4)),
        applianceId: 'app-fan-1',
        applianceName: 'Electric Stand Fan (Bedroom)',
      },
    ];
  }

  public async getHistoricalSlices(sinceTimestamp: string): Promise<TelemetryReading[]> {
    const readings: TelemetryReading[] = [];
    const since = new Date(sinceTimestamp);
    const now = this.getVirtualCurrentDate();
    let current = new Date(since.getTime());

    // Generate 30-min intervals
    while (current <= now) {
      const iso = current.toISOString();
      const hour = current.getHours();

      // Inverter AC runs more during afternoon & night (13:00 - 17:00, 21:00 - 06:00)
      const isAcRunning = (hour >= 13 && hour <= 17) || hour >= 21 || hour <= 6;
      const acWatts = isAcRunning ? 320 : 0;
      const fridgeWatts = (current.getMinutes() % 60 === 0) ? 120 : 5;

      readings.push({
        timestamp: iso,
        powerWatts: acWatts,
        intervalKwh: Number(((acWatts * 0.5) / 1000).toFixed(4)),
        applianceId: 'app-ac-1',
        applianceName: 'Inverter Aircon',
      });

      readings.push({
        timestamp: iso,
        powerWatts: fridgeWatts,
        intervalKwh: Number(((fridgeWatts * 0.5) / 1000).toFixed(4)),
        applianceId: 'app-ref-1',
        applianceName: 'Refrigerator',
      });

      // advance 30 mins
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }

    return readings;
  }
}

export const mockSmartPlugService = new MockSmartPlugService();
