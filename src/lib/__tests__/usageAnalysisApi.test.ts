const mockGetUser = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mockGetUser } }) }));
/** @jest-environment node */
const mockCreate = jest.fn();
jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn().mockImplementation(() => ({ interactions: { create: mockCreate } })) }));
const baseline = { will_exceed_budget: false, culprit_appliance: 'Possible aircon (unconfirmed)', projected_final_bill: 3374.38, alert_message: 'Pasok sa budget. Estimate lang.' };
describe('Usage analysis API', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  beforeEach(() => { jest.resetModules(); process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test'; mockGetUser.mockResolvedValue({ data: { user: { id: 'a', email_confirmed_at: 'yes' } } }); mockCreate.mockReset(); process.env.GEMINI_API_KEY = 'test-key-not-real'; });
  afterAll(() => { if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
  const request = (body: string) => new Request('http://localhost/api/analyze-usage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' }, body });
  test('rejects malformed and unsupported inputs before contacting Gemini', async () => {
    const { POST } = require('../../app/api/analyze-usage+api');
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request('{"scenario":"invalid"}'))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('missing key reports setup problem', async () => {
    delete process.env.GEMINI_API_KEY;
    const { POST } = require('../../app/api/analyze-usage+api');
    expect((await POST(request('{"scenario":"baseline"}'))).status).toBe(503);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('deduplicates concurrent requests and caches validated results', async () => {
    mockCreate.mockResolvedValue({ output_text: JSON.stringify(baseline) });
    const { POST } = require('../../app/api/analyze-usage+api');
    const responses = await Promise.all([POST(request('{"scenario":"baseline"}')), POST(request('{"scenario":"baseline"}'))]);
    expect(await responses[0].json()).toEqual(baseline);
    expect(await responses[1].json()).toEqual(baseline);
    expect((await POST(request('{"scenario":"baseline"}'))).status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
  test('invalid AI output fails without caching it and allows retry', async () => {
    mockCreate.mockResolvedValueOnce({ output_text: 'not json' }).mockResolvedValueOnce({ output_text: JSON.stringify(baseline) });
    const { POST } = require('../../app/api/analyze-usage+api');
    expect((await POST(request('{"scenario":"baseline"}'))).status).toBe(502);
    expect((await POST(request('{"scenario":"baseline"}'))).status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

test('rejects anonymous requests', async () => {
  const { POST } = require('../../app/api/analyze-usage+api');
  expect((await POST(new Request('http://localhost', { method: 'POST' }))).status).toBe(401);
});
test('separates account caches', async () => {
  jest.resetModules();
  process.env.GEMINI_API_KEY = 'test';
  mockCreate.mockClear().mockResolvedValue({ output_text: JSON.stringify(baseline) });
  const { POST } = require('../../app/api/analyze-usage+api');
  for (const id of ['a', 'b']) {
    mockGetUser.mockResolvedValue({ data: { user: { id, email_confirmed_at: 'yes' } } });
    const response = await POST(new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ scenario: 'baseline' }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(mockCreate).toHaveBeenCalledTimes(2);
});
