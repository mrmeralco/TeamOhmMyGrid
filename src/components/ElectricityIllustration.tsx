// ==============================================================================
// ElectricityIllustration Component for KuryenTipid
// Flat-art vector illustration matching the aesthetic of Image 2,
// themed for electricity, smart metering, and home energy analytics.
// ==============================================================================

import React from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

export const ElectricityIllustration: React.FC<{ width?: number; height?: number }> = ({
  width = 280,
  height = 240,
}) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} viewBox="0 0 320 280" fill="none">
        <Defs>
          <LinearGradient id="orangeGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FB923C" />
            <Stop offset="100%" stopColor="#EA580C" />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFEDD5" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#FFF7ED" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Soft Background Energy Glow */}
        <Circle cx="160" cy="140" r="115" fill="url(#glowGrad)" />

        {/* Ambient Grid Lines (Subtle smart meter demand rays) */}
        <Path
          d="M60 210 Q 160 170 260 210"
          stroke="#FED7AA"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Decorative Plant (Right) */}
        <Rect x="235" y="150" width="18" height="55" rx="3" fill="#64748B" />
        <Path
          d="M244 150 L244 120"
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        {/* Plant Leaves / Flowers in Orange */}
        <Circle cx="230" cy="120" r="9" fill="#EA580C" />
        <Circle cx="258" cy="115" r="9" fill="#EA580C" />
        <Circle cx="240" cy="98" r="9" fill="#EA580C" />
        <Circle cx="255" cy="135" r="8" fill="#F97316" />

        {/* Minimalist Chair Frame (Behind Person) */}
        <Path
          d="M90 120 L90 220 M120 175 L120 220 M85 175 L145 175 M85 120 L135 120"
          stroke="#0F172A"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Person Sitting */}
        {/* Legs / Trousers in dark charcoal */}
        <Path
          d="M105 165 L145 165 L175 220 L160 220 L135 180 L105 180 Z"
          fill="#0F172A"
        />
        <Path
          d="M130 165 L155 190 L135 225 L120 225 L140 190 Z"
          fill="#1E293B"
        />
        {/* Shoes */}
        <Rect x="155" y="218" width="28" height="9" rx="4.5" fill="#0F172A" />
        <Rect x="116" y="222" width="26" height="8" rx="4" fill="#0F172A" />

        {/* Torso / Orange Shirt */}
        <Path
          d="M102 125 C102 110, 142 110, 142 125 L145 168 L100 168 Z"
          fill="url(#orangeGrad)"
        />

        {/* Arm holding coffee / device */}
        <Path
          d="M135 125 L158 142 L146 150 L128 135 Z"
          fill="url(#orangeGrad)"
        />

        {/* Head & Hair */}
        <Circle cx="124" cy="95" r="13" fill="#FDBA74" />
        {/* Hair in black */}
        <Path
          d="M112 94 C112 80, 134 80, 138 90 C138 94, 134 98, 126 98 C120 98, 112 96, 112 94 Z"
          fill="#0F172A"
        />

        {/* Laptop / Smart Energy Monitor */}
        <Path
          d="M142 150 L176 150 L172 156 L138 156 Z"
          fill="#64748B"
        />
        <Path
          d="M152 126 L178 126 L175 150 L149 150 Z"
          fill="#0F172A"
        />
        {/* Smart Meter Electricity Bolt on Laptop Screen */}
        <Path
          d="M165 131 L160 138 L164 138 L161 145 L168 137 L164 137 Z"
          fill="#F59E0B"
        />

        {/* Floating Smart Energy Lightbulb & Sparkles (Left) */}
        <G transform="translate(62, 70)">
          {/* Glowing Energy Badge */}
          <Circle cx="16" cy="16" r="20" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1" />
          <Path
            d="M16 8 C11.5 8 8 11.5 8 16 C8 18.8 9.4 21.2 11.5 22.6 L11.5 25 C11.5 25.5 12 26 12.5 26 L19.5 26 C20 26 20.5 25.5 20.5 25 L20.5 22.6 C22.6 21.2 24 18.8 24 16 C24 11.5 20.5 8 16 8 Z"
            fill="#F59E0B"
          />
          <Rect x="13" y="27" width="6" height="2" rx="1" fill="#D97706" />
        </G>

        {/* Floating Sparkles */}
        <Circle cx="85" cy="55" r="2.5" fill="#EA580C" />
        <Circle cx="195" cy="72" r="3" fill="#EA580C" />
        <Circle cx="215" cy="85" r="1.5" fill="#F59E0B" />
        <Circle cx="70" cy="130" r="2" fill="#F59E0B" />

        {/* Ground Line */}
        <Path
          d="M40 227 L280 227"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};
