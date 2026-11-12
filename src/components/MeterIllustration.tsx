import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

export function MeterIllustration({ digital, active, value, tagalog }: { digital: boolean; active: number; value: string; tagalog: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let disposed = false;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (disposed || reduced) return;
      animation = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      animation.start();
    });
    return () => { disposed = true; animation?.stop(); };
  }, [pulse]);
  return <View style={styles.meter}>
    <Text style={styles.caption}>{tagalog ? 'Halimbawang metro • kWh' : 'Example meter • kWh'}</Text>
    {digital ? <Text style={styles.display}>{value || '01234'}</Text> : <View style={styles.row}>
      {[0, 1, 2, 3].map(index => {
        const direction = index % 2 === 0 ? -1 : 1;
        const angle = direction * 2.5 * Math.PI / 5 - Math.PI / 2;
        return <View key={index} style={[styles.dial, active === index && styles.active]}>
          <Animated.Text style={{ opacity: active === index ? pulse : 0, textAlign: 'center', color: '#92400e', fontSize: 24 }}>↓</Animated.Text>
          <Svg viewBox="0 0 100 100" width="100%" height={80} accessibilityLabel={`${tagalog ? 'Dayal' : 'Dial'} ${4 - index}`}>
            <Circle cx="50" cy="50" r="47" fill="#fffdf0" stroke="#a16207" />
            {Array.from({ length: 10 }, (_, n) => {
              const a = direction * n * Math.PI / 5 - Math.PI / 2;
              return <SvgText key={n} x={50 + 35 * Math.cos(a)} y={54 + 35 * Math.sin(a)} textAnchor="middle" fontSize="12" fill="#422006">{n}</SvgText>;
            })}
            <Line x1="50" y1="50" x2={50 + 27 * Math.cos(angle)} y2={50 + 27 * Math.sin(angle)} stroke="#92400e" strokeWidth="3" />
            <Circle cx="50" cy="50" r="4" fill="#92400e" />
          </Svg>
          <Text style={styles.rotation}>{direction === 1 ? '↻' : '↺'}</Text>
          <Text style={styles.caption}>{tagalog ? 'Dayal' : 'Dial'} {4 - index}</Text>
        </View>;
      })}
    </View>}
    <Text style={styles.caption}>{digital ? (tagalog ? 'Basahin ang display' : 'Read the display') : (tagalog ? '← Magsimula sa kanan' : '← Start on the right')}</Text>
  </View>;
}
const styles = StyleSheet.create({
  meter: { backgroundColor: '#fef3c7', borderRadius: 20, padding: 12, gap: 10, borderWidth: 1, borderColor: '#fde68a' },
  row: { flexDirection: 'row', gap: 3 }, dial: { flex: 1, borderWidth: 2, borderColor: 'transparent', borderRadius: 12 },
  active: { borderColor: '#b45309', backgroundColor: '#fde68a' }, caption: { textAlign: 'center', color: '#713f12', fontSize: 12 },
  rotation: { textAlign: 'center', fontSize: 25, color: '#92400e' }, display: { backgroundColor: '#fffde7', color: '#422006', fontSize: 36, letterSpacing: 6, textAlign: 'center', padding: 24, borderRadius: 10 },
});
