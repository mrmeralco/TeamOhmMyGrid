import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { MockPeakAlert, MOCK_PEAK_ALERT } from '../constants/mockData';

interface PeakAlertBannerProps {
  alert?: MockPeakAlert;
}

export const PeakAlertBanner: React.FC<PeakAlertBannerProps> = ({
  alert = MOCK_PEAK_ALERT,
}) => {
  const { theme, fontScale } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!alert || !alert.isPeak) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded(!expanded)}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityLabel={`${alert.title}. ${expanded ? 'Itago' : 'I-expand'}`}
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.surface }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
              stroke={theme.warn}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={theme.warn}
            />
          </Svg>
        </View>

        <View style={styles.textContainer}>
          <View style={styles.badgeRow}>
            <View style={[styles.alertTag, { backgroundColor: theme.danger }]}>
              <Text style={styles.alertTagText}>RED ALERT</Text>
            </View>
            <Text style={[styles.timeTag, { color: theme.warn, fontSize: 11 * fontScale }]}>
              {alert.timeWindow}
            </Text>
          </View>
          <Text style={[styles.title, { color: theme.ink, fontSize: 13 * fontScale }]}>
            High Grid Strain
          </Text>
        </View>

        <Text style={[styles.chevron, { color: theme.ink, fontSize: 13 * fontScale }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.description, { color: theme.ink, fontSize: 12 * fontScale }]}>
            Ipagpaliban ang plantsa at washing machine pagkalipas ng 6:00 PM para makaiwas sa spike.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  alertTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 6,
  },
  alertTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  timeTag: {
    fontWeight: '700',
  },
  title: {
    fontWeight: '800',
  },
  chevron: {
    paddingHorizontal: 4,
    fontWeight: '700',
  },
  expandedContent: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    paddingTop: 6,
  },
  description: {
    lineHeight: 16,
    fontWeight: '500',
  },
});
