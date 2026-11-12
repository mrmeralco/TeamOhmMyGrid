import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface FloatingPillNavProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

// Initial sensible center estimates for tabs before onLayout reports
const DEFAULT_CENTERS: Record<string, number> = {
  index: 43,
  bill: 113,
  plugs: 245,
  profile: 315,
};

const CIRCLE_SIZE = 44;

export const FloatingPillNav: React.FC<FloatingPillNavProps> = ({
  activeRoute,
  onNavigate,
}) => {
  const { theme } = useTheme();

  const isTanongTab = activeRoute === 'tanong';

  // Store layout measurements for tabs: { x, width }
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const handleTabLayout = (route: string, layout: { x: number; width: number }) => {
    setTabLayouts((prev) => {
      const existing = prev[route];
      if (
        existing &&
        Math.abs(existing.x - layout.x) < 0.5 &&
        Math.abs(existing.width - layout.width) < 0.5
      ) {
        return prev;
      }
      return { ...prev, [route]: layout };
    });
  };

  const initialCenter = DEFAULT_CENTERS[activeRoute] || DEFAULT_CENTERS.index;
  const leftEdge = useSharedValue(initialCenter - CIRCLE_SIZE / 2);
  const rightEdge = useSharedValue(initialCenter + CIRCLE_SIZE / 2);
  const indicatorOpacity = useSharedValue(isTanongTab ? 0 : 1);

  // Keep track of previous target center to determine movement direction
  const prevCenterRef = useRef(initialCenter);

  useEffect(() => {
    if (activeRoute === 'tanong') {
      indicatorOpacity.value = withTiming(0, { duration: 180 });
      return;
    }

    indicatorOpacity.value = withTiming(1, { duration: 200 });

    const layout = tabLayouts[activeRoute];
    const targetCenter = layout
      ? layout.x + layout.width / 2
      : DEFAULT_CENTERS[activeRoute] || DEFAULT_CENTERS.index;
    const prevCenter = prevCenterRef.current;
    prevCenterRef.current = targetCenter;

    const targetLeft = targetCenter - CIRCLE_SIZE / 2;
    const targetRight = targetCenter + CIRCLE_SIZE / 2;

    const distance = Math.abs(targetCenter - prevCenter);

    if (distance < 2) {
      // Resting on same tab
      leftEdge.value = targetLeft;
      rightEdge.value = targetRight;
      return;
    }

    const isMovingRight = targetCenter > prevCenter;

    if (isMovingRight) {
      // Leading edge is rightEdge: shoots ahead quickly to stretch across
      rightEdge.value = withSpring(targetRight, {
        damping: 14,
        stiffness: 160,
        mass: 0.75,
      });
      // Trailing edge is leftEdge: lags slightly behind, creating the elastic stretch, then snaps back
      leftEdge.value = withSpring(targetLeft, {
        damping: 18,
        stiffness: 115,
        mass: 1.15,
      });
    } else {
      // Leading edge is leftEdge: shoots ahead to the left first
      leftEdge.value = withSpring(targetLeft, {
        damping: 14,
        stiffness: 160,
        mass: 0.75,
      });
      // Trailing edge is rightEdge: lags slightly behind
      rightEdge.value = withSpring(targetRight, {
        damping: 18,
        stiffness: 115,
        mass: 1.15,
      });
    }
  }, [activeRoute, tabLayouts, leftEdge, rightEdge, indicatorOpacity]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const left = leftEdge.value;
    const right = rightEdge.value;
    const width = Math.max(CIRCLE_SIZE, right - left);

    // Dynamic fluid squash: when stretching horizontally, height pinches subtly for gooey liquid physics
    const stretchProgress = Math.min(1, Math.max(0, (width - CIRCLE_SIZE) / 100));
    const currentHeight = CIRCLE_SIZE - 6 * stretchProgress; // 44 down to 38
    const top = (62 - currentHeight) / 2;
    const borderRadius = currentHeight / 2;

    return {
      left,
      width,
      height: currentHeight,
      top,
      borderRadius,
      opacity: indicatorOpacity.value,
    };
  });

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <View
        style={[
          styles.pillContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.line,
            shadowColor: theme.ink,
          },
        ]}
      >
        {/* Fluid Stretching Active Indicator (Faded Dark Orange Circle / Pill) */}
        <Animated.View
          style={[
            styles.fluidIndicator,
            {
              backgroundColor: `${theme.brand}24`,
              borderColor: `${theme.brand}38`,
              shadowColor: theme.brand,
            },
            animatedIndicatorStyle,
          ]}
          pointerEvents="none"
        />

        {/* Tab 1: Home */}
        <TouchableOpacity
          style={styles.tab}
          onLayout={(e) => handleTabLayout('index', e.nativeEvent.layout)}
          onPress={() => onNavigate('index')}
          accessibilityRole="tab"
          accessibilityLabel="Home"
          accessibilityState={{ selected: activeRoute === 'index' }}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z"
              stroke={activeRoute === 'index' ? theme.brand : theme.muted}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M9 21V12H15V21"
              stroke={activeRoute === 'index' ? theme.brand : theme.muted}
              strokeWidth="2.2"
            />
          </Svg>
        </TouchableOpacity>

        {/* Tab 2: Bill */}
        <TouchableOpacity
          style={styles.tab}
          onLayout={(e) => handleTabLayout('bill', e.nativeEvent.layout)}
          onPress={() => onNavigate('bill')}
          accessibilityRole="tab"
          accessibilityLabel="Bill"
          accessibilityState={{ selected: activeRoute === 'bill' }}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Rect
              x="4"
              y="3"
              width="16"
              height="18"
              rx="2.5"
              stroke={activeRoute === 'bill' ? theme.brand : theme.muted}
              strokeWidth="2.2"
            />
            <Path
              d="M8 8H16M8 12H16M8 16H12"
              stroke={activeRoute === 'bill' ? theme.brand : theme.muted}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* Center Tab: Permanent Message / Chat Bubble Icon */}
        <View style={styles.centerTabWrapper}>
          <TouchableOpacity
            style={[
              styles.centerButton,
              {
                backgroundColor: theme.brand,
                borderColor: theme.bg,
                shadowColor: theme.brand,
              },
            ]}
            onPress={() => onNavigate('tanong')}
            accessibilityRole="tab"
            accessibilityState={{ selected: isTanongTab }}
            accessibilityLabel="Tanong kay Tipi chat"
            activeOpacity={0.85}
          >
            {/* Message / Chat Bubble Icon */}
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 11.5C21 15.6421 16.9706 19 12 19C10.5186 19 9.12384 18.6983 7.89999 18.1565L3 20L4.54585 15.8821C3.57864 14.6148 3 13.1256 3 11.5C3 7.35786 7.02944 4 12 4C16.9706 4 21 7.35786 21 11.5Z"
                stroke={theme.brandInk}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx="8" cy="11.5" r="1.2" fill={theme.brandInk} />
              <Circle cx="12" cy="11.5" r="1.2" fill={theme.brandInk} />
              <Circle cx="16" cy="11.5" r="1.2" fill={theme.brandInk} />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Tab 4: Smart Plugs / Appliances */}
        <TouchableOpacity
          style={styles.tab}
          onLayout={(e) => handleTabLayout('plugs', e.nativeEvent.layout)}
          onPress={() => onNavigate('plugs')}
          accessibilityRole="tab"
          accessibilityLabel="Smart Plugs"
          accessibilityState={{ selected: activeRoute === 'plugs' }}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            {/* Top Contact Prongs */}
            <Path
              d="M9 2.5V5.5M15 2.5V5.5"
              stroke={activeRoute === 'plugs' ? theme.brand : theme.muted}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Sculpted Smart Plug Housing */}
            <Path
              d="M6 6H18C19.1046 6 20 6.89543 20 8V14.5C20 17.5376 17.5376 20 14.5 20H9.5C6.46243 20 4 17.5376 4 14.5V8C4 6.89543 4.89543 6 6 6Z"
              stroke={activeRoute === 'plugs' ? theme.brand : theme.muted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Smart Power / Standby Glyph */}
            <Path
              d="M9.5 12A3 3 0 1 0 14.5 12"
              stroke={activeRoute === 'plugs' ? theme.brand : theme.muted}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <Path
              d="M12 8.5V11.5"
              stroke={activeRoute === 'plugs' ? theme.brand : theme.muted}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Live Status Micro-LED */}
            <Circle
              cx="12"
              cy="17"
              r="1"
              fill={activeRoute === 'plugs' ? theme.brand : theme.muted}
            />
          </Svg>
        </TouchableOpacity>

        {/* Tab 5: Profile */}
        <TouchableOpacity
          style={styles.tab}
          onLayout={(e) => handleTabLayout('profile', e.nativeEvent.layout)}
          onPress={() => onNavigate('profile')}
          accessibilityRole="tab"
          accessibilityLabel="Profile"
          accessibilityState={{ selected: activeRoute === 'profile' }}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
              stroke={activeRoute === 'profile' ? theme.brand : theme.muted}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <Circle
              cx="12"
              cy="7"
              r="4"
              stroke={activeRoute === 'profile' ? theme.brand : theme.muted}
              strokeWidth="2.2"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pillContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    paddingHorizontal: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  fluidIndicator: {
    position: 'absolute',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    height: 48,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  centerTabWrapper: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  recordingTimerText: {
    fontWeight: '900',
  },
});
