import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
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

  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89

  // Smooth entrance animation for arc progress
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clampedPercent,
      duration: 1100,
      useNativeDriver: false,
    }).start();
  }, [clampedPercent]);

  const strokeDashoffset = circumference - (circumference * clampedPercent) / 100;

  // Rich orange-accented status colors
  const statusColor =
    calcPercent >= 100 ? theme.danger : calcPercent >= 80 ? '#FF8C00' : '#FF6B00';

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: '#FF6B0030' }]}>
      <View style={styles.topRow}>
        <View style={styles.gaugeContainer}>
          <Svg width={116} height={116} viewBox="0 0 104 104" style={styles.svg}>
            <Defs>
              <SvgGradient id="orangeGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFA040" />
                <Stop offset="100%" stopColor={statusColor} />
              </SvgGradient>
            </Defs>

            {/* Background Track with soft orange-tinted track */}
            <Circle
              cx={52}
              cy={52}
              r={radius}
              stroke="#FF6B0018"
              strokeWidth={9}
              fill="none"
            />

            {/* Progress Arc */}
            <Circle
              cx={52}
              cy={52}
              r={radius}
              stroke={calcPercent >= 100 ? theme.danger : 'url(#orangeGaugeGrad)'}
              strokeWidth={9}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 52 52)"
            />
          </Svg>

          <View style={styles.centerTextContainer}>
            <Text
              style={[
                styles.percentageText,
                { color: statusColor, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' },
              ]}
            >
              {clampedPercent}%
            </Text>
            <Text style={[styles.pctSub, { color: theme.muted, fontSize: 10 * fontScale, fontFamily: 'Coolvetica' }]}>
              used
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.pillLabel}>
            <Text style={[styles.label, { color: '#FF6B00', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
              PROJECTED NA BILL
            </Text>
          </View>
          <Text style={[styles.projectedAmount, { color: theme.ink, fontSize: 30 * fontScale, fontFamily: 'Coolvetica' }]}>
            ₱{projected.toLocaleString()}
          </Text>
          <Text style={[styles.budgetLimit, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
            sa Budget na ₱{budget.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Horizontal mini bar with orange accent */}
      <View style={[styles.linearBarTrack, { backgroundColor: '#FF6B0018' }]}>
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
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gaugeContainer: {
    position: 'relative',
    width: 116,
    height: 116,
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
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  pctSub: {
    textTransform: 'uppercase',
    marginTop: -2,
    letterSpacing: 1,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  pillLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B0014',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  label: {
    letterSpacing: 0.8,
    fontWeight: '400',
  },
  projectedAmount: {
    marginVertical: 1,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  budgetLimit: {
    fontWeight: '400',
  },
  linearBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
  },
  linearBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
