import { MeralcoRateTable, WhatIfSimulationInput, WhatIfSimulationResult } from '../types';

export const DEFAULT_MERALCO_RATES: MeralcoRateTable = {
  generationRate: 6.5812,
  transmissionRate: 0.8245,
  systemLossRate: 0.6123,
  distributionTiers: {
    tier1: 1.029, // <= 200 kWh
    tier2: 1.340, // 200 < K <= 300 kWh
    tier3: 1.645, // 300 < K <= 400 kWh
    tier4: 2.184, // > 400 kWh
  },
  lifelineThreshold: 100,
  vatRate: 0.12,
};

export const MERALCO_EFFECTIVE_RATE = 11.410985; // Benchmark residential all-in effective rate (₱/kWh)

/**
 * Calculates piecewise stepped Distribution charge (DSM) according to Meralco residential brackets:
 * - Tier 1: <= 200 kWh: K * 1.029
 * - Tier 2: 200 < K <= 300: 200 * 1.029 + (K - 200) * 1.340
 * - Tier 3: 300 < K <= 400: 200 * 1.029 + 100 * 1.340 + (K - 300) * 1.645
 * - Tier 4: > 400: 200 * 1.029 + 100 * 1.340 + 100 * 1.645 + (K - 400) * 2.184
 */
export function calculateDistributionCharge(kwh: number, rates: MeralcoRateTable = DEFAULT_MERALCO_RATES): number {
  if (kwh <= 0) return 0;
  const { tier1, tier2, tier3, tier4 } = rates.distributionTiers;

  if (kwh <= 200) {
    return Number((kwh * tier1).toFixed(2));
  } else if (kwh <= 300) {
    const charge = 200 * tier1 + (kwh - 200) * tier2;
    return Number(charge.toFixed(2));
  } else if (kwh <= 400) {
    const charge = 200 * tier1 + 100 * tier2 + (kwh - 300) * tier3;
    return Number(charge.toFixed(2));
  } else {
    const charge = 200 * tier1 + 100 * tier2 + 100 * tier3 + (kwh - 400) * tier4;
    return Number(charge.toFixed(2));
  }
}

/**
 * Calculates complete Meralco residential bill with pass-through components and statutory VAT.
 */
export function calculateMeralcoBill(
  kwh: number,
  rates: MeralcoRateTable = DEFAULT_MERALCO_RATES
): {
  totalAmountDue: number;
  breakdown: {
    generation: number;
    transmission: number;
    systemLoss: number;
    distribution: number;
    vat: number;
    other: number;
  };
  currentTier: number;
} {
  if (kwh <= 0) {
    return {
      totalAmountDue: 0,
      breakdown: { generation: 0, transmission: 0, systemLoss: 0, distribution: 0, vat: 0, other: 0 },
      currentTier: 1,
    };
  }

  const generation = Number((kwh * rates.generationRate).toFixed(2));
  const transmission = Number((kwh * rates.transmissionRate).toFixed(2));
  const systemLoss = Number((kwh * rates.systemLossRate).toFixed(2));
  const distribution = calculateDistributionCharge(kwh, rates);

  const subtotal = generation + transmission + systemLoss + distribution;
  const vat = Number((subtotal * rates.vatRate).toFixed(2));
  const totalAmountDue = Number((subtotal + vat).toFixed(2));

  let currentTier = 1;
  if (kwh > 400) currentTier = 4;
  else if (kwh > 300) currentTier = 3;
  else if (kwh > 200) currentTier = 2;

  return {
    totalAmountDue,
    breakdown: {
      generation,
      transmission,
      systemLoss,
      distribution,
      vat,
      other: 0,
    },
    currentTier,
  };
}

/**
 * Tier cliff detection: notifies user when within 25 kWh buffer of stepping into next DSM bracket.
 */
export function calculateTierCliff(currentKwh: number): {
  currentTier: number;
  nextTierThreshold: number;
  kwhRemaining: number;
  isCliffWarning: boolean;
} {
  let currentTier = 1;
  let nextTierThreshold = 200;

  if (currentKwh > 400) {
    return {
      currentTier: 4,
      nextTierThreshold: 400,
      kwhRemaining: 0,
      isCliffWarning: false,
    };
  } else if (currentKwh > 300) {
    currentTier = 3;
    nextTierThreshold = 400;
  } else if (currentKwh > 200) {
    currentTier = 2;
    nextTierThreshold = 300;
  } else {
    currentTier = 1;
    nextTierThreshold = 200;
  }

  const kwhRemaining = Math.max(0, Number((nextTierThreshold - currentKwh).toFixed(2)));
  const isCliffWarning = kwhRemaining <= 25 && kwhRemaining > 0;

  return {
    currentTier,
    nextTierThreshold,
    kwhRemaining,
    isCliffWarning,
  };
}

/**
 * What-If delta math for appliance temperature and operating hour adjustments:
 * E_base = (Wattage * Hours_base * 30) / 1000
 * E_new = (Wattage * (1 - deltaTemp * 0.04) * Hours_new * 30) / 1000
 * Delta kWh = E_base - E_new
 */
export function calculateWhatIfSavings(
  input: WhatIfSimulationInput,
  rates: MeralcoRateTable = DEFAULT_MERALCO_RATES
): WhatIfSimulationResult {
  const diffTemp = Math.max(0, input.targetTemp - input.baselineTemp);
  const tempReductionFactor = 1 - diffTemp * 0.04;

  let activeNewHours = input.baselineHoursPerDay;
  if (input.reducedHoursPerDay && input.reducedHoursPerDay > 0) {
    activeNewHours = input.reducedHoursPerDay;
  }

  const eBase = (input.ratedWatts * input.baselineHoursPerDay * 30) / 1000;
  const eNew = (input.ratedWatts * tempReductionFactor * activeNewHours * 30) / 1000;
  const kwhSavedMonthly = Math.max(0, Number((eBase - eNew).toFixed(2)));

  const baseBill = calculateMeralcoBill(input.currentHouseholdKwh, rates);
  const newHouseholdKwh = Math.max(0, input.currentHouseholdKwh - kwhSavedMonthly);
  const newBill = calculateMeralcoBill(newHouseholdKwh, rates);

  // If household consumption provided and yields bill difference, use exact delta; otherwise benchmark effective rate
  let pesoSavedMonthly: number;
  if (input.currentHouseholdKwh > 0 && baseBill.totalAmountDue > newBill.totalAmountDue) {
    pesoSavedMonthly = Number((baseBill.totalAmountDue - newBill.totalAmountDue).toFixed(2));
  } else {
    pesoSavedMonthly = Number((kwhSavedMonthly * MERALCO_EFFECTIVE_RATE).toFixed(2));
  }

  const achievedTierDrop = newBill.currentTier < baseBill.currentTier;
  const formulaExplanation = `${input.ratedWatts} W × ${activeNewHours} oras × 30 araw = ${eNew.toFixed(1)} kWh, may ${Math.round(diffTemp * 4)}% na bawas sa temperatura`;

  return {
    kwhSavedMonthly,
    pesoSavedMonthly,
    formulaExplanation,
    achievedTierDrop,
  };
}
