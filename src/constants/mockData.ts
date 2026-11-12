import { CANProfile } from '../types';

export interface MockUserProfile {
  name: string;
  accountNumber: string;
  serviceAddress: string;
  ratePerKwh: number;
  billingCycle: {
    start: string;
    end: string;
    currentDay: number;
    totalDays: number;
    daysRemaining: number;
  };
  budget: {
    ceiling: number;
    spentSoFar: number;
    kwhConsumed: number;
    projectedMonthEnd: number;
    projectedExcess: number;
  };
}

export const PRESET_CAN_PROFILES: CANProfile[] = [
  {
    id: 'can-1',
    name: 'Bahay (Pasig)',
    accountNumber: '0192-8823-4410',
    customerName: 'Maria Santos',
    serviceAddress: 'Brgy. San Antonio, Pasig City',
    ratePerKwh: 11.43,
    budget: 3500,
    currentKwh: 188,
    billData: {
      customerAccountNumber: '0192-8823-4410',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-25',
      totalKwh: 215,
      totalAmountDue: 2450.50,
      generationCharge: 1414.95,
      verifiedByUser: true,
    },
  },
  {
    id: 'can-2',
    name: 'Tindahan / Negosyo',
    accountNumber: '0284-9102-3321',
    customerName: 'Santos Sari-Sari Store',
    serviceAddress: 'Kapitolyo, Pasig City',
    ratePerKwh: 11.48,
    budget: 5000,
    currentKwh: 385,
    billData: {
      customerAccountNumber: '0284-9102-3321',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-28',
      totalKwh: 420,
      totalAmountDue: 4820.00,
      generationCharge: 2795.60,
      verifiedByUser: true,
    },
  },
  {
    id: 'can-3',
    name: 'Condo / Taguig',
    accountNumber: '0341-7789-5562',
    customerName: 'Maria Santos (Condo)',
    serviceAddress: 'Grace Residences, Taguig City',
    ratePerKwh: 11.43,
    budget: 2500,
    currentKwh: 125,
    billData: {
      customerAccountNumber: '0341-7789-5562',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-06-02',
      totalKwh: 145,
      totalAmountDue: 1680.00,
      generationCharge: 974.40,
      verifiedByUser: true,
    },
  },
];

export const MOCK_USER: MockUserProfile = {
  name: 'Maria Santos',
  accountNumber: '0192-8823-4410',
  serviceAddress: 'Brgy. San Antonio, Pasig City',
  ratePerKwh: 11.43,
  billingCycle: {
    start: 'Nov 1, 2026',
    end: 'Nov 30, 2026',
    currentDay: 21,
    totalDays: 30,
    daysRemaining: 9,
  },
  budget: {
    ceiling: 3500,
    spentSoFar: 2840,
    kwhConsumed: 248.5,
    projectedMonthEnd: 3890,
    projectedExcess: 390,
  },
};

export interface MockPeakAlert {
  isPeak: boolean;
  alertLevel: string;
  timeWindow: string;
  title: string;
  subtitle: string;
  description: string;
}

export const MOCK_PEAK_ALERT: MockPeakAlert = {
  isPeak: true,
  alertLevel: 'RED ALERT',
  timeWindow: '2:00 PM – 5:00 PM',
  title: '⚡ Peak Grid Demand Alert',
  subtitle: 'Luzon Grid under high stress today',
  description:
    'Shifting high-draw appliances (Aircon, Plantsa, Washing Machine) after 6:00 PM helps avoid brownouts and saves you up to ₱180 this week.',
};

export interface MockAppliance {
  id: string;
  name: string;
  subtext: string;
  percentage: number;
  kwh: number;
  cost: number;
  color: string;
  iconName: string;
  status: string;
  statusType: 'danger' | 'success' | 'warning';
  tip: string;
}

export const MOCK_APPLIANCES: MockAppliance[] = [
  {
    id: 'aircon',
    name: 'Air Conditioner',
    subtext: '1.0 HP Inverter (Master BR)',
    percentage: 45,
    kwh: 111.8,
    cost: 1278.0,
    color: '#D95200', // Orange UI Brand color
    iconName: 'snow-outline',
    status: 'Spike (+20%)',
    statusType: 'danger',
    tip: 'Raising temp from 20°C to 24°C saves ~₱482/mo.',
  },
  {
    id: 'fridge',
    name: 'Refrigerator',
    subtext: 'Two-Door No-Frost',
    percentage: 30,
    kwh: 74.5,
    cost: 852.0,
    color: '#065F46', // Eco Green
    iconName: 'cube-outline',
    status: 'Normal',
    statusType: 'success',
    tip: 'Keep door seals clean and set dial to Medium.',
  },
  {
    id: 'waterheater',
    name: 'Water Heater & Iron',
    subtext: 'Shower heater & flat iron',
    percentage: 12,
    kwh: 29.8,
    cost: 341.0,
    color: '#F59E0B', // Meralco Amber
    iconName: 'flame-outline',
    status: 'Moderate',
    statusType: 'warning',
    tip: 'Schedule clothes ironing in one batch on weekend mornings.',
  },
  {
    id: 'lighting',
    name: 'Lighting & Fans',
    subtext: '8 LED bulbs & 2 stand fans',
    percentage: 8,
    kwh: 19.9,
    cost: 227.0,
    color: '#5B21B6', // Peak Violet
    iconName: 'bulb-outline',
    status: 'Optimized',
    statusType: 'success',
    tip: 'Good job! LED lighting consumes 80% less energy.',
  },
  {
    id: 'standby',
    name: 'Vampire / Standby Load',
    subtext: 'TV box, Wi-Fi, microwave, phone chargers',
    percentage: 5,
    kwh: 12.5,
    cost: 142.0,
    color: '#64748B',
    iconName: 'power-outline',
    status: 'Idle Drain',
    statusType: 'warning',
    tip: 'Unplug chargers and appliance strips when not in use.',
  },
];

