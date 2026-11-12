import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface StartupSplashScreenProps {
  onFinish?: () => void;
}

export function StartupSplashScreen({ onFinish }: StartupSplashScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Master fade animation for transitioning into the sign in/sign up page
  const screenFadeAnim = useRef(new Animated.Value(1)).current;

  // Liquid rising animation (0 -> 1 over ~1000ms)
  const liquidAnim = useRef(new Animated.Value(0)).current;

  // Fluid wave sway animation (loops during liquid rise)
  const waveSwayAnim = useRef(new Animated.Value(0)).current;

  // Logo halves merging animation (0 -> 1 over ~850ms)
  const mergeAnim = useRef(new Animated.Value(0)).current;

  // Impact bounce / dock scale (1.0 -> 1.05 -> 1.0)
  const impactScaleAnim = useRef(new Animated.Value(1)).current;

  // Unified logo crossfade opacity
  const unifiedOpacityAnim = useRef(new Animated.Value(0)).current;

  // Light glint / shine across the merged logo
  const glintAnim = useRef(new Animated.Value(0)).current;

  // Ambient gold/white glow behind the logo
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Bubble float animation
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  const [isMerged, setIsMerged] = useState(false);

  useEffect(() => {
    // 1. Continuous wave sway loop
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveSwayAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveSwayAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    swayLoop.start();

    // 2. Liquid Bubble Drift
    Animated.timing(bubbleAnim, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // 3. Main Choreographed Sequence:
    // Total Duration: ~3.0 seconds
    // Phase 1 (0ms -> 1000ms): Orange gradient liquid rises and fills screen
    // Phase 2 (1000ms -> 1850ms): Logo halves fly in from off-screen and smoothly merge
    // Phase 3 (1850ms -> 2050ms): Logo stays merged for 0.2s (with glass lock impact & glint)
    // Phase 4 (2050ms -> 2850ms): Screen fades out into sign-in / sign-up page (~800ms)
    Animated.sequence([
      // --- PHASE 1: Orange Gradient Liquid Fills Up Screen (approx 1 second) ---
      Animated.timing(liquidAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        useNativeDriver: false,
      }),

      // --- PHASE 2: Halves Smoothly Glide in and Merge Together ---
      Animated.parallel([
        Animated.timing(mergeAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Impact Docking Pulse & Glint when merged
      Animated.parallel([
        Animated.sequence([
          Animated.timing(impactScaleAnim, {
            toValue: 1.06,
            duration: 110,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(impactScaleAnim, {
            toValue: 1.0,
            duration: 130,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(unifiedOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(glintAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // --- PHASE 3: Hold Merged for exactly 0.2s (200ms) ---
      Animated.delay(200),

      // --- PHASE 4: Smooth Fade into Sign In / Sign Up page ---
      Animated.timing(screenFadeAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      swayLoop.stop();
      onFinish?.();
    });

    // Gentle tactile haptic at docking moment (~1850ms)
    const hapticTimer = setTimeout(() => {
      setIsMerged(true);
      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch {
        // Safe fallback
      }
    }, 1850);

    return () => {
      swayLoop.stop();
      clearTimeout(hapticTimer);
    };
  }, []);

  // Responsive Logo Canvas Size based on screen width
  const LOGO_CANVAS_SIZE = Math.min(Math.max(screenWidth * 0.72, 250), 320);

  // Exact relative geometry from 1080x1080 Affinity source
  const leftPos = {
    left: (175.775 / 1080) * LOGO_CANVAS_SIZE,
    top: (160.245 / 1080) * LOGO_CANVAS_SIZE,
    width: (709 / 1080) * LOGO_CANVAS_SIZE,
    height: (764 / 1080) * LOGO_CANVAS_SIZE,
  };

  const rightPos = {
    left: (472.043 / 1080) * LOGO_CANVAS_SIZE,
    top: (180.163 / 1080) * LOGO_CANVAS_SIZE,
    width: (443 / 1080) * LOGO_CANVAS_SIZE,
    height: (725 / 1080) * LOGO_CANVAS_SIZE,
  };

  const unifiedPos = {
    left: (175.775 / 1080) * LOGO_CANVAS_SIZE,
    top: (160.245 / 1080) * LOGO_CANVAS_SIZE,
    width: (739 / 1080) * LOGO_CANVAS_SIZE,
    height: (764 / 1080) * LOGO_CANVAS_SIZE,
  };

  // Interpolations
  // Liquid height expands from 0 to full screen height + extra crest padding
  const liquidHeight = liquidAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight + 80],
  });

  // Wave surface horizontal slosh
  const waveTranslateX = waveSwayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 10],
  });

  // Logo Left translation: comes from off-screen left (-screenWidth * 0.95 -> 0)
  const leftTranslateX = mergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth * 0.95, 0],
  });

  // Logo Right translation: comes from off-screen right (+screenWidth * 0.95 -> 0)
  const rightTranslateX = mergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth * 0.95, 0],
  });

  // Logo Right vertical alignment tilt: subtle diagonal entry
  const rightTranslateY = mergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-45, 0],
  });

  // Halves opacity fades in rapidly during first 15% of movement
  const halvesOpacity = mergeAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 1, 1],
  });

  // Glint sheen highlight position
  const glintTranslateX = glintAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-LOGO_CANVAS_SIZE, LOGO_CANVAS_SIZE * 1.5],
  });

  const glintOpacity = glintAnim.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0, 0.85, 0.85, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: screenFadeAnim,
        },
      ]}
      pointerEvents="auto"
    >
      {/* 1. Pure White Base Background */}
      <View style={StyleSheet.absoluteFill} />

      {/* 2. Orange Gradient Liquid Rising from Bottom */}
      <Animated.View
        style={[
          styles.liquidWrapper,
          {
            height: liquidHeight,
            width: screenWidth,
          },
        ]}
      >
        {/* Animated Fluid Liquid Wave Surface at the crest */}
        <Animated.View
          style={[
            styles.waveContainer,
            {
              transform: [{ translateX: waveTranslateX }],
              width: screenWidth + 80,
            },
          ]}
        >
          <Svg width={screenWidth + 80} height={55} viewBox="0 0 500 55" preserveAspectRatio="none">
            <Defs>
              <SvgGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFA34D" stopOpacity="0.95" />
                <Stop offset="60%" stopColor="#FF7009" stopOpacity="1" />
                <Stop offset="100%" stopColor="#FF4B19" stopOpacity="1" />
              </SvgGradient>
              <SvgGradient id="waveHighlightGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                <Stop offset="100%" stopColor="#FFA04D" stopOpacity="0.05" />
              </SvgGradient>
            </Defs>
            {/* Background wave layer */}
            <Path
              d="M 0 25 C 75 10, 150 40, 250 22 C 350 5, 425 35, 500 20 L 500 55 L 0 55 Z"
              fill="url(#waveHighlightGrad)"
            />
            {/* Main foreground wave crest */}
            <Path
              d="M 0 18 C 65 32, 135 8, 220 22 C 305 35, 390 10, 500 18 L 500 55 L 0 55 Z"
              fill="url(#waveGrad)"
            />
          </Svg>
        </Animated.View>

        {/* Liquid Body: Multi-stop vibrant Meralco orange gradient */}
        <LinearGradient
          colors={['#FF822E', '#FF6B00', '#FF421A', '#D92A06']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.liquidBody}
        >
          {/* Liquid Effervescence / Translucent Bubbles */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View
              style={[
                styles.bubble,
                {
                  left: screenWidth * 0.22,
                  bottom: screenHeight * 0.25,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  transform: [
                    {
                      translateY: bubbleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [60, -120],
                      }),
                    },
                    {
                      scale: bubbleAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [0.5, 1.1, 0.9],
                      }),
                    },
                  ],
                  opacity: bubbleAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 0.35, 0.3, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.bubble,
                {
                  left: screenWidth * 0.74,
                  bottom: screenHeight * 0.35,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  transform: [
                    {
                      translateY: bubbleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [80, -160],
                      }),
                    },
                  ],
                  opacity: bubbleAnim.interpolate({
                    inputRange: [0, 0.3, 0.8, 1],
                    outputRange: [0, 0.28, 0.25, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.bubble,
                {
                  left: screenWidth * 0.48,
                  bottom: screenHeight * 0.15,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  transform: [
                    {
                      translateY: bubbleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, -100],
                      }),
                    },
                  ],
                  opacity: bubbleAnim.interpolate({
                    inputRange: [0, 0.4, 0.9, 1],
                    outputRange: [0, 0.4, 0.3, 0],
                  }),
                },
              ]}
            />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* 3. Central Logo Merge Stage */}
      <View style={styles.centerStage} pointerEvents="none">
        {/* Soft Ambient Radial Glass Halo behind logo */}
        <Animated.View
          style={[
            styles.ambientGlow,
            {
              width: LOGO_CANVAS_SIZE * 1.3,
              height: LOGO_CANVAS_SIZE * 1.3,
              borderRadius: (LOGO_CANVAS_SIZE * 1.3) / 2,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.38],
              }),
              transform: [{ scale: impactScaleAnim }],
            },
          ]}
        />

        {/* Master Logo Canvas Container */}
        <Animated.View
          style={[
            styles.logoCanvas,
            {
              width: LOGO_CANVAS_SIZE,
              height: LOGO_CANVAS_SIZE,
              transform: [{ scale: impactScaleAnim }],
            },
          ]}
        >
          {/* Logo-Left Half: Smoothly glides from off-screen left */}
          <Animated.View
            style={[
              styles.logoHalfContainer,
              {
                left: leftPos.left,
                top: leftPos.top,
                width: leftPos.width,
                height: leftPos.height,
                opacity: halvesOpacity,
                transform: [{ translateX: leftTranslateX }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo-left.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Logo-Right Half (Lightning bolt): Smoothly glides from off-screen right */}
          <Animated.View
            style={[
              styles.logoHalfContainer,
              {
                left: rightPos.left,
                top: rightPos.top,
                width: rightPos.width,
                height: rightPos.height,
                opacity: halvesOpacity,
                transform: [
                  { translateX: rightTranslateX },
                  { translateY: rightTranslateY },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo-right.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Unified Logo-Glass: Crossfades at moment of merge to ensure zero-seam glass brilliance */}
          <Animated.View
            style={[
              styles.logoHalfContainer,
              {
                left: unifiedPos.left,
                top: unifiedPos.top,
                width: unifiedPos.width,
                height: unifiedPos.height,
                opacity: unifiedOpacityAnim,
              },
            ]}
          >
            <Image
              source={require('../../assets/logo-liquid.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Glass Glint Sheen Effect: Shines across the seam as the halves dock together */}
          <Animated.View
            style={[
              styles.glintWrapper,
              {
                opacity: glintOpacity,
                transform: [
                  { translateX: glintTranslateX },
                  { rotate: '25deg' },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0)',
                'rgba(255, 255, 255, 0.45)',
                'rgba(255, 255, 255, 0.95)',
                'rgba(255, 255, 255, 0.45)',
                'rgba(255, 255, 255, 0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.glintBar}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 999999,
    elevation: 999999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  waveContainer: {
    position: 'absolute',
    top: -2,
    left: -20,
    height: 55,
    zIndex: 2,
  },
  liquidBody: {
    flex: 1,
    width: '100%',
    marginTop: 35,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  centerStage: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFF3E0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 36,
  },
  logoCanvas: {
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#300800',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 16,
  },
  logoHalfContainer: {
    position: 'absolute',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  glintWrapper: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glintBar: {
    width: '100%',
    height: '140%',
  },
});
