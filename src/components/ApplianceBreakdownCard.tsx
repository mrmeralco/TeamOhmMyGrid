import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useEnergy } from '../context/EnergyContext';
import { MockAppliance } from '../constants/mockData';
import { SmartPlugDevice } from '../types';

interface ApplianceBreakdownCardProps {
  appliances?: MockAppliance[];
  totalKwh?: number;
  ceilingKwh?: number;
}

// Authored SVG icons matching Apple squircle icon style
function ApplianceIcon({ id, color }: { id: string; color: string }) {
  switch (id) {
    case 'aircon':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      );
    case 'fridge':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="5" y="3" width="14" height="18" rx="2" stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M5 10H19" stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M8 6V8M8 13V16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'fan':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="3" stroke="#FFFFFF" strokeWidth="2" />
            <Path
              d="M12 9C12 5 15 3 17 5C19 7 17 10 13 11M9 12C5 12 3 15 5 17C7 19 10 17 11 13M12 15C12 19 9 21 7 19C5 17 7 14 11 13M15 12C19 12 21 9 19 7C17 5 14 7 13 11"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      );
    case 'washer':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="4" y="3" width="16" height="18" rx="2" stroke="#FFFFFF" strokeWidth="2" />
            <Circle cx="12" cy="13" r="5" stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M8 6H8.01M12 6H12.01M16 6H16.01" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'ricecooker':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 11C5 9.34315 6.34315 8 8 8H16C17.6569 8 19 9.34315 19 11V16C19 18.2091 17.2091 20 15 20H9C6.79086 20 5 18.2091 5 16V11Z"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <Path d="M4 8H20M12 4V8M10 14H14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'microwave':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="5" width="18" height="14" rx="2" stroke="#FFFFFF" strokeWidth="2" />
            <Rect x="5" y="8" width="10" height="8" rx="1" stroke="#FFFFFF" strokeWidth="1.5" />
            <Path d="M18 9H18.01M18 12H18.01M18 15H18.01" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    case 'pc':
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="4" y="4" width="16" height="11" rx="2" stroke="#FFFFFF" strokeWidth="2" />
            <Path d="M8 19H16M12 15V19" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
      );
    default:
      return (
        <View style={[styles.appIconBox, { backgroundColor: color }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      );
  }
}

