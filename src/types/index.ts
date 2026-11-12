export type AppLanguage = 'taglish' | 'filipino' | 'english';

export interface CANProfile {
  id: string;
  name: string;
  accountNumber: string;
  customerName: string;
  serviceAddress: string;
  ratePerKwh: number;
  budget: number;
  currentKwh: number;
  billData: ExtractedBillData;
}

export interface MeralcoRateTable {
  generationRate: number;
  transmissionRate: number;
  systemLossRate: number;
  distributionTiers: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
  };
  lifelineThreshold: number;
  vatRate: number;
}

export interface ExtractedBillData {
  customerAccountNumber: string;
  billingPeriod: {
    startDate: string;
    endDate: string;
  };
  dueDate: string;
  totalKwh: number;
  totalAmountDue: number;
  generationCharge?: number;
  transmissionCharge?: number;
  systemLossCharge?: number;
  distributionCharge?: number;
  otherCharges?: number;
  vat?: number;
  verifiedByUser?: boolean;
}

export interface TelemetryReading {
  timestamp: string;
  powerWatts: number;
  intervalKwh: number;
  applianceId: string;
  applianceName: string;
}

export interface WhatIfSimulationInput {
  currentHouseholdKwh: number;
  baselineTemp: number;
  targetTemp: number;
  baselineHoursPerDay: number;
  reducedHoursPerDay: number;
  ratedWatts: number;
  isInverter?: boolean;
}

export interface WhatIfSimulationResult {
  kwhSavedMonthly: number;
  pesoSavedMonthly: number;
  formulaExplanation: string;
  achievedTierDrop: boolean;
}

export interface ApplianceAlert {
  id: string;
  applianceName: string;
  watts: number;
  recommendation: string;
  category: 'budget' | 'peak' | 'general';
  timestamp: string;
  isPeakNow?: boolean;
}

export interface SmartPlugTimer {
  active: boolean;
  targetSeconds: number;
  remainingSeconds: number;
  action: 'OFF' | 'ON';
}

export interface SmartPlugSchedule {
  enabled: boolean;
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
  days: string[];    // e.g. ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  label?: string;
}

export interface SmartPlugDevice {
  id: string;
  name: string;
  appliance: string;
  location: string;
  relayState: 'ON' | 'OFF';
  powerWatts: number;
  voltageRms: number;
  currentAmps: number;
  powerFactor: number;
  accumulatedKwh: number;
  monthlyCost: number;
  color: string;
  iconId: string;
  tip: string;
  timer?: SmartPlugTimer;
  schedule?: SmartPlugSchedule;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'tipi';
  text: string;
  timestamp: string;
}
