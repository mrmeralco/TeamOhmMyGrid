/**
 * smartPlugSimulator.ts
 * Integrates the TeamOhmMyGrid IoT Smart Plug hardware simulator.
 * Provides individual smart plugs with dynamic telemetry, relay actuation,
 * and optional WebSocket link to the live Python backend (/ws).
 */

import { SmartPlugDevice, SmartPlugTimer, SmartPlugSchedule } from '../types';

export const getNominalWatts = (iconId: string): number => {
  switch (iconId) {
    case 'aircon':
      return 850.0;
    case 'fridge':
      return 145.0;
    case 'fan':
      return 58.0;
    case 'washer':
      return 520.0;
    case 'ricecooker':
      return 700.0;
    case 'microwave':
      return 1250.0;
    case 'pc':
      return 285.0;
    default:
      return 100.0;
  }
};

export const isScheduleActiveNow = (schedule?: SmartPlugSchedule, refDate: Date = new Date()): boolean => {
  if (!schedule || !schedule.enabled) return false;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = dayNames[refDate.getDay()];
  if (!schedule.days || !schedule.days.includes(currentDay)) return false;

  const [sh, sm] = (schedule.startTime || '00:00').split(':').map(Number);
  const [eh, em] = (schedule.endTime || '00:00').split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;

  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const currentMins = refDate.getHours() * 60 + refDate.getMinutes();

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  } else {
    // Crosses midnight, e.g. 22:00 to 06:00
    return currentMins >= startMins || currentMins < endMins;
  }
};

