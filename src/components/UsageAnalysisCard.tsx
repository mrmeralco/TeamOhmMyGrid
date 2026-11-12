import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const TIPI_MASCOT = require('../../assets/tipi-mascot.png');

export function UsageAnalysisCard() {
  const { fontScale, language } = useTheme();

  // Floating animation for mascot
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous smooth floating loop (sine wave up & down)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -10,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(shadowScale, {
            toValue: 0.82,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 2,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(shadowScale, {
            toValue: 1.15,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, [floatAnim, shadowScale]);

  // Press feedback
  const handlePressIn = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.spring(pressScale, {
      toValue: 0.965,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleCardPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    router.push('/(tabs)/tanong');
  };

  // Language options: minimal text & "simulan ang chat dito" for Filipino
  const isFilipino = language === 'filipino';
  const isEnglish = language === 'english';

  const titleText = isEnglish
    ? 'Start chat here'
    : 'Simulan ang\nchat dito';

  const badgeText = isEnglish ? 'TIPI AI' : 'TIPI AI';

  const hintText = isEnglish
    ? 'Ask anything about your bill'
    : isFilipino
    ? 'Magtanong ukol sa kuryente'
    : 'Ask tips para makatipid';

  const buttonText = isEnglish ? 'Chat now →' : isFilipino ? 'Mag-chat →' : 'Chat na →';

  return (
    <Pressable
      onPress={handleCardPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={isFilipino ? 'Simulan ang chat dito kay Tipi' : 'Start chat here with Tipi'}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <LinearGradient
          colors={['#FF4E00', '#FF7000', '#FFA100']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Decorative glowing circles in background */}
          <View style={styles.ambientCircleOne} />
          <View style={styles.ambientCircleTwo} />

          {/* Left Text Column: Minimal, punchy */}
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

            {/* Fluid Pill CTA */}
            <View style={styles.ctaButton}>
              <Text style={[styles.ctaButtonText, { fontSize: 13 * fontScale }]}>
                {buttonText}
              </Text>
            </View>
          </View>

          {/* Right Avatar Column with Floating Animation */}
          <View style={styles.mascotContainer}>
            <Animated.View
              style={[
                styles.mascotAnimatedWrapper,
                { transform: [{ translateY: floatAnim }] },
              ]}
            >
              <Image
                source={TIPI_MASCOT}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Floating shadow that reacts to mascot height */}
            <Animated.View
              style={[
                styles.floatingShadow,
                { transform: [{ scaleX: shadowScale }] },
              ]}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
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
  mascotAnimatedWrapper: {
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