export const MOCK_BILL_BREAKDOWN = {
  lastMonthTotal: 3150,
  currentBillTotal: 3500,
  difference: 350,
  rateChange: '+₱0.32 / kWh',
  components: [
    { label: 'Generation Charge (Power Plants)', amount: 2024.11, percent: 58 },
    { label: 'Distribution Charge (Meralco Poles/Wires)', amount: 735.0, percent: 21 },
    { label: 'Transmission Charge (NGCP Grid)', amount: 315.0, percent: 9 },
    { label: 'Government Taxes & Universal Charge', amount: 425.89, percent: 12 },
  ],
};

export const QUICK_PROMPTS = [
  'Bakit lumobo ang Aircon ko?',
  'Himayin ang Bill Line-by-Line 📋',
  'Paano ako makakatipid ng ₱500?',
  'Bakit may Peak-Hour Alert ngayon?',
];

export const BOT_RESPONSES: Record<string, { text: string }> = {
  'Bakit lumobo ang Aircon ko?': {
    text: 'Magandang tanong! 🌡️ Ayon sa smart disaggregation data natin:\n\n1. Lumobo ng 20% ang AC usage mo dahil sa 34°C heat index noong nakaraang 2 linggo.\n2. Naka-set ang AC sa 20°C sa loob ng 9 hours bawat gabi.\n\n💡 Tip: Kapag ini-adjust mo ang thermostat sa 24°C at gumamit ng electric fan, pareho pa rin ang lamig pero makakatipid ka agad ng humigit-kumulang ₱482 sa darating na buwan!',
  },
  'Himayin ang Bill Line-by-Line 📋': {
    text: 'Heto ang official breakdown ng ₱3,500 bill mo:\n\n• ⚡ Generation Charge (58%): ₱2,024.11 (Bayad sa power plants, tumaas ng ₱0.32/kWh dahil sa fuel costs sa global market)\n• 🗼 Transmission Charge (9%): ₱315.00 (Bayad sa National Grid)\n• 🔌 Distribution Charge (21%): ₱735.00 (Meralco poles and service—nananatiling fixed ang rate nito)\n• 🏛️ Gov Taxes & Subsidies (12%): ₱425.89 (VAT at Universal Charges)\n\nIbig sabihin, ang pagtaas ay galing sa combination ng mas mataas na generation cost at dagdag na konsumo sa bahay!',
  },
  'Paano ako makakatipid ng ₱500?': {
    text: 'Kayang-kaya natin maabot ang ₱500 savings bago matapos ang billing cycle! Heto ang 3 simpleng hakbang:\n\n1. ❄️ I-set ang Aircon sa 24°C sa halip na 20°C (Savings: ~₱320)\n2. 🔌 I-unplug ang TV box at appliance strips tuwing gabi (Savings: ~₱95)\n3. 🧺 Magplantsa nang sabay-sabay sa umaga bago mag-peak hours (Savings: ~₱110)\n\nKabuuang Projected Tipid: ₱525.00! Gusto mo bang i-activate ko ang AI reminder para dito?',
  },
  'Bakit may Peak-Hour Alert ngayon?': {
    text: '⚠️ Kasalukuyang nakakaranas ang Luzon Grid ng high power demand mula 2:00 PM hanggang 5:00 PM dahil sa init ng panahon.\n\nKapag sumasabay ang maraming appliances sa mga oras na ito, tumataas ang presyo ng kuryente sa WESM (Wholesale Electricity Spot Market) at may panganib ng yellow alert.\n\nKung ipagpapaliban mo ang paggamit ng washing machine at plantsa paglampas ng 6:00 PM, nakakatulong ka sa komunidad at naiiwasan mo ang over-budget!',
  },
};

export const TEAM_INFO = {
  name: 'Ohm My Grid',
  members: [
    'Jaeda Marthena Iral',
    'Carl Benedict Enriquez',
    'Jacob Antonio',
    'Uzel Hector Escobido',
    'Lenard Cato Narvaza',
  ],
};
