// ==============================================================================
// KuryenTipid - AMI Peak vs Off-Peak Analytics Card
// Displays high-demand peak hours vs low-demand off-peak energy metrics,
// percentage breakdown progress bar, cost allocations, and actionable
// load-shifting recommendations to reduce electricity expenses.
// Conforms to PROJECT.md § Interface Contracts
// ==============================================================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AmiTelemetryDataset, AmiTimeframe } from '../types/amiTelemetry';
import {
  generateAmiTelemetry,
  formatCurrency,
  calculatePeakSavingsRecommendation,
} from '../services/amiTelemetryService';
import { MERALCO_EFFECTIVE_RATE } from '../lib/tariffEngine';

export interface AmiPeakBreakdownCardProps {
  /** Optional pre-computed telemetry dataset */
  dataset?: AmiTelemetryDataset;
  /** CAN string if generating dataset dynamically */
  can?: string;
  /** Active timeframe: 'day' | 'week' | 'month' | 'year' (default: 'day') */
  timeframe?: AmiTimeframe;
  /** Specific target date string (e.g. '2026-05-18') */
  targetDate?: string;
  /** Optional press handler for the shift savings recommendation callout */
  onShiftSavingsPress?: () => void;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
}

export const AmiPeakBreakdownCard: React.FC<AmiPeakBreakdownCardProps> = ({
  dataset: externalDataset,
  can = '0192-8823-4410',
  timeframe = 'day',
  targetDate,
  onShiftSavingsPress,
  style,
  testID = 'ami-peak-breakdown-card',
}) => {
  const { theme, fontScale, language } = useTheme();

  // Resolve or generate dataset
  const dataset: AmiTelemetryDataset = useMemo(() => {
    if (externalDataset) return externalDataset;
    return generateAmiTelemetry(can, timeframe, targetDate);
  }, [externalDataset, can, timeframe, targetDate]);

  // Scale Peak and Off-Peak kWh to the selected timeframe when not using an explicit single-day externalDataset
  const scaledMetrics = useMemo(() => {
    const activeTf = externalDataset ? externalDataset.timeframe : timeframe;
    if (activeTf === 'day' || dataset.summaryByBucket.length === 0) {
      return {
        peakKwh: dataset.peakKwh,
        offPeakKwh: dataset.offPeakKwh,
        totalKwh: dataset.totalKwh,
        peakPercentage: dataset.peakPercentage,
        potentialShiftSavings: dataset.potentialShiftSavings,
      };
    }

    const hasBucketSplits = dataset.summaryByBucket.some((b) => b.peakKwh !== undefined);
    let sumPeak = 0;
    let sumOffPeak = 0;
    if (hasBucketSplits) {
      for (const b of dataset.summaryByBucket) {
        sumPeak += b.peakKwh ?? 0;
        sumOffPeak += b.offPeakKwh ?? 0;
      }
    } else {
      const sumTotal = dataset.summaryByBucket.reduce((acc, b) => acc + b.kwh, 0);
      sumPeak = sumTotal * (dataset.peakPercentage / 100);
      sumOffPeak = sumTotal - sumPeak;
    }

    const sumTotal = Number((sumPeak + sumOffPeak).toFixed(2));
    const pct = sumTotal > 0 ? Number(((sumPeak / sumTotal) * 100).toFixed(1)) : 0.0;
    return {
      peakKwh: Number(sumPeak.toFixed(2)),
      offPeakKwh: Number(sumOffPeak.toFixed(2)),
      totalKwh: sumTotal,
      peakPercentage: pct,
      potentialShiftSavings: dataset.potentialShiftSavings,
    };
  }, [dataset, externalDataset, timeframe]);

  const {
    peakKwh,
    offPeakKwh,
    totalKwh,
    peakPercentage,
    potentialShiftSavings,
  } = scaledMetrics;

  const offPeakPercentage = totalKwh > 0
    ? Number((100 - peakPercentage).toFixed(1))
    : 0.0;

  // Rate per kWh for cost breakdowns
  const effectiveRate = MERALCO_EFFECTIVE_RATE;
  const peakCost = Number((peakKwh * effectiveRate).toFixed(2));
  const offPeakCost = Number((offPeakKwh * effectiveRate).toFixed(2));

  // Shift-savings recommendation
  const recommendationText =
    language === 'english'
      ? peakPercentage > 35.0
        ? 'Reduce consumption during peak hours (2-5 PM and 6-9 PM) and shift ironing or laundry to after 9 PM to save on electricity.'
        : 'Your electricity consumption is well balanced, with most usage occurring during off-peak hours.'
      : calculatePeakSavingsRecommendation(peakPercentage, peakKwh, effectiveRate);

  const isHighPeak = peakPercentage > 35.0;

  return (
    <View
      testID={testID}
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
        },
        style,
      ]}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Peak vs Off-Peak
          </Text>
        </View>

        <View
          style={[
            styles.badgePill,
            {
              backgroundColor: isHighPeak ? theme.warnBg : theme.okBg,
              borderColor: isHighPeak ? theme.warn : theme.ok,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: isHighPeak ? theme.warn : theme.ok,
                fontSize: 11 * fontScale,
              },
            ]}
          >
            {isHighPeak
              ? language === 'english'
                ? 'High Peak'
                : 'Mataas ang Peak'
              : language === 'english'
              ? 'Balanced'
              : 'Balanse'}
          </Text>
        </View>
      </View>

      {/* Dual Progress Meter Track */}
      <View style={styles.meterContainer}>
        <View style={styles.meterBar}>
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor: theme.peak,
                flex: Math.max(0.01, peakPercentage),
              },
            ]}
          />
          <View
            style={[
              styles.meterSegment,
              {
                backgroundColor: theme.ok,
                flex: Math.max(0.01, offPeakPercentage),
              },
            ]}
          />
        </View>

        <View style={styles.meterLabelsRow}>
          <View style={styles.meterLabelItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.peak }]} />
            <Text style={[styles.meterLabelText, { color: theme.ink, fontSize: 12 * fontScale }]}>
              {peakPercentage}% Peak
            </Text>
          </View>
          <View style={styles.meterLabelItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.ok }]} />
            <Text style={[styles.meterLabelText, { color: theme.ink, fontSize: 12 * fontScale }]}>
              {offPeakPercentage}% Off-Peak
            </Text>
          </View>
        </View>
      </View>

      {/* 2x2 Metric Grid */}
      <View style={styles.gridContainer}>
        {/* Peak Energy Column */}
        <View style={[styles.metricTile, { backgroundColor: theme.cont, borderColor: theme.line }]}>
          <Text style={[styles.tileHeader, { color: theme.peak, fontSize: 11 * fontScale }]}>
            PEAK
          </Text>
          <Text
            testID="peak-kwh-value"
            style={[styles.tileValue, { color: theme.ink, fontSize: 16 * fontScale }]}
          >
            {peakKwh.toFixed(2)} kWh
          </Text>
          <Text style={[styles.tileCost, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {formatCurrency(peakCost)}
          </Text>
        </View>

        {/* Off-Peak Energy Column */}
        <View style={[styles.metricTile, { backgroundColor: theme.cont, borderColor: theme.line }]}>
          <Text style={[styles.tileHeader, { color: theme.ok, fontSize: 11 * fontScale }]}>
            OFF-PEAK
          </Text>
          <Text
            testID="offpeak-kwh-value"
            style={[styles.tileValue, { color: theme.ink, fontSize: 16 * fontScale }]}
          >
            {offPeakKwh.toFixed(2)} kWh
          </Text>
          <Text style={[styles.tileCost, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {formatCurrency(offPeakCost)}
          </Text>
        </View>
      </View>

      {/* Potential Shift Savings Callout Box */}
      <TouchableOpacity
        testID="shift-savings-advice"
        activeOpacity={onShiftSavingsPress ? 0.75 : 1}
        onPress={onShiftSavingsPress}
        style={[
          styles.savingsBox,
          {
            backgroundColor: isHighPeak ? theme.warnBg : theme.okBg,
            borderColor: isHighPeak ? theme.warn : theme.ok,
          },
        ]}
      >
        <View style={styles.savingsTopRow}>
          <View style={styles.savingsTitleGroup}>
            <Text
              style={[
                styles.savingsTitle,
                {
                  color: isHighPeak ? theme.warn : theme.ok,
                  fontSize: 13 * fontScale,
                },
              ]}
            >
              {language === 'english'
                ? `Potential Shift Savings: ${formatCurrency(potentialShiftSavings)} / mo`
                : `Maaaring Matipid sa Paglilipat: ${formatCurrency(potentialShiftSavings)} / buwan`}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.savingsAdvice,
            {
              color: theme.ink,
              fontSize: 12 * fontScale,
            },
          ]}
        >
          {recommendationText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    fontWeight: '600',
    marginTop: 2,
  },
  badgePill: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  badgeText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  meterContainer: {
    marginBottom: 14,
  },
  meterBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  meterSegment: {
    height: '100%',
  },
  meterLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  meterLabelText: {
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  tileHeader: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tileValue: {
    fontWeight: '800',
    marginBottom: 2,
  },
  tileCost: {
    fontWeight: '600',
    marginBottom: 4,
  },
  tileSchedule: {
    fontWeight: '500',
    opacity: 0.8,
  },
  savingsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  savingsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  savingsIcon: {
    includeFontPadding: false,
  },
  savingsTitleGroup: {
    flex: 1,
  },
  savingsTitle: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  savingsAdvice: {
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
});
