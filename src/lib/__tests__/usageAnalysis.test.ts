jest.mock('../../config/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test', user: { id: 'a' } } } }) } } }));
import { getUsageDemo, parseUsageAnalysis } from '../usageAnalysis';
import { analyzeUsageData } from '../../services/GeminiService';

const valid = { will_exceed_budget: false, culprit_appliance: 'Possible aircon (unconfirmed)', projected_final_bill: 3374.38, alert_message: 'Pasok pa sa budget; estimate lang ang appliance.' };
describe('Usage analysis mock and validation', () => {
  test('integrates 72 one-hour samples with a three-hour afternoon peak', () => {
    const demo = getUsageDemo();
    expect(demo.readings).toHaveLength(72);
    expect(demo.readings.filter(r => r.watts === 1600)).toHaveLength(9);
    expect(demo.dailyKwh).toBeCloseTo(8.25);
    expect(demo.projected).toBe(3374.38);
    expect(getUsageDemo('warning').projected).toBe(3574.38);
  });
  test('accepts plain JSON and strips JSON code fences', () => {
    expect(parseUsageAnalysis(JSON.stringify(valid), 'baseline')).toEqual(valid);
    expect(parseUsageAnalysis('```json\n' + JSON.stringify(valid) + '\n```', 'baseline')).toEqual(valid);
  });
  test('accepts genuine over-budget projection', () => {
    expect(parseUsageAnalysis(JSON.stringify({ ...valid, will_exceed_budget: true, projected_final_bill: 3574.38 }), 'warning').will_exceed_budget).toBe(true);
  });
  test.each([
    { ...valid, will_exceed_budget: 'false' },
    { ...valid, projected_final_bill: '3374.38' },
    { ...valid, projected_final_bill: null },
    { ...valid, culprit_appliance: '' },
    { ...valid, alert_message: ' ' },
    { ...valid, will_exceed_budget: true },
    { ...valid, projected_final_bill: 4000 },
  ])('rejects malformed or inconsistent results %#', value => {
    expect(() => parseUsageAnalysis(JSON.stringify(value), 'baseline')).toThrow();
  });
});

describe('Mobile analysis transport', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_USAGE_API_URL;
  afterEach(() => { global.fetch = originalFetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_USAGE_API_URL; else process.env.EXPO_PUBLIC_USAGE_API_URL = originalUrl; });
  test('missing configuration gives an actionable error without fabricating output', async () => {
    delete process.env.EXPO_PUBLIC_USAGE_API_URL;
    await expect(analyzeUsageData()).rejects.toThrow('EXPO_PUBLIC_USAGE_API_URL');
  });
  test('posts scenario and propagates abort signal', async () => {
    process.env.EXPO_PUBLIC_USAGE_API_URL = 'http://localhost:8081/';
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => valid });
    global.fetch = request;
    const controller = new AbortController();
    await expect(analyzeUsageData('baseline', controller.signal)).resolves.toEqual(valid);
    expect(request).toHaveBeenCalledWith('http://localhost:8081/api/analyze-usage', expect.objectContaining({ method: 'POST', body: JSON.stringify({ scenario: 'baseline' }), signal: controller.signal }));
  });
  test('surfaces server errors', async () => {
    process.env.EXPO_PUBLIC_USAGE_API_URL = 'http://localhost:8081';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Gemini not configured' }) });
    await expect(analyzeUsageData()).rejects.toThrow('Gemini not configured');
  });
});
