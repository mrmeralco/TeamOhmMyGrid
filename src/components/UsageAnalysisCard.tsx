import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const TIPI_MASCOT = require('../../assets/tipi-mascot.png');

export function UsageAnalysisCard() {
  const { fontScale, language } = useTheme();

  const handleCardPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    router.push('/(tabs)/tanong');
  };

  const isFilipino = language === 'filipino';
  const isEnglish = language === 'english';

  const titleText = isEnglish
    ? 'Start chat here'
    : 'Simulan ang\nchat dito';

  const badgeText = 'TIPI AI';

  const hintText = isEnglish
    ? 'Ask anything about your bill'
    : isFilipino
    ? 'Magtanong ukol sa kuryente'
    : 'Ask tips para makatipid';

  const buttonText = isEnglish ? 'Chat now \u2192' : isFilipino ? 'Mag-chat \u2192' : 'Chat na \u2192';

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={isEnglish ? 'Start chat here with Tipi' : 'Simulan ang chat dito kay Tipi'}
    >
      <View style={styles.card}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgGradient id="tipiHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF4E00" />
              <Stop offset="55%" stopColor="#FF7000" />
              <Stop offset="100%" stopColor="#FFA100" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx="22" ry="22" fill="url(#tipiHeroGrad)" />
        </Svg>

        {/* Decorative glowing circles in background */}
        <View style={styles.ambientCircleOne} />
        <View style={styles.ambientCircleTwo} />

        {/* Left Text Column */}
        <View style={styles.textSide}>
          <View style={styles.badgePill}>
            <View style={styles.livePulseDot} />
            <Text style={[styles.badgeText, { fontSize: 11 * fontScale }]}>
              {badgeText}
            </Text>
          </View>

          <Text
            style={[
              styles.title,
              { fontSize: 24 * fontScale, lineHeight: 28 * fontScale },
            ]}
            numberOfLines={2}
          >
            {titleText}
          </Text>

          <Text
            style={[styles.subtitle, { fontSize: 12 * fontScale }]}
            numberOfLines={1}
          >
            {hintText}
          </Text>

          <View style={styles.ctaButton}>
            <Text style={[styles.ctaButtonText, { fontSize: 13 * fontScale }]}>
              {buttonText}
            </Text>
          </View>
        </View>

        {/* Right Avatar Column (Static, no bounce animation) */}
        <View style={styles.mascotContainer}>
          <View style={styles.mascotWrapper}>
            <Image
              source={TIPI_MASCOT}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.floatingShadow} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 145,
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 18,
    position: 'relative',
    backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ambientCircleOne: {
    position: 'absolute',
    top: -30,
    right: 40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  ambientCircleTwo: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  textSide: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 2,
    paddingRight: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFE600',
  },
  badgeText: {
    color: '#FFEAA7',
    fontFamily: 'Coolvetica',
    letterSpacing: 1.2,
    fontWeight: '400',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Coolvetica',
    letterSpacing: 0.3,
    fontWeight: '400',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
    fontWeight: '500',
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  ctaButtonText: {
    color: '#E64A00',
    fontFamily: 'Coolvetica',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  mascotContainer: {
    width: 125,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    height: 140,
  },
  mascotWrapper: {
    width: '100%',
    height: 125,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: 120,
    height: 125,
  },
  floatingShadow: {
    width: 68,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    marginTop: -4,
  },
});
