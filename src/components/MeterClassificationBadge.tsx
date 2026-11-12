import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MeterType } from '../types';

export type MeterClassificationBadgeSize = 'compact' | 'standard' | 'detailed';

export interface MeterClassificationBadgeProps {
  /** The meter classification: 'AMI' or 'Analog'. Defaults to 'AMI' if undefined or null */
  meterType?: MeterType | null;
  /** Size variant: 'compact' for headers/lists, 'standard' for cards, 'detailed' for dashboard hero */
  size?: MeterClassificationBadgeSize;
  /** Whether to render the icon indicator (⚡ for AMI, ⏱️ for Analog). Default: true */
  showIcon?: boolean;
  /** Whether to show descriptive subtitle in detailed mode. Default: true */
  showSubtitle?: boolean;
  /** Optional click handler if the badge triggers a modal or info tooltip */
  onPress?: () => void;
  /** Optional custom container style overrides */
  style?: StyleProp<ViewStyle>;
  /** Test identifier for E2E and component testing */
  testID?: string;
}

export const MeterClassificationBadge: React.FC<MeterClassificationBadgeProps> = ({
  meterType = 'AMI',
  size = 'standard',
  showIcon = true,
  showSubtitle = true,
  onPress,
  style,
  testID,
}) => {
  const { theme, fontScale, language } = useTheme();
  const effectiveMeterType = meterType || 'AMI';
  const isAmi = effectiveMeterType === 'AMI';

  const badgeBg = isAmi ? theme.okBg : theme.warnBg;
  const badgeTextColor = isAmi ? theme.ok : theme.warn;
  const badgeBorderColor = isAmi ? theme.ok : theme.warn;
  const iconEmoji = isAmi ? '⚡' : '⏱️';

  const titleText = isAmi
    ? size === 'compact'
      ? 'AMI'
      : 'AMI Smart Meter'
    : size === 'compact'
    ? 'Analog'
    : 'Analog Meter';

  const subtitleText = isAmi
    ? language === 'english'
      ? '15-min interval active'
      : '15-min telemetry active'
    : language === 'english'
    ? 'Weekly photo log'
    : 'Lingguhang litrato';

  const a11yLabel = isAmi
    ? 'Meter type: AMI Smart Meter. Automated 15-minute telemetry active.'
    : 'Meter type: Analog Electromechanical Meter. Weekly photo capture required.';

  const ContainerComponent = onPress ? TouchableOpacity : View;

  return (
    <ContainerComponent
      testID={testID || `meter-badge-${effectiveMeterType.toLowerCase()}`}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[
        styles.basePill,
        size === 'compact' && styles.compactPill,
        size === 'detailed' && styles.detailedPill,
        {
          backgroundColor: badgeBg,
          borderColor: badgeBorderColor,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {showIcon && (
          <Text
            style={[
              styles.icon,
              { fontSize: (size === 'compact' ? 11 : 13) * fontScale },
            ]}
            aria-hidden={true}
          >
            {iconEmoji}
          </Text>
        )}
        <View style={size === 'detailed' ? styles.detailedTextCol : undefined}>
          <Text
            style={[
              styles.label,
              {
                color: badgeTextColor,
                fontSize: (size === 'compact' ? 11 : 12.5) * fontScale,
              },
            ]}
          >
            {titleText}
          </Text>
          {size === 'detailed' && showSubtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: badgeTextColor,
                  fontSize: 10 * fontScale,
                },
              ]}
            >
              {subtitleText}
            </Text>
          )}
        </View>
      </View>
    </ContainerComponent>
  );
};

const styles = StyleSheet.create({
  basePill: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compactPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  detailedPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailedTextCol: {
    flexDirection: 'column',
  },
  icon: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  label: {
    fontWeight: '800',
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontWeight: '600',
    opacity: 0.85,
    marginTop: 1,
  },
});
