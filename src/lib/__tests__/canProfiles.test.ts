import { PRESET_CAN_PROFILES } from '../../constants/mockData';
import { calculateTierCliff, calculateMeralcoBill } from '../tariffEngine';
import { CANProfile } from '../../types';

describe('Multi-CAN Profiles & Energy Settings', () => {
  it('provides 3 distinct preset CAN profiles with required Meralco fields', () => {
    expect(PRESET_CAN_PROFILES).toHaveLength(3);

    const [can1, can2, can3] = PRESET_CAN_PROFILES;

    // CAN 1: Bahay (Pasig)
    expect(can1.id).toBe('can-1');
    expect(can1.name).toBe('Bahay (Pasig)');
    expect(can1.accountNumber).toBe('0192-8823-4410');
    expect(can1.customerName).toBe('Maria Santos');
    expect(can1.ratePerKwh).toBe(11.43);
    expect(can1.budget).toBe(3500);
    expect(can1.billData.customerAccountNumber).toBe('0192-8823-4410');

    // CAN 2: Tindahan / Negosyo
    expect(can2.id).toBe('can-2');
    expect(can2.name).toBe('Tindahan / Negosyo');
    expect(can2.accountNumber).toBe('0284-9102-3321');
    expect(can2.customerName).toBe('Santos Sari-Sari Store');
    expect(can2.ratePerKwh).toBe(11.48);
    expect(can2.budget).toBe(5000);
    expect(can2.billData.customerAccountNumber).toBe('0284-9102-3321');

    // CAN 3: Condo / Taguig
    expect(can3.id).toBe('can-3');
    expect(can3.name).toBe('Condo / Taguig');
    expect(can3.accountNumber).toBe('0341-7789-5562');
    expect(can3.customerName).toBe('Maria Santos (Condo)');
    expect(can3.ratePerKwh).toBe(11.43);
    expect(can3.budget).toBe(2500);
    expect(can3.billData.customerAccountNumber).toBe('0341-7789-5562');
  });

  it('calculates specific tier cliff statuses correctly for each preset profile', () => {
    const [can1, can2, can3] = PRESET_CAN_PROFILES;

    // CAN 1: 188 kWh -> 12 kWh remaining to 200 threshold -> warning active
    const cliff1 = calculateTierCliff(can1.currentKwh);
    expect(cliff1.currentTier).toBe(1);
    expect(cliff1.nextTierThreshold).toBe(200);
    expect(cliff1.kwhRemaining).toBe(12);
    expect(cliff1.isCliffWarning).toBe(true);

    // CAN 2: 385 kWh -> 15 kWh remaining to 400 threshold -> warning active
    const cliff2 = calculateTierCliff(can2.currentKwh);
    expect(cliff2.currentTier).toBe(3);
    expect(cliff2.nextTierThreshold).toBe(400);
    expect(cliff2.kwhRemaining).toBe(15);
    expect(cliff2.isCliffWarning).toBe(true);

    // CAN 3: 125 kWh -> 75 kWh remaining to 200 threshold -> safe, warning inactive
    const cliff3 = calculateTierCliff(can3.currentKwh);
    expect(cliff3.currentTier).toBe(1);
    expect(cliff3.nextTierThreshold).toBe(200);
    expect(cliff3.kwhRemaining).toBe(75);
    expect(cliff3.isCliffWarning).toBe(false);
  });

  it('calculates Meralco bill projections correctly per CAN profile consumption', () => {
    const [can1, can2, can3] = PRESET_CAN_PROFILES;

    const bill1 = calculateMeralcoBill(can1.currentKwh);
    const bill2 = calculateMeralcoBill(can2.currentKwh);
    const bill3 = calculateMeralcoBill(can3.currentKwh);

    expect(bill1.totalAmountDue).toBeGreaterThan(0);
    expect(bill2.totalAmountDue).toBeGreaterThan(bill1.totalAmountDue);
    expect(bill3.totalAmountDue).toBeLessThan(bill1.totalAmountDue);

    // CAN 2 (385 kWh) should be in Tier 3
    expect(bill2.currentTier).toBe(3);
    // CAN 3 (125 kWh) should be in Tier 1
    expect(bill3.currentTier).toBe(1);
  });

  it('supports simulated CAN profile switching without state cross-contamination', () => {
    let profiles: CANProfile[] = JSON.parse(JSON.stringify(PRESET_CAN_PROFILES));
    let activeId = 'can-1';

    const getActive = () => profiles.find((p) => p.id === activeId) || profiles[0];

    // Initial state: CAN 1
    expect(getActive().accountNumber).toBe('0192-8823-4410');
    expect(getActive().budget).toBe(3500);

    // Switch to CAN 2
    activeId = 'can-2';
    expect(getActive().accountNumber).toBe('0284-9102-3321');
    expect(getActive().name).toBe('Tindahan / Negosyo');
    expect(getActive().budget).toBe(5000);
    expect(getActive().currentKwh).toBe(385);

    // Modify CAN 2's budget
    profiles = profiles.map((p) => (p.id === 'can-2' ? { ...p, budget: 6000 } : p));
    expect(getActive().budget).toBe(6000);

    // Switch back to CAN 1 and verify CAN 1 was NOT mutated
    activeId = 'can-1';
    expect(getActive().accountNumber).toBe('0192-8823-4410');
    expect(getActive().budget).toBe(3500);

    // Switch to CAN 3
    activeId = 'can-3';
    expect(getActive().accountNumber).toBe('0341-7789-5562');
    expect(getActive().budget).toBe(2500);
  });

  it('supports renaming a CAN profile with whitespace trimming without mutating immutable account numbers', () => {
    const originalProfiles = JSON.parse(JSON.stringify(PRESET_CAN_PROFILES));
    const rawInput = '  Aming Bahay sa Pasig  ';
    const trimmed = rawInput.trim();

    const updated = originalProfiles.map((p: CANProfile) =>
      p.id === 'can-1' ? { ...p, name: trimmed } : p
    );

    const renamedCan1 = updated.find((p: CANProfile) => p.id === 'can-1');
    expect(renamedCan1?.name).toBe('Aming Bahay sa Pasig');
    expect(renamedCan1?.accountNumber).toBe('0192-8823-4410');

    // CAN 2 and CAN 3 should remain completely untouched
    const can2 = updated.find((p: CANProfile) => p.id === 'can-2');
    expect(can2?.name).toBe('Tindahan / Negosyo');
    expect(can2?.accountNumber).toBe('0284-9102-3321');
  });
});
