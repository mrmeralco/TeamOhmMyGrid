import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface BudgetGaugeProps {
  projected: number;
  budget: number;
  percentage?: number;
}

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({
  projected,
  budget,
  percentage,
}) => {
  const { theme, fontScale } = useTheme();

  const calcPercent = percentage !== undefined ? percentage : budget > 0 ? (projected / budget) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, Math.round(calcPercent)));

  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.32
  const strokeDashoffset = circumference - (circumference * clampedPercent) / 100;

  const statusColor =
    calcPercent >= 100 ? theme.danger : calcPercent >= 80 ? theme.warn : theme.ok;

  return (
    <View style={[styles.container, { backgroundColor: theme.cont }]}>
      <View style={styles.topRow}>
        <View style={styles.gaugeContainer}>
          <Svg width={110} height={110} viewBox="0 0 100 100" style={styles.svg}>
            {/* Background Track */}
            <Circle
              cx={50}
              cy={50}
              r={radius}
              stroke={theme.line}
              strokeWidth={10}
              fill="none"
            />
            {/* Progress Arc */}
            <Circle
              cx={50}
              cy={50}
              r={radius}
              stroke={statusColor}
              strokeWidth={10}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={styles.centerTextContainer}>
            <Text
              style={[
                styles.percentageText,
                { color: theme.ink, fontSize: 20 * fontScale },
              ]}
            >
              {clampedPercent}%
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={[styles.label, { color: theme.muted, fontSize: 13 * fontScale }]}>
            PROJECTED NA BILL
          </Text>
          <Text style={[styles.projectedAmount, { color: theme.ink, fontSize: 28 * fontScale }]}>
            ₱{projected.toLocaleString()}
          </Text>
          <Text style={[styles.budgetLimit, { color: theme.muted, fontSize: 14 * fontScale }]}>
            sa Budget na ₱{budget.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Horizontal mini bar */}
      <View style={[styles.linearBarTrack, { backgroundColor: theme.line }]}>
        <View
          style={[
            styles.linearBarFill,
            {
              backgroundColor: statusColor,
              width: `${Math.min(100, calcPercent)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gaugeContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontWeight: '800',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  projectedAmount: {
    fontWeight: '800',
    marginVertical: 2,
  },
  budgetLimit: {
    fontWeight: '600',
  },
  linearBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 14,
  },
  linearBarFill: {
    height: '100%',
    borderRadius: 5,
  },
});