export const ApplianceBreakdownCard: React.FC<ApplianceBreakdownCardProps> = ({
  ceilingKwh = 300,
}) => {
  const { theme, fontScale } = useTheme();
  const { smartPlugs, toggleSmartPlug, totalActiveWatts, isPlugConnected, currentKwh } = useEnergy();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const totalPlugsKwh = smartPlugs.reduce((sum, p) => sum + p.accumulatedKwh, 0);
  const displayTotalKwh = Number((currentKwh || totalPlugsKwh).toFixed(1));
  const usedPercentage = Math.min(100, Math.round((displayTotalKwh / ceilingKwh) * 100));
  const remainingPercentage = Math.max(0, 100 - usedPercentage);

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      {/* 1. Header with Live IoT Telemetry Badge */}
      <View style={styles.storageHeader}>
        <View>
          <Text style={[styles.storageTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Konsumo ng mga Smart Plug (IoT)
          </Text>
          <Text style={[styles.storageUsed, { color: theme.muted, fontSize: 13 * fontScale }]}>
            {displayTotalKwh} kWh ng {ceilingKwh} kWh nagamit
          </Text>
        </View>
        <View style={[styles.telemetryBadge, { backgroundColor: theme.cont, borderColor: theme.line }]}>
          <View style={[styles.liveDot, { backgroundColor: isPlugConnected ? '#10B981' : theme.brand }]} />
          <Text style={[styles.telemetryWatts, { color: theme.ink, fontSize: 12 * fontScale }]}>
            {totalActiveWatts.toFixed(0)} W Live
          </Text>
        </View>
      </View>

      {/* 2. Continuous Horizontal Multi-colored Segmented Bar */}
      <View style={[styles.segmentedBarTrack, { backgroundColor: theme.cont }]}>
        {smartPlugs.map((plug) => {
          const share = totalPlugsKwh > 0 ? (plug.accumulatedKwh / totalPlugsKwh) * usedPercentage : 10;
          return (
            <View
              key={plug.id}
              style={{
                flex: Math.max(1, share),
                backgroundColor: plug.relayState === 'ON' ? plug.color : theme.line,
                height: '100%',
                opacity: plug.relayState === 'ON' ? 1 : 0.4,
              }}
            />
          );
        })}
        {remainingPercentage > 0 && (
          <View style={{ flex: remainingPercentage, backgroundColor: theme.line, height: '100%' }} />
        )}
      </View>

      {/* 3. Dot Legend below the Bar */}
      <View style={styles.legendRow}>
        {smartPlugs.slice(0, 5).map((plug) => (
          <View key={plug.id} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: plug.relayState === 'ON' ? plug.color : theme.muted },
              ]}
            />
            <Text style={[styles.legendLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
              {plug.name.split('·')[1]?.trim() || plug.name}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.line }]} />
          <Text style={[styles.legendLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
            Iba pa
          </Text>
        </View>
      </View>

      {/* 4. Recommendation Card */}
      <View style={[styles.recommendationBox, { backgroundColor: theme.cont, borderColor: theme.line }]}>
        <View style={styles.recHeaderRow}>
          <Text style={[styles.recSectionTag, { color: theme.brand, fontSize: 11 * fontScale }]}>
            TIP MULA KAY TIPI
          </Text>
        </View>
        <View style={styles.recContentRow}>
          <View style={styles.recTextCol}>
            <Text style={[styles.recTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
              I-set ang Aircon sa 24°C
            </Text>
            <Text style={[styles.recDesc, { color: theme.muted, fontSize: 12 * fontScale }]}>
              Makatipid ng hanggang ₱482 bawat buwan sa pamamagitan ng eco-temperature setpoint.
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Scrollable Table of Individual Smart Plugs */}
      <View style={styles.listContainer}>
        <ScrollView
          style={styles.scrollList}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          {smartPlugs.map((plug, index) => {
            const isExpanded = expandedId === plug.id;
            const isLast = index === smartPlugs.length - 1;
            const isRelayOn = plug.relayState === 'ON';

            return (
              <View key={plug.id}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(plug.id)}
                  style={styles.tableRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${plug.name}, ${isRelayOn ? plug.powerWatts.toFixed(0) + ' Watts' : 'Naka-off'}`}
                >
                  {/* Left Squircle Appliance Icon */}
                  <ApplianceIcon id={plug.iconId} color={isRelayOn ? plug.color : theme.muted} />

                  {/* Middle Column: Name, Location, Live Watts */}
                  <View style={styles.itemMiddle}>
                    <Text style={[styles.itemName, { color: theme.ink, fontSize: 14 * fontScale }]}>
                      {plug.name}
                    </Text>
                    <Text style={[styles.itemSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                      {plug.location} &bull; {isRelayOn ? `${plug.powerWatts.toFixed(0)} W` : 'OFF (0 W)'}
                    </Text>
                  </View>

                  {/* Right Column: Interactive Relay Switch & Usage */}
                  <View style={styles.itemRight}>
                    <Text style={[styles.itemKwh, { color: theme.ink, fontSize: 13 * fontScale }]}>
                      {plug.accumulatedKwh.toFixed(1)} kWh
                    </Text>
                    <Text style={[styles.itemCost, { color: theme.muted, fontSize: 11 * fontScale }]}>
                      ₱{plug.monthlyCost.toFixed(2)}
                    </Text>
                  </View>

                  {/* Interactive Relay Switch */}
                  <View style={styles.switchWrapper}>
                    <Switch
                      value={isRelayOn}
                      onValueChange={() => toggleSmartPlug(plug.id)}
                      trackColor={{ false: theme.line, true: theme.brand }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={theme.line}
                    />
                  </View>

                  <Text style={[styles.chevron, { color: theme.muted, fontSize: 14 * fontScale }]}>
                    {isExpanded ? '▾' : '›'}
                  </Text>
                </TouchableOpacity>

                {/* Expanded Smart Plug Telemetry Drawer */}
                {isExpanded && (
                  <View style={[styles.expandedDrawer, { backgroundColor: theme.cont, borderColor: theme.line }]}>
                    <View style={styles.telemetryGrid}>
                      <View style={styles.telemetryCol}>
                        <Text style={[styles.telemetryLabel, { color: theme.muted }]}>Boltahe</Text>
                        <Text style={[styles.telemetryValue, { color: theme.ink }]}>{plug.voltageRms} V</Text>
                      </View>
                      <View style={styles.telemetryCol}>
                        <Text style={[styles.telemetryLabel, { color: theme.muted }]}>Kuryente</Text>
                        <Text style={[styles.telemetryValue, { color: theme.ink }]}>{plug.currentAmps} A</Text>
                      </View>
                      <View style={styles.telemetryCol}>
                        <Text style={[styles.telemetryLabel, { color: theme.muted }]}>Power Factor</Text>
                        <Text style={[styles.telemetryValue, { color: theme.ink }]}>{plug.powerFactor}</Text>
                      </View>
                      <View style={styles.telemetryCol}>
                        <Text style={[styles.telemetryLabel, { color: theme.muted }]}>Status</Text>
                        <Text style={[styles.telemetryValue, { color: isRelayOn ? theme.brand : theme.muted }]}>
                          {plug.relayState}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.drawerText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                      💡 {plug.tip}
                    </Text>
                  </View>
                )}

                {/* Apple Inset Divider */}
                {!isLast && <View style={[styles.divider, { backgroundColor: theme.line }]} />}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storageTitle: {
    fontWeight: '800',
  },
  storageUsed: {
    fontWeight: '500',
    marginTop: 2,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  telemetryWatts: {
    fontWeight: '700',
  },
  segmentedBarTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontWeight: '600',
  },
  recommendationBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  recHeaderRow: {
    marginBottom: 4,
  },
  recSectionTag: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recTextCol: {
    flex: 1,
  },
  recTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  recDesc: {
    fontWeight: '500',
    lineHeight: 17,
  },
  listContainer: {
    maxHeight: 340,
  },
  scrollList: {
    maxHeight: 340,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  appIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemMiddle: {
    flex: 1,
  },
  itemName: {
    fontWeight: '700',
  },
  itemSub: {
    fontWeight: '500',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  itemKwh: {
    fontWeight: '700',
  },
  itemCost: {
    fontWeight: '500',
    marginTop: 2,
  },
  switchWrapper: {
    marginRight: 6,
  },
  chevron: {
    fontWeight: '700',
    marginLeft: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
  expandedDrawer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginVertical: 6,
    marginLeft: 50,
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  telemetryCol: {
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  drawerText: {
    fontWeight: '500',
    lineHeight: 18,
  },
});
