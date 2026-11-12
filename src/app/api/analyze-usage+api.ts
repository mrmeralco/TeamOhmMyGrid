import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { getUsageDemo, parseUsageAnalysis, UsageScenario, UsageAnalysis } from '../../lib/usageAnalysis';

const cache = new Map<string, { value: UsageAnalysis; expires: number }>();
const pending = new Map<string, Promise<UsageAnalysis>>();
const schema = {
  type: 'object', properties: {
    will_exceed_budget: { type: 'boolean' }, culprit_appliance: { type: 'string' },
    projected_final_bill: { type: 'number' }, alert_message: { type: 'string' },
  }, required: ['will_exceed_budget', 'culprit_appliance', 'projected_final_bill', 'alert_message'],
  additionalProperties: false,
};
async function generate(scenario: UsageScenario): Promise<UsageAnalysis> {
  const demo = getUsageDemo(scenario);
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 35000 } });
  const result = await client.interactions.create({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    input: 'You are Tipi, a concise Filipino household energy coach. Analyze this mock dataset: ' + JSON.stringify(demo) +
      '. Each reading is average W for one hour. 13:00-16:00 is exactly three hours; evening is 18:00-24:00. ' +
      'Use projected_final_bill exactly ' + demo.projected + ', and will_exceed_budget exactly ' + (demo.projected > demo.budget) + '. ' +
      'The projection is currentBill + dailyKwh * daysLeft * rate. Assume the next five days repeat the average. ' +
      'A rise from 150W to 1600W means about 1450W additional load. Aircon is plausible, not certain. ' +
      'Set culprit_appliance to a cautious hypothesis such as Possible aircon (unconfirmed). This is not validated NILM. ' +
      'Write alert_message in at most 3 short sentences and 55 words of friendly Taglish. Use everyday words elderly people understand. Avoid jargon. If over budget, state projected excess and suggest one action. ' +
      'Otherwise explain on-track status and projected remaining margin. Mention the appliance is only an estimate. ' +
      'This is an illustrative flat-rate estimate, not an actual Meralco bill. Return only the requested JSON.',
    response_format: { type: 'text', mime_type: 'application/json', schema },
  });
  if (!result.output_text) throw new Error('Empty model response');
  return parseUsageAnalysis(result.output_text, scenario);
}
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Please log in first.' }, { status: 401 });
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: 'Sign-in unavailable.' }, { status: 503 });
  let userId: string;
  try {
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user?.id || !data.user.email_confirmed_at) return Response.json({ error: 'Please log in again.' }, { status: 401 });
    userId = data.user.id;
  } catch { return Response.json({ error: 'Please log in again.' }, { status: 401 }); }

  let scenario: UsageScenario;
  try {
    const body = await request.json();
    if (!body || !['baseline', 'warning'].includes(body.scenario)) {
      return Response.json({ error: 'Choose baseline or warning demo.' }, { status: 400 });
    }
    scenario = body.scenario;
  } catch {
    return Response.json({ error: 'Invalid request JSON.' }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: 'Gemini is not configured on the server yet. Add GEMINI_API_KEY and restart Expo.' }, { status: 503 });
  const cacheKey = JSON.stringify([userId, scenario]);
  try {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return Response.json(cached.value, { headers: { 'Cache-Control': 'private, no-store' } });
    let job = pending.get(cacheKey);
    if (!job) {
      job = generate(scenario).then(value => {
        cache.set(cacheKey, { value, expires: Date.now() + 300000 });
        return value;
      }).finally(() => { pending.delete(cacheKey); });
      pending.set(cacheKey, job);
    }
    return Response.json(await job, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Hindi muna ma-analyze ang usage. Check Gemini access or try again shortly.' }, { status: 502 });
  }
}
