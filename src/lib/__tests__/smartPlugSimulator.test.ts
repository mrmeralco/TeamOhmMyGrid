import { smartPlugSimulator, INITIAL_SMART_PLUGS, isScheduleActiveNow } from '../smartPlugSimulator';

describe('Smart Plug Simulator & IoT Integration', () => {
  afterAll(() => {
    smartPlugSimulator.destroy();
  });
  it('initializes with all 7 distinct smart plugs matching digital twin appliances', () => {
    const plugs = smartPlugSimulator.getPlugs();
    expect(plugs.length).toBe(7);

    const ids = plugs.map((p) => p.id);
    expect(ids).toContain('plug_ac_01');
    expect(ids).toContain('plug_fridge_02');
    expect(ids).toContain('plug_fan_03');
    expect(ids).toContain('plug_washer_04');
    expect(ids).toContain('plug_cooker_05');
    expect(ids).toContain('plug_micro_06');
    expect(ids).toContain('plug_pc_07');
  });

  it('correctly calculates total active watts for enabled plugs', () => {
    const initialWatts = smartPlugSimulator.getTotalActiveWatts();
    expect(initialWatts).toBeGreaterThan(0);
  });

  it('toggles relay state from ON to OFF and drops active watts to 0', () => {
    const plugsBefore = smartPlugSimulator.getPlugs();
    const acPlug = plugsBefore.find((p) => p.id === 'plug_ac_01');
    expect(acPlug?.relayState).toBe('ON');
    expect(acPlug?.powerWatts).toBeGreaterThan(0);

    // Turn OFF
    smartPlugSimulator.togglePlugRelay('plug_ac_01');
    const plugsAfterOff = smartPlugSimulator.getPlugs();
    const acAfterOff = plugsAfterOff.find((p) => p.id === 'plug_ac_01');
    expect(acAfterOff?.relayState).toBe('OFF');
    expect(acAfterOff?.powerWatts).toBe(0);
    expect(acAfterOff?.currentAmps).toBe(0);

    // Turn back ON
    smartPlugSimulator.togglePlugRelay('plug_ac_01');
    const plugsAfterOn = smartPlugSimulator.getPlugs();
    const acAfterOn = plugsAfterOn.find((p) => p.id === 'plug_ac_01');
    expect(acAfterOn?.relayState).toBe('ON');
    expect(acAfterOn?.powerWatts).toBe(850);
  });

  it('verifies all required telemetry fields for every smart plug', () => {
    const plugs = smartPlugSimulator.getPlugs();
    for (const plug of plugs) {
      expect(typeof plug.voltageRms).toBe('number');
      expect(plug.voltageRms).toBeGreaterThanOrEqual(220);
      expect(plug.voltageRms).toBeLessThanOrEqual(240);

      expect(typeof plug.currentAmps).toBe('number');
      expect(plug.currentAmps).toBeGreaterThanOrEqual(0);

      expect(typeof plug.powerFactor).toBe('number');
      expect(plug.powerFactor).toBeGreaterThan(0);
      expect(plug.powerFactor).toBeLessThanOrEqual(1.0);

      expect(typeof plug.accumulatedKwh).toBe('number');
      expect(plug.accumulatedKwh).toBeGreaterThanOrEqual(0);

      expect(typeof plug.monthlyCost).toBe('number');
      expect(plug.monthlyCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('sets, counts down, and cancels auto-off timers', () => {
    // Set timer on Microwave for 1800 seconds (30m)
    smartPlugSimulator.setPlugTimer('plug_micro_06', 1800, 'OFF');
    let micro = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_micro_06');
    expect(micro?.timer?.active).toBe(true);
    expect(micro?.timer?.targetSeconds).toBe(1800);
    expect(micro?.timer?.remainingSeconds).toBe(1800);
    expect(micro?.timer?.action).toBe('OFF');

    // Cancel timer
    smartPlugSimulator.cancelPlugTimer('plug_micro_06');
    micro = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_micro_06');
    expect(micro?.timer?.active).toBe(false);
    expect(micro?.timer?.remainingSeconds).toBe(0);
  });

  it('configures schedule with custom times and active days', () => {
    smartPlugSimulator.setPlugSchedule('plug_washer_04', {
      enabled: true,
      startTime: '20:30',
      endTime: '22:30',
      days: ['Sat', 'Sun'],
      label: 'Off-Peak Laundry',
    });

    const washer = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_washer_04');
    expect(washer?.schedule?.enabled).toBe(true);
    expect(washer?.schedule?.startTime).toBe('20:30');
    expect(washer?.schedule?.endTime).toBe('22:30');
    expect(washer?.schedule?.days).toEqual(['Sat', 'Sun']);
    expect(washer?.schedule?.label).toBe('Off-Peak Laundry');
  });

  it('explicitly actuates relay via setPlugRelay', () => {
    smartPlugSimulator.setPlugRelay('plug_pc_07', 'OFF');
    let pc = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_pc_07');
    expect(pc?.relayState).toBe('OFF');
    expect(pc?.powerWatts).toBe(0);

    smartPlugSimulator.setPlugRelay('plug_pc_07', 'ON');
    pc = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_pc_07');
    expect(pc?.relayState).toBe('ON');
    expect(pc?.powerWatts).toBe(285);
  });

  it('batches master relay control via setAllPlugsRelay', () => {
    // Turn all OFF
    smartPlugSimulator.setAllPlugsRelay('OFF');
    let plugs = smartPlugSimulator.getPlugs();
    expect(plugs.every((p) => p.relayState === 'OFF')).toBe(true);
    expect(smartPlugSimulator.getTotalActiveWatts()).toBe(0);

    // Turn all ON
    smartPlugSimulator.setAllPlugsRelay('ON');
    plugs = smartPlugSimulator.getPlugs();
    expect(plugs.every((p) => p.relayState === 'ON')).toBe(true);
    expect(smartPlugSimulator.getTotalActiveWatts()).toBeGreaterThan(1000);
  });

  it('cancels active auto-off timer when plug is turned OFF manually', () => {
    // Turn on plug and set an active timer
    smartPlugSimulator.setPlugRelay('plug_fan_03', 'ON');
    smartPlugSimulator.setPlugTimer('plug_fan_03', 1800, 'OFF');
    let fan = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_fan_03');
    expect(fan?.timer?.active).toBe(true);

    // Turn off plug manually -> timer should be canceled
    smartPlugSimulator.setPlugRelay('plug_fan_03', 'OFF');
    fan = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_fan_03');
    expect(fan?.relayState).toBe('OFF');
    expect(fan?.timer?.active).toBe(false);
    expect(fan?.timer?.remainingSeconds).toBe(0);
  });

  it('turns plug ON when an auto-off timer is configured on an OFF device', () => {
    smartPlugSimulator.setPlugRelay('plug_cooker_05', 'OFF');
    let cooker = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_cooker_05');
    expect(cooker?.relayState).toBe('OFF');

    // Setting an auto-off timer starts device operation
    smartPlugSimulator.setPlugTimer('plug_cooker_05', 900, 'OFF');
    cooker = smartPlugSimulator.getPlugs().find((p) => p.id === 'plug_cooker_05');
    expect(cooker?.relayState).toBe('ON');
    expect(cooker?.powerWatts).toBe(700);
    expect(cooker?.timer?.active).toBe(true);
    expect(cooker?.timer?.remainingSeconds).toBe(900);
  });

  it('evaluates whether a schedule is currently active across standard and overnight windows', () => {
    // Disabled schedule
    expect(isScheduleActiveNow({ enabled: false, startTime: '08:00', endTime: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] })).toBe(false);

    // Standard daytime window: Monday at 10:30 AM
    const monday1030 = new Date('2026-11-16T10:30:00'); // 2026-11-16 is a Monday
    const weekdayDaytimeSchedule = {
      enabled: true,
      startTime: '09:00',
      endTime: '17:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    };
    expect(isScheduleActiveNow(weekdayDaytimeSchedule, monday1030)).toBe(true);

    // Outside window: Monday at 18:30 (6:30 PM)
    const monday1830 = new Date('2026-11-16T18:30:00');
    expect(isScheduleActiveNow(weekdayDaytimeSchedule, monday1830)).toBe(false);

    // Overnight window: 22:00 to 06:00
    const overnightSchedule = {
      enabled: true,
      startTime: '22:00',
      endTime: '06:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
    const night2300 = new Date('2026-11-16T23:00:00');
    const morning0400 = new Date('2026-11-16T04:00:00');
    const noon1200 = new Date('2026-11-16T12:00:00');

    expect(isScheduleActiveNow(overnightSchedule, night2300)).toBe(true);
    expect(isScheduleActiveNow(overnightSchedule, morning0400)).toBe(true);
    expect(isScheduleActiveNow(overnightSchedule, noon1200)).toBe(false);
  });
});
