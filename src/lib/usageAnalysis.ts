export type UsageScenario = 'baseline' | 'warning';
export interface UsageAnalysis {
  will_exceed_budget: boolean;
  culprit_appliance: string;
  projected_final_bill: number;
  alert_message: string;
}
export const USAGE_DEMO = { budget: 3500, daysLeft: 5, rate: 11.5 };
export function getUsageDemo(scenario: UsageScenario = 'baseline') {
  const readings = Array.from({ length: 72 }, (_, index) => {
    const hour = index % 24;
    return { day: Math.floor(index / 24) + 1, hour,
      watts: hour >= 13 && hour < 16 ? 1600 : hour >= 18 ? 200 : 150 };
  });
  const currentBill = scenario === 'warning' ? 3100 : 2900;
  const dailyKwh = readings.reduce((sum, r) => sum + r.watts, 0) / 3000;
  const projected = Math.round((currentBill + dailyKwh * USAGE_DEMO.daysLeft * USAGE_DEMO.rate) * 100) / 100;
  return { ...USAGE_DEMO, currentBill, dailyKwh, projected, readings };
}
export function parseUsageAnalysis(raw: string, scenario: UsageScenario): UsageAnalysis {
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  const demo = getUsageDemo(scenario);
  if (!value || typeof value.will_exceed_budget !== 'boolean' ||
      typeof value.culprit_appliance !== 'string' || !value.culprit_appliance.trim() ||
      typeof value.alert_message !== 'string' || !value.alert_message.trim() ||
      typeof value.projected_final_bill !== 'number' || !Number.isFinite(value.projected_final_bill)) {
    throw new Error('The analysis response is incomplete. Please try again.');
  }
  if (Math.abs(value.projected_final_bill - demo.projected) > 0.01 ||
      value.will_exceed_budget !== (demo.projected > demo.budget)) {
    throw new Error('The AI projection did not match the calculated usage. Please try again.');
  }
  return { will_exceed_budget: value.will_exceed_budget,
    culprit_appliance: value.culprit_appliance.trim(), projected_final_bill: demo.projected,
    alert_message: value.alert_message.trim() };
}
