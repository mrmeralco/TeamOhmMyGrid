import React, { useState } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Modal,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useEnergy } from '../context/EnergyContext';
import { MOCK_PEAK_ALERT } from '../constants/mockData';
import { calculateTierCliff } from '../lib/tariffEngine';

interface HeaderAlertButtonProps {
  badgeCount?: number;
  from?: string;
}

export const HeaderAlertButton: React.FC<HeaderAlertButtonProps> = ({ badgeCount, from }) => {
  const insets = useSafeAreaInsets();
  const { theme, fontScale } = useTheme();
  const { budget, projected, currentKwh } = useEnergy();
  const [isOpen, setIsOpen] = useState(false);

  const cliff = calculateTierCliff(currentKwh);
  const isPeakActive = !!MOCK_PEAK_ALERT.isPeak;
  const isShockActive = projected > budget;
  const isCliffActive = !!cliff.isCliffWarning;

  const projectedExcess = Math.max(0, projected - budget);

  // Dynamic count: active peak window + budget excess warning + tier cliff warning
  const computedCount =
    (isPeakActive ? 1 : 0) + (isShockActive ? 1 : 0) + (isCliffActive ? 1 : 0);
  const displayCount = badgeCount !== undefined ? badgeCount : computedCount;

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore haptics error on web/simulator
    }
  };

  const handleToggle = () => {
    triggerHaptic();
    setIsOpen(!isOpen);
  };

  const handleOpenFullScheduler = () => {
    triggerHaptic();
    setIsOpen(false);
    if (from) {
      router.navigate({
        pathname: '/(tabs)/alerts',
        params: { from },
      } as any);
    } else {
      router.navigate('/(tabs)/alerts');
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.surface,
            borderColor: theme.line,
            shadowColor: theme.ink,
          },
        ]}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Mga Babala at Peak Alert, ${displayCount} aktibong abiso`}
        activeOpacity={0.7}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
            stroke={theme.ink}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
            stroke={theme.ink}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </Svg>

        {displayCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.brand, borderColor: theme.surface }]}>
            <Text style={[styles.badgeText, { color: theme.brandInk, fontSize: 10 * fontScale }]}>
              {displayCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={[
            styles.modalOverlay,
            { paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56) },
          ]}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            style={[
              styles.dropdownCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                shadowColor: theme.ink,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: theme.line }]}>
              <View style={styles.headerLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.dropdownTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
                    Mga Babala (Alerts)
                  </Text>
                  {displayCount > 0 && (
                    <View style={[styles.titleBadge, { backgroundColor: theme.brand }]}>
                      <Text style={[styles.titleBadgeText, { color: theme.brandInk, fontSize: 10 * fontScale }]}>
                        {displayCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.dropdownSubtitle, { color: theme.muted, fontSize: 11 * fontScale }]}>
                  Lahat ng aktibong alert sa grid at budget
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={[styles.closeBtn, { backgroundColor: theme.cont }]}
                accessibilityLabel="Isara ang mga babala"
              >
                <Text style={[styles.closeBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Alerts List */}
            <ScrollView style={styles.alertsList} showsVerticalScrollIndicator={false}>
              {/* Alert 1: High Grid Demand */}
              {isPeakActive && (
                <View style={[styles.alertItem, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
                  <View style={styles.alertItemHeader}>
                    <View style={[styles.tagBadge, { backgroundColor: theme.danger }]}>
                      <Text style={styles.tagBadgeText}>RED ALERT</Text>
                    </View>
                    <Text style={[styles.alertTime, { color: theme.warn, fontSize: 11 * fontScale }]}>
                      {MOCK_PEAK_ALERT.timeWindow}
                    </Text>
                  </View>
                  <Text style={[styles.alertItemTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                    High Grid Demand Alert
                  </Text>
                  <Text style={[styles.alertItemSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    Mataas ang strain sa Luzon Grid. Ipagpaliban ang washing machine at plantsa paglampas ng 6:00 PM.
                  </Text>
                </View>
              )}

              {/* Alert 2: Projected Bill Shock */}
              {isShockActive && (
                <View style={[styles.alertItem, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
                  <View style={styles.alertItemHeader}>
                    <View style={[styles.tagBadge, { backgroundColor: theme.danger }]}>
                      <Text style={styles.tagBadgeText}>OVER BUDGET</Text>
                    </View>
                    <Text style={[styles.alertTime, { color: theme.danger, fontSize: 11 * fontScale }]}>
                      +₱{projectedExcess.toLocaleString()} excess
                    </Text>
                  </View>
                  <Text style={[styles.alertItemTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                    Projected Bill Shock
                  </Text>
                  <Text style={[styles.alertItemSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    Tinatayang aabot sa ₱{projected.toLocaleString()} ang bill mo vs ₱{budget.toLocaleString()} na budget.
                  </Text>
                </View>
              )}

              {/* Alert 3: Tier Cliff Warning */}
              {isCliffActive && (
                <View style={[styles.alertItem, { backgroundColor: theme.peakBg, borderColor: theme.peak }]}>
                  <View style={styles.alertItemHeader}>
                    <View style={[styles.tagBadge, { backgroundColor: theme.peak }]}>
                      <Text style={styles.tagBadgeText}>TIER CLIFF</Text>
                    </View>
                    <Text style={[styles.alertTime, { color: theme.peak, fontSize: 11 * fontScale }]}>
                      {cliff.kwhRemaining} kWh na lang
                    </Text>
                  </View>
                  <Text style={[styles.alertItemTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                    Malapit na sa Tier {cliff.currentTier + 1}
                  </Text>
                  <Text style={[styles.alertItemSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    May {cliff.kwhRemaining} kWh na lang bago tumaas ang singil sa {cliff.nextTierThreshold} kWh threshold.
                  </Text>
                </View>
              )}

              {/* Empty state if no alerts */}
              {!isPeakActive && !isShockActive && !isCliffActive && (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: theme.ink, fontSize: 13 * fontScale }]}>
                    Lahat ay maayos. Walang aktibong babala sa ngayon!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer Action: Open Full Scheduler */}
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
              onPress={handleOpenFullScheduler}
            >
              <Text style={[styles.footerBtnText, { color: theme.brand, fontSize: 12 * fontScale }]}>
                Buksan ang Scheduler at Buong Detalye ➔
              </Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontWeight: '900',
    lineHeight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  dropdownCard: {
    width: 320,
    maxWidth: '92%',
    maxHeight: 460,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  dropdownTitle: {
    fontWeight: '800',
  },
  titleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  titleBadgeText: {
    fontWeight: '800',
  },
  dropdownSubtitle: {
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    fontWeight: '700',
    lineHeight: 16,
  },
  alertsList: {
    marginVertical: 4,
  },
  alertItem: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginVertical: 4,
  },
  alertItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 9,
  },
  alertTime: {
    fontWeight: '700',
  },
  alertItemTitle: {
    fontWeight: '800',
    marginBottom: 2,
  },
  alertItemSub: {
    fontWeight: '500',
    lineHeight: 16,
  },
  emptyWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  footerBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontWeight: '800',
  },
});
