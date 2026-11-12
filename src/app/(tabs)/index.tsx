import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEnergy } from '../../context/EnergyContext';
import { BudgetGauge } from '../../components/BudgetGauge';
import { UsageAnalysisCard } from '../../components/UsageAnalysisCard';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { calculateTierCliff } from '../../lib/tariffEngine';
import { formatCANDisplay } from '../../utils/validation';
import { MOCK_USER } from '../../constants/mockData';

const APP_LOGO = require('../../../assets/app-logo.png');

/** Smooth fluid spring card wrapper with entrance + press physics */
function FluidCard({
  children,
  delay = 0,
  style,
  onPress,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: object;
  onPress?: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 16,
        stiffness: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    if (!onPress) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.spring(scale, {
      toValue: 0.965,
      damping: 14,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          style,
          { opacity, transform: [{ translateY }, { scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Fluid Pill Button for quick actions */
function QuickPill({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const { theme, fontScale } = useTheme();

  const handlePressIn = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.spring(scale, {
      toValue: 0.92,
      damping: 12,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.quickPill,
          {
            backgroundColor: theme.surface,
            borderColor: '#FF6B002B',
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text
          style={[
            styles.quickPillText,
            { color: theme.ink, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { theme, fontScale, language } = useTheme();
  const { user } = useAuth();
  const {
    budget,
    projected,
    currentKwh,
    activeBill,
    activeCanProfile,
  } = useEnergy();

  const cliff = calculateTierCliff(currentKwh);
  const userName = user?.fullName || activeCanProfile?.customerName || MOCK_USER.name;
  const canNumber =
    activeCanProfile?.accountNumber ||
    (user?.can ? formatCANDisplay(user.can) : null) ||
    activeBill?.customerAccountNumber ||
    MOCK_USER.accountNumber;
  const profileName = activeCanProfile?.name || 'Bahay';
  const ratePerKwh = activeCanProfile?.ratePerKwh || MOCK_USER.ratePerKwh;

  // Header entrance
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  const isFilipino = language === 'filipino';
  const isEnglish = language === 'english';

  const greetingLead = isEnglish ? 'Good day,' : isFilipino ? 'Maligayang araw,' : 'Magandang araw,';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting with Orange Glow & Pill */}
        <Animated.View
          style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerSlide }] }]}
        >
          <View style={styles.headerTextGroup}>
            <View style={styles.greetingRow}>
              <Text style={[styles.greetingLead, { color: theme.ink, fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
                {greetingLead}{' '}
              </Text>
              <Text style={[styles.greetingName, { color: '#FF6B00', fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
                {userName}!
              </Text>
            </View>

            <View style={[styles.canBadge, { backgroundColor: '#FF6B0014', borderColor: '#FF6B0033' }]}>
              <View style={styles.canIndicatorDot} />
              <Text style={[styles.canSubtitle, { color: '#D95200', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                CAN: {canNumber} · {profileName}
              </Text>
            </View>
          </View>

          <View style={styles.headerRightGroup}>
            <Image
              source={APP_LOGO}
              style={styles.headerLogo}
              resizeMode="contain"
              accessibilityLabel="Kuryentipid Logo"
            />
            <HeaderAlertButton from="index" />
            <HeaderSettingsButton />
          </View>
        </Animated.View>

        {/* Quick Action Chips Bar */}
        <View style={styles.quickChipsRow}>
          <QuickPill
            icon="⚡"
            label={isEnglish ? 'Peak Hours' : 'Peak Alert'}
            onPress={() => router.push('/(tabs)/bill')}
          />
          <QuickPill
            icon="💬"
            label="Tipi AI"
            onPress={() => router.push('/(tabs)/tanong')}
          />
          <QuickPill
            icon="🔌"
            label={isEnglish ? 'Appliances' : 'Kagamitan'}
            onPress={() => router.push('/(tabs)/appliances')}
          />
        </View>

        {/* Budget Circular Gauge Card */}
        <FluidCard delay={80}>
          <BudgetGauge projected={projected} budget={budget} />
        </FluidCard>

        {/* Tipi AI Chat Card with Orange Gradient & Floating Mascot */}
        <FluidCard delay={150}>
          <UsageAnalysisCard />
        </FluidCard>

        {/* Live Grid Metrics Row */}
        <FluidCard delay={220} style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: '#FF6B0036' }]}>
            <LinearGradient
              colors={['#FF6B0014', '#FFA04024']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={styles.metricTopBadge}>
              <Text style={{ fontSize: 14 }}>⚡</Text>
              <Text style={[styles.metricLabel, { color: '#FF6B00', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'CONSUMPTION' : 'KONSUMO'}
              </Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
              {currentKwh} <Text style={{ fontSize: 16 * fontScale, color: '#FF6B00' }}>kWh</Text>
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: '#FF6B0036' }]}>
            <LinearGradient
              colors={['#FFA04012', '#FF6B0020']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <View style={styles.metricTopBadge}>
              <Text style={{ fontSize: 14 }}>🏷️</Text>
              <Text style={[styles.metricLabel, { color: '#FF6B00', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'CURRENT RATE' : 'RATE / KWH'}
              </Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
              ₱{ratePerKwh}
            </Text>
          </View>
        </FluidCard>

        {/* Quick Action: Scan Meralco Bill */}
        <FluidCard delay={290} onPress={() => router.push('/(tabs)/bill')}>
          <View style={[styles.secondaryActionCard, { backgroundColor: theme.surface, borderColor: '#FF6B0040' }]}>
            <LinearGradient
              colors={['#FF6B000F', '#FFA0401E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
            />
            <View style={styles.scanRow}>
              <View style={styles.scanIconWrapper}>
                <LinearGradient
                  colors={['#FF5500', '#FF8500']}
                  style={styles.scanIconGradient}
                >
                  <Text style={{ fontSize: 22 }}>📄</Text>
                </LinearGradient>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.secondaryTitle, { color: theme.ink, fontSize: 17 * fontScale, fontFamily: 'Coolvetica' }]}>
                  {isEnglish ? 'Scan Meralco Bill' : 'I-scan ang Meralco Bill'}
                </Text>
                <Text style={[styles.secondarySub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? 'Take a photo or upload your electric bill copy.'
                    : 'Kumuha ng litrato o mag-upload ng kopya ng bill.'}
                </Text>
              </View>

              <View style={styles.chevronPill}>
                <Text style={{ color: '#FF6B00', fontSize: 16, fontWeight: '700' }}>→</Text>
              </View>
            </View>
          </View>
        </FluidCard>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  greetingLead: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  greetingName: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  canBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 2,
  },
  canIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B00',
  },
  canSubtitle: {
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickPillText: {
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  metricTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  metricLabel: {
    letterSpacing: 0.8,
    fontWeight: '400',
  },
  metricValue: {
    letterSpacing: 0.5,
    fontWeight: '400',
  },
  secondaryActionCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
  },
  scanIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryTitle: {
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  secondarySub: {
    lineHeight: 16,
  },
  chevronPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B0018',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
