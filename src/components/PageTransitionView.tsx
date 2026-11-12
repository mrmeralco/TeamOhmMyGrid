import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

interface PageTransitionViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  delay?: number;
}

/**
 * Aesthetic, silky-smooth page transition wrapper for seamless navigation
 * Provides a gentle fluid fade-in and soft upward glide with natural spring physics.
 */
export const PageTransitionView: React.FC<PageTransitionViewProps> = ({
  children,
  style,
  delay = 0,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.988)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        damping: 18,
        stiffness: 170,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 20,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

