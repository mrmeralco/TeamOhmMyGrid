import React from 'react';
import { View, Image, StyleProp, ViewStyle, StyleSheet } from 'react-native';

const TIPI_MASCOT = require('../../assets/tipi-mascot.png');

interface TipiMascotProps {
  isTalking?: boolean;
  size?: 'mini' | 'normal';
  style?: StyleProp<ViewStyle>;
}

export const TipiMascot: React.FC<TipiMascotProps> = ({
  size = 'normal',
  style,
}) => {
  const width = size === 'mini' ? 38 : 72;
  const height = size === 'mini' ? 38 : 72;

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Image
        source={TIPI_MASCOT}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