export const INITIAL_SMART_PLUGS: SmartPlugDevice[] = [
  {
    id: 'plug_ac_01',
    name: 'Smart Plug 1 · Aircon',
    appliance: 'Air Conditioner (1.5 HP Inverter)',
    location: 'Master Bedroom',
    relayState: 'ON',
    powerWatts: 850.0,
    voltageRms: 230.2,
    currentAmps: 3.93,
    powerFactor: 0.94,
    accumulatedKwh: 92.4,
    monthlyCost: 1056.13,
    color: '#D95200', // Brand Orange
    iconId: 'aircon',
    tip: 'I-angat ang thermostat mula 20°C patungong 24°C upang makatipid ng ~₱482 kada buwan.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: true,
      startTime: '22:00',
      endTime: '06:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      label: 'Night Sleep Saver',
    },
  },
  {
    id: 'plug_fridge_02',
    name: 'Smart Plug 2 · Refrigerator',
    appliance: 'Refrigerator (Two-Door No-Frost)',
    location: 'Kitchen',
    relayState: 'ON',
    powerWatts: 145.0,
    voltageRms: 229.8,
    currentAmps: 0.72,
    powerFactor: 0.88,
    accumulatedKwh: 64.2,
    monthlyCost: 733.81,
    color: '#065F46', // Emerald
    iconId: 'fridge',
    tip: 'Panatilihing malinis ang door seal gasket upang maiwasan ang tuluy-tuloy na takbo ng compressor.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: false,
      startTime: '00:00',
      endTime: '23:59',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      label: '24/7 Always On',
    },
  },
  {
    id: 'plug_fan_03',
    name: 'Smart Plug 3 · Electric Fan',
    appliance: 'Electric Stand Fan (16-inch)',
    location: 'Living Room',
    relayState: 'ON',
    powerWatts: 58.0,
    voltageRms: 230.1,
    currentAmps: 0.31,
    powerFactor: 0.82,
    accumulatedKwh: 22.8,
    monthlyCost: 260.60,
    color: '#2563EB', // Blue
    iconId: 'fan',
    tip: 'Mas matipid gamitin ang fan kasabay ng aircon na naka-25°C para sa mas malawak na simoy.',
    timer: {
      active: true,
      targetSeconds: 3600,
      remainingSeconds: 2140,
      action: 'OFF',
    },
    schedule: {
      enabled: true,
      startTime: '13:00',
      endTime: '16:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      label: 'Hapon Siesta',
    },
  },
  {
    id: 'plug_washer_04',
    name: 'Smart Plug 4 · Washing Machine',
    appliance: 'Washing Machine (Front-Load)',
    location: 'Laundry Area',
    relayState: 'OFF',
    powerWatts: 0.0,
    voltageRms: 230.0,
    currentAmps: 0.0,
    powerFactor: 0.85,
    accumulatedKwh: 18.5,
    monthlyCost: 211.46,
    color: '#7C3AED', // Violet
    iconId: 'washer',
    tip: 'Maglaba nang full-load pagkalipas ng 6:00 PM upang makaiwas sa Luzon Grid peak strain.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: true,
      startTime: '21:00',
      endTime: '23:00',
      days: ['Sat', 'Sun'],
      label: 'Weekend Off-Peak',
    },
  },
  {
    id: 'plug_cooker_05',
    name: 'Smart Plug 5 · Rice Cooker',
    appliance: 'Electric Rice Cooker (1.8L)',
    location: 'Kitchen',
    relayState: 'OFF',
    powerWatts: 0.0,
    voltageRms: 230.0,
    currentAmps: 0.0,
    powerFactor: 1.0,
    accumulatedKwh: 14.1,
    monthlyCost: 161.16,
    color: '#D97706', // Amber
    iconId: 'ricecooker',
    tip: 'I-unplug pagkatapos maluto; ang Keep-Warm mode ay kumokonsumo ng 45W nang tuluy-tuloy.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: false,
      startTime: '06:00',
      endTime: '07:30',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      label: 'Almusal Prep',
    },
  },
  {
    id: 'plug_micro_06',
    name: 'Smart Plug 6 · Microwave',
    appliance: 'Microwave Oven (800W Output)',
    location: 'Kitchen',
    relayState: 'OFF',
    powerWatts: 0.0,
    voltageRms: 230.0,
    currentAmps: 0.0,
    powerFactor: 0.91,
    accumulatedKwh: 8.6,
    monthlyCost: 98.30,
    color: '#DC2626', // Red
    iconId: 'microwave',
    tip: 'Mas mabilis mag-init gamit ang covered plate upang mapaikli ang magnetron run-time.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: false,
      startTime: '12:00',
      endTime: '13:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      label: 'Tanghalian Reheat',
    },
  },
  {
    id: 'plug_pc_07',
    name: 'Smart Plug 7 · Gaming PC',
    appliance: 'Gaming Desktop PC & Monitor',
    location: 'Home Office / Bedroom',
    relayState: 'ON',
    powerWatts: 285.0,
    voltageRms: 230.4,
    currentAmps: 1.28,
    powerFactor: 0.97,
    accumulatedKwh: 36.4,
    monthlyCost: 416.05,
    color: '#0891B2', // Cyan
    iconId: 'pc',
    tip: 'I-off ang RGB lighting at gamitin ang Sleep Mode sa halip na iwang naka-idle buong magdamag.',
    timer: {
      active: false,
      targetSeconds: 0,
      remainingSeconds: 0,
      action: 'OFF',
    },
    schedule: {
      enabled: true,
      startTime: '09:00',
      endTime: '18:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      label: 'Work Hours',
    },
  },
];

type Listener = (plugs: SmartPlugDevice[]) => void;

class SmartPlugSimulator {
  private plugs: SmartPlugDevice[] = JSON.parse(JSON.stringify(INITIAL_SMART_PLUGS));
  private listeners: Set<Listener> = new Set();
  private ws: WebSocket | null = null;
  private wsConnected: boolean = false;
  private reconnectTimer: any = null;
  private tickInterval: any = null;

  constructor() {
    this.startLocalLoop();
  }

  public getPlugs(): SmartPlugDevice[] {
    return this.plugs;
  }

  public isConnected(): boolean {
    return this.wsConnected;
  }

  public getTotalActiveWatts(): number {
    return Number(
      this.plugs
        .reduce((sum, p) => (p.relayState === 'ON' ? sum + p.powerWatts : sum), 0)
        .toFixed(1)
    );
  }

