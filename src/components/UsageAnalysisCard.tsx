import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { analyzeUsageData } from '../services/GeminiService';
import { analyzeUsageWithGeminiClient } from '../lib/geminiService';
import { getUsageDemo, UsageAnalysis, UsageScenario } from '../lib/usageAnalysis';

const peso = (n: number) =>
  '\u20b1' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    setLoading(true);
    setAnalysis(null);
    setError('');

    analyzeUsageData(scenario, controller.signal)
      .catch(async (primaryErr) => {
        if (controller.signal.aborted) throw primaryErr;
        if (process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
          return analyzeUsageWithGeminiClient(scenario, controller.signal);
        }
        throw primaryErr;
      })
      .then((value) => {
        if (active) setAnalysis(value);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.name === 'AbortError'
              ? 'Nag-timeout ang pagsusuri. Subukan muli.'
              : err.message || 'Hindi available ang pagsusuri.'
          );
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [scenario, attempt, user?.id]);

  const color = analysis?.will_exceed_budget ? theme.danger : theme.ok;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Tipi Budget Analysis
          </Text>
          <Text style={[styles.metaLine, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {peso(demo.currentBill)} / {peso(demo.budget)} · {demo.daysLeft}d left
          </Text>
        </View>

        <View style={[styles.segmented, { backgroundColor: theme.cont }]}>
          {(['baseline', 'warning'] as const).map((option) => {
            const active = scenario === option;
            return (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setLoading(true);
                  setAnalysis(null);
                  setError('');
                  setScenario(option);
                }}
                disabled={active}
                style={[
                  styles.segmentBtn,
                  active && { backgroundColor: theme.brand },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: active ? theme.brandInk : theme.ink,
                      fontSize: 11.5 * fontScale,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                >
                  {option === 'baseline' ? 'On-track' : 'Warning'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={[styles.loadingText, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
            Sinusuri ni Tipi...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Text style={[styles.errorText, { color: theme.danger, fontSize: 12.5 * fontScale }]}>
            {error}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setAttempt((n) => n + 1)}
            style={[styles.inlineRetry, { borderColor: theme.brand }]}
          >
            <Text style={{ color: theme.brand, fontWeight: '700', fontSize: 12 * fontScale }}>
              Subukan muli
            </Text>
          </TouchableOpacity>
        </View>
      ) : analysis ? (
        <View
          style={[
            styles.result,
            { backgroundColor: analysis.will_exceed_budget ? theme.dangerBg : theme.okBg },
          ]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.resultTopRow}>
            <Text style={[styles.statusLabel, { color, fontSize: 13 * fontScale }]}>
              {analysis.will_exceed_budget ? '⚠️ Lampas sa Budget' : '✓ Pasok sa Budget'}
            </Text>
            <Text style={[styles.amount, { color, fontSize: 20 * fontScale }]}>
              {peso(analysis.projected_final_bill)}
            </Text>
          </View>

          <Text style={[styles.alertBody, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
            {analysis.alert_message}
          </Text>

          <View style={styles.resultFooterRow}>
            <Text style={[styles.culpritText, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
              🔌 {analysis.culprit_appliance}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setAttempt((n) => n + 1)}
            >
              <Text style={{ color: theme.brand, fontWeight: '700', fontSize: 12 * fontScale }}>
                ↻ I-refresh
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
  },
  metaLine: {
    fontWeight: '600',
    marginTop: 2,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 9999,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  segmentText: {
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  inlineRetry: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  result: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statusLabel: {
    fontWeight: '800',
  },
  amount: {
    fontWeight: '900',
  },
  alertBody: {
    lineHeight: 19,
    fontWeight: '500',
  },
  resultFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  culpritText: {
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
});
