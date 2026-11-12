import {
  calculateDistributionCharge,
  calculateMeralcoBill,
  calculateTierCliff,
  calculateWhatIfSavings,
} from '../tariffEngine';

describe('Tariff Engine & Mathematical Verification', () => {
  test('test_distribution_charge_tier_1: 150 kWh yields exactly ₱154.35', () => {
    const charge = calculateDistributionCharge(150);
    expect(charge).toBe(154.35);
  });

  test('test_distribution_charge_tier_2: 215 kWh yields exactly ₱225.90', () => {
    const charge = calculateDistributionCharge(215);
    expect(charge).toBe(225.90);
  });

  test('test_tier_cliff_warning: 188 kWh triggers cliff warning with 12 kWh remaining', () => {
    const cliff = calculateTierCliff(188);
    expect(cliff.currentTier).toBe(1);
    expect(cliff.nextTierThreshold).toBe(200);
    expect(cliff.kwhRemaining).toBe(12);
    expect(cliff.isCliffWarning).toBe(true);
  });

  test('test_whatif_ac_temperature_raise: 20°C -> 24°C yields ₱482.00 monthly savings', () => {
    const result = calculateWhatIfSavings({
      currentHouseholdKwh: 0,
      baselineTemp: 20,
      targetTemp: 24,
      baselineHoursPerDay: 8,
      reducedHoursPerDay: 8,
      ratedWatts: 1100,
      isInverter: true,
    });

    expect(result.kwhSavedMonthly).toBe(42.24);
    expect(result.pesoSavedMonthly).toBe(482.00);
    expect(result.formulaExplanation).toContain('1100 W');
    expect(result.formulaExplanation).toContain('16% na bawas');
  });

  test('calculateMeralcoBill: verifies bill breakdown and VAT calculation', () => {
    const bill = calculateMeralcoBill(200);
    expect(bill.currentTier).toBe(1);
    expect(bill.breakdown.distribution).toBe(205.80);
    expect(bill.breakdown.generation).toBe(1316.24);
    expect(bill.breakdown.transmission).toBe(164.90);
    expect(bill.breakdown.systemLoss).toBe(122.46);
    expect(bill.totalAmountDue).toBeGreaterThan(0);
  });
});