  public getTotalAccumulatedKwh(): number {
    return Number(
      this.plugs.reduce((sum, p) => sum + p.accumulatedKwh, 0).toFixed(1)
    );
  }

  public setPlugRelay(id: string, relay: 'ON' | 'OFF'): void {
    this.plugs = this.plugs.map((plug) => {
      if (plug.id !== id) return plug;

      const nextWatts = relay === 'ON' ? getNominalWatts(plug.iconId) : 0.0;
      const nextAmps = Number((nextWatts / plug.voltageRms).toFixed(2));
      const nextTimer =
        relay === 'OFF' && plug.timer?.action === 'OFF' && plug.timer.active
          ? { active: false, targetSeconds: 0, remainingSeconds: 0, action: 'OFF' as const }
          : plug.timer;

      return {
        ...plug,
        relayState: relay,
        powerWatts: nextWatts,
        currentAmps: nextAmps,
        timer: nextTimer,
      };
    });

    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ plugId: id, relay }));
      } catch {
        // ignore
      }
    }
  }

  public setAllPlugsRelay(relay: 'ON' | 'OFF'): void {
    this.plugs = this.plugs.map((plug) => {
      const nextWatts = relay === 'ON' ? getNominalWatts(plug.iconId) : 0.0;
      const nextAmps = Number((nextWatts / plug.voltageRms).toFixed(2));
      const nextTimer =
        relay === 'OFF' && plug.timer?.action === 'OFF' && plug.timer.active
          ? { active: false, targetSeconds: 0, remainingSeconds: 0, action: 'OFF' as const }
          : plug.timer;

      return {
        ...plug,
        relayState: relay,
        powerWatts: nextWatts,
        currentAmps: nextAmps,
        timer: nextTimer,
      };
    });

    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ all: true, relay }));
      } catch {
        // ignore
      }
    }
  }

  public togglePlugRelay(id: string): void {
    this.plugs = this.plugs.map((plug) => {
      if (plug.id !== id) return plug;

      const nextRelay: 'ON' | 'OFF' = plug.relayState === 'ON' ? 'OFF' : 'ON';
      const nextWatts = nextRelay === 'ON' ? getNominalWatts(plug.iconId) : 0.0;
      const nextAmps = Number((nextWatts / plug.voltageRms).toFixed(2));
      const nextTimer =
        nextRelay === 'OFF' && plug.timer?.action === 'OFF' && plug.timer.active
          ? { active: false, targetSeconds: 0, remainingSeconds: 0, action: 'OFF' as const }
          : plug.timer;

      return {
        ...plug,
        relayState: nextRelay,
        powerWatts: nextWatts,
        currentAmps: nextAmps,
        timer: nextTimer,
      };
    });

    this.notify();

    // If connected to physical/virtual Python hardware WebSocket, send command
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const target = this.plugs.find((p) => p.id === id);
        this.ws.send(JSON.stringify({ plugId: id, relay: target?.relayState }));
      } catch {
        // ignore
      }
    }
  }

  public setPlugTimer(id: string, seconds: number, action: 'OFF' | 'ON' = 'OFF'): void {
    this.plugs = this.plugs.map((plug) => {
      if (plug.id !== id) return plug;
      // Auto-off timer turns the device ON if currently OFF
      const nextRelay: 'ON' | 'OFF' = action === 'OFF' ? 'ON' : plug.relayState;
      const nextWatts = nextRelay === 'ON' ? getNominalWatts(plug.iconId) : 0.0;
      const nextAmps = Number((nextWatts / plug.voltageRms).toFixed(2));

      return {
        ...plug,
        relayState: nextRelay,
        powerWatts: nextWatts,
        currentAmps: nextAmps,
        timer: {
          active: true,
          targetSeconds: seconds,
          remainingSeconds: seconds,
          action,
        },
      };
    });
    this.notify();
  }

  public cancelPlugTimer(id: string): void {
    this.plugs = this.plugs.map((plug) => {
      if (plug.id !== id) return plug;
      return {
        ...plug,
        timer: {
          active: false,
          targetSeconds: 0,
          remainingSeconds: 0,
          action: 'OFF',
        },
      };
    });
    this.notify();
  }

  public setPlugSchedule(id: string, schedule: SmartPlugSchedule): void {
    this.plugs = this.plugs.map((plug) => {
      if (plug.id !== id) return plug;
      return {
        ...plug,
        schedule,
      };
    });
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.plugs);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.plugs));
  }

  // Gentle background modulation loop for realistic live telemetry & active timers
  private startLocalLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);

    this.tickInterval = setInterval(() => {
      let changed = false;
      this.plugs = this.plugs.map((plug) => {
        let updatedPlug = { ...plug };

        // 1. Countdown active timer
        if (updatedPlug.timer && updatedPlug.timer.active && updatedPlug.timer.remainingSeconds > 0) {
          const nextRemaining = Math.max(0, updatedPlug.timer.remainingSeconds - 3);
          if (nextRemaining === 0) {
            // Timer expired: execute action
            const actionRelay = updatedPlug.timer.action;
            const nextWatts = actionRelay === 'ON' ? getNominalWatts(updatedPlug.iconId) : 0.0;
            const nextAmps = Number((nextWatts / updatedPlug.voltageRms).toFixed(2));
            updatedPlug = {
              ...updatedPlug,
              relayState: actionRelay,
              powerWatts: nextWatts,
              currentAmps: nextAmps,
              timer: {
                ...updatedPlug.timer,
                active: false,
                remainingSeconds: 0,
              },
            };
            changed = true;
          } else {
            updatedPlug = {
              ...updatedPlug,
              timer: {
                ...updatedPlug.timer,
                remainingSeconds: nextRemaining,
              },
            };
            changed = true;
          }
        }

        // 2. Modulate live active telemetry if relay is ON
        if (updatedPlug.relayState === 'ON') {
          // Add subtle physics fluctuation (+- 1.5%)
          const delta = (Math.random() - 0.5) * (updatedPlug.powerWatts * 0.03);
          const modulatedWatts = Math.max(5.0, Number((updatedPlug.powerWatts + delta).toFixed(1)));
          const modulatedAmps = Number((modulatedWatts / updatedPlug.voltageRms).toFixed(2));

          // Slowly accumulate real-time kWh (every 3s step)
          const stepKwh = (modulatedWatts * (3 / 3600)) / 1000;
          const newAccumKwh = Number((updatedPlug.accumulatedKwh + stepKwh).toFixed(3));
          const newCost = Number((newAccumKwh * 11.43).toFixed(2));

          changed = true;
          return {
            ...updatedPlug,
            powerWatts: modulatedWatts,
            currentAmps: modulatedAmps,
            accumulatedKwh: newAccumKwh,
            monthlyCost: newCost,
          };
        }

        return updatedPlug;
      });

      if (changed) {
        this.notify();
      }
    }, 3000);

    if (typeof this.tickInterval?.unref === 'function') {
      this.tickInterval.unref();
    }
  }

  // Attempt connection to live Python server (/ws) with auto-reconnect
  public connect(host: string = 'localhost:8000') {
    try {
      const cleanHost = host.replace(/^https?:\/\//, '').replace(/^ws:\/\//, '');
      const wsUrl = `ws://${cleanHost}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.wsConnected = true;
        this.notify();
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet?.appliances && Array.isArray(packet.appliances)) {
            // Map remote telemetry to individual plugs
            this.plugs = this.plugs.map((plug) => {
              const matched = packet.appliances.find(
                (a: any) => a.id === plug.iconId || a.name?.toLowerCase().includes(plug.iconId)
              );
              if (matched) {
                return {
                  ...plug,
                  powerWatts: matched.active_power_w || 0,
                  relayState: matched.active_power_w > 0 ? 'ON' : 'OFF',
                };
              }
              return plug;
            });
            this.notify();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        this.wsConnected = false;
        this.notify();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(host), 5000);
      };

      ws.onerror = () => {
        this.wsConnected = false;
        this.notify();
      };
    } catch {
      this.wsConnected = false;
    }
  }

  public destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const smartPlugSimulator = new SmartPlugSimulator();
