import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';

interface TipiMascotProps {
  isTalking?: boolean;
  size?: 'mini' | 'normal';
  style?: StyleProp<ViewStyle>;
}

export const TipiMascot: React.FC<TipiMascotProps> = ({
  isTalking = false,
  size = 'normal',
  style,
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const mouthScaleY = useRef(new Animated.Value(1)).current;

  const width = size === 'mini' ? 46 : 76;
  const height = size === 'mini' ? 69 : 114;

  useEffect(() => {
    // Floating bounce animation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: isTalking ? 800 : 1600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: isTalking ? 800 : 1600,
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, [floatAnim, isTalking]);

  useEffect(() => {
    if (isTalking) {
      const talkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(mouthScaleY, {
            toValue: 0.35,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(mouthScaleY, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      );
      talkLoop.start();
      return () => talkLoop.stop();
    } else {
      mouthScaleY.setValue(1);
    }
  }, [isTalking, mouthScaleY]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width,
          height,
          transform: [{ translateY: floatAnim }],
        },
        style,
      ]}
    >
      <Svg width={width} height={height} viewBox="0 0 200 300">
        {/* Main Body */}
        <Path
          d="M30 60 C60 40 110 70 130 110 C160 165 150 215 118 222 C88 226 62 182 48 130 C40 104 36 80 30 60 Z"
          fill="#FFFDF9"
          stroke="#F59E0B"
          strokeWidth="4"
        />
        {/* Top Leaf Accent */}
        <Path d="M108 58 Q120 36 134 42 Q122 60 108 58 Z" fill="#34D399" />

        {/* Eyes */}
        <Ellipse cx="92" cy="138" rx="6" ry="9" fill="#0F172A" />
        <Ellipse cx="120" cy="150" rx="6" ry="9" fill="#0F172A" />
        <Circle cx="94" cy="134" r="2" fill="#FFFDF9" />
        <Circle cx="122" cy="146" r="2" fill="#FFFDF9" />

        {/* Cheeks */}
        <Circle cx="80" cy="162" r="5" fill="#F59E0B" opacity={0.45} />
        <Circle cx="128" cy="172" r="5" fill="#F59E0B" opacity={0.45} />

        {/* Mouth */}
        <Path
          d="M92 178 Q103 188 114 176"
          fill="none"
          stroke="#0F172A"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Energy Bolt */}
        <Path
          d="M108 216 L96 240 L106 240 L92 268 L118 236 L108 236 L124 214 Z"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="1.5"
        />

        {/* Eco Sprout */}
        <G>
          <Path d="M100 296 Q70 270 62 240 Q88 258 100 296 Z" fill="#059669" />
          <Path d="M100 296 Q130 270 138 240 Q112 258 100 296 Z" fill="#0E5E58" />
        </G>
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
