import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { analyzeUsageData } from '../services/GeminiService';
import { getUsageDemo, UsageAnalysis, UsageScenario } from '../lib/usageAnalysis';

const peso = (n: number) => '\u20b1' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function UsageAnalysisCard() {
  const { user } = useAuth();
  const { theme, fontScale } = useTheme();
  const [scenario, setScenario] = useState<UsageScenario>('baseline');
  const [analysis, setAnalysis] = useState<UsageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const demo = getUsageDemo(scenario);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 45000);
    setLoading(true); setAnalysis(null); setError('');
    analyzeUsageData(scenario, controller.signal).then(value => {
      if (active) setAnalysis(value);
    }).catch(err => {
      if (active) setError(err.name === 'AbortError' ? 'Analysis timed out. Please try again.' : err.message || 'Analysis unavailable.');
    }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [scenario, attempt, user?.id]);
  const color = analysis?.will_exceed_budget ? theme.danger : theme.ok;
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
    <Text style={[styles.title, { color: theme.ink, fontSize: 18 * fontScale }]}>Tipi budget analysis</Text>
    <Text style={[styles.body, { color: theme.muted, fontSize: 12 * fontScale }]}>MOCK DATA DEMO - separate from your account totals above. Gemini estimates the likely appliance; it cannot confirm its identity.</Text>
    <View style={styles.options}>
      {(['baseline', 'warning'] as const).map(option => <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: scenario === option }}
        onPress={() => { setLoading(true); setAnalysis(null); setError(''); setScenario(option); }} disabled={scenario === option}
        style={[styles.option, { backgroundColor: scenario === option ? theme.brand : theme.cont, borderColor: theme.line }]}>
        <Text style={{ color: scenario === option ? theme.brandInk : theme.ink, fontSize: 13 * fontScale }}>{option === 'baseline' ? 'On-track example' : 'Warning example'}</Text>
      </TouchableOpacity>)}
    </View>
    <Text style={[styles.body, { color: theme.muted, fontSize: 13 * fontScale }]}>{peso(demo.currentBill)} so far / {peso(demo.budget)} budget{'\n'}5 days left - {peso(demo.rate)}/kWh</Text>
    {loading ? <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.brand} /><Text style={{ color: theme.muted }}>Sinusuri ang mock usage...</Text></View>
      : error ? <View accessibilityLiveRegion="polite"><Text style={[styles.body, { color: theme.danger, fontSize: 14 * fontScale }]}>{error}</Text></View>
      : analysis ? <View style={[styles.result, { backgroundColor: analysis.will_exceed_budget ? theme.dangerBg : theme.okBg }]} accessibilityLiveRegion="polite">
        <Text style={[styles.title, { color, fontSize: 18 * fontScale }]}>{analysis.will_exceed_budget ? 'Budget warning' : 'On track'}</Text>
        <Text style={[styles.body, { color, fontSize: 15 * fontScale }]}>{analysis.alert_message}</Text>
        <Text style={{ color, fontSize: 13 * fontScale }}>Projected final bill</Text>
        <Text style={[styles.amount, { color, fontSize: 28 * fontScale }]}>{peso(analysis.projected_final_bill)}</Text>
        <Text style={[styles.body, { color, fontSize: 14 * fontScale }]}>Possible appliance: {analysis.culprit_appliance}</Text>
      </View> : null}
    {!loading && <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(n => n + 1)} style={[styles.retry, { borderColor: theme.brand }]}>
      <Text style={{ color: theme.brand, fontWeight: '700', fontSize: 14 * fontScale }}>{error ? 'Try again' : 'Refresh analysis'}</Text>
    </TouchableOpacity>}
    <Text style={[styles.body, { color: theme.muted, fontSize: 12 * fontScale }]}>Three identical mock days: 150 W baseline, 1600 W from 13:00-16:00, and 200 W from 18:00-24:00. Assumes this pattern continues; actual billing may differ. AI responses may be reused for five minutes.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 16, padding: 16, marginVertical: 6, gap: 12 },
  title: { fontWeight: '800' }, body: { lineHeight: 22 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 10, justifyContent: 'center' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  result: { borderRadius: 12, padding: 16, gap: 10 }, amount: { fontWeight: '800' },
  retry: { minHeight: 48, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
