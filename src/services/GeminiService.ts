import { supabase } from '../config/supabase';
import { parseUsageAnalysis, UsageScenario, UsageAnalysis } from '../lib/usageAnalysis';

// Client transport only. The Gemini key and SDK stay in the API route.
export async function analyzeUsageData(scenario: UsageScenario = 'baseline', signal?: AbortSignal): Promise<UsageAnalysis> {
  const base = process.env.EXPO_PUBLIC_USAGE_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Set EXPO_PUBLIC_USAGE_API_URL to your Expo server address to enable Gemini analysis.');
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session) throw new Error('Please log in first.');
  const response = await fetch(base + '/api/analyze-usage', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ scenario }), signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Analysis unavailable. Please try again.');
  const current = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (current?.user.id !== session.user.id) throw new Error('Account changed. Please try again.');
  return parseUsageAnalysis(JSON.stringify(data), scenario);
}
