import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { WeeklyAnalogSummary } from '../types/analogMeter';
import { getWeeklyAnalogSummary } from '../services/analogMeterService';

export interface WeeklyAnalogCurveGraphProps {
  /** The Customer Account Number */
  can?: string;
  /** Monthly budget in Pesos for ceiling calculation */
  monthlyBudget?: number;
  /** Effective Meralco rate per kWh */
  effectiveRate?: number;
  /** Optional pre-computed weekly summary */
  summary?: WeeklyAnalogSummary;
  /** Callback fired when user requests reload or capture */
  onRefreshNeeded?: () => void;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
}

export const WeeklyAnalogCurveGraph: React.FC<WeeklyAnalogCurveGraphProps> = ({
  can = '0284-9102-3321',
  monthlyBudget = 3500,
  effectiveRate = 11.43,
  summary: externalSummary,
  style,
  testID = 'weekly-analog-curve-graph',
}) => {
  const { theme, fontScale } = useTheme();
  const [internalSummary, setInternalSummary] = useState<WeeklyAnalogSummary | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(320);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (externalSummary) {
      setInternalSummary(externalSummary);
      setSelectedPointIndex(externalSummary.logs.length > 0 ? externalSummary.logs.length - 1 : null);
      return;
    }

    (async () => {
      try {
        const res = await getWeeklyAnalogSummary(can, monthlyBudget, effectiveRate);
        if (isMounted) {
          setInternalSummary(res);
          if (res.logs.length > 0) {
            setSelectedPointIndex(res.logs.length - 1);
          }
        }
      } catch {
        // ignore fetch error
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [can, monthlyBudget, effectiveRate, externalSummary]);

  const summary = externalSummary || internalSummary;
  const logs = useMemo(() => summary?.logs || [], [summary]);

  const onLayoutContainer = (e: LayoutChangeEvent) => {
    const measuredWidth = Math.floor(e.nativeEvent.layout.width);
    if (measuredWidth > 50 && measuredWidth !== chartWidth) {
      setChartWidth(measuredWidth);
    }
  };

  const chartHeight = 175;
  const paddingTop = 22;
  const paddingBottom = 28;
  const paddingLeft = 34;
  const paddingRight = 18;

  const drawingWidth = Math.max(100, chartWidth - paddingLeft - paddingRight);
  const drawingHeight = chartHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + drawingHeight;

  const ceilingKwh =
    summary?.budgetCeilingKwh || Math.round(((monthlyBudget / 4.3) / effectiveRate) * 10) / 10;
  const maxUsageInLogs = logs.length > 0 ? Math.max(...logs.map((l) => l.weeklyUsageKwh)) : 45;
  const maxY = Math.max(ceilingKwh * 1.25, maxUsageInLogs * 1.25, 50);

  const points = useMemo(() => {
    if (logs.length === 0) return [];
    return logs.map((log, index) => {
      const x =
        logs.length === 1
          ? paddingLeft + drawingWidth / 2
          : paddingLeft + (index / (logs.length - 1)) * drawingWidth;
      const normalizedY = Math.max(0, Math.min(maxY, log.weeklyUsageKwh));
      const y = paddingTop + (1 - normalizedY / maxY) * drawingHeight;
      return { x, y, log, index };
    });
  }, [logs, drawingWidth, drawingHeight, maxY]);

  const { curvePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { curvePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      const curve = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y}`;
      const area = `M ${p.x - 10} ${p.y} L ${p.x + 10} ${p.y} L ${p.x + 10} ${baselineY} L ${p.x - 10} ${baselineY} Z`;
      return { curvePath: curve, areaPath: area };
    }

    let curve = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      curve += ` C ${cpX.toFixed(2)} ${p0.y.toFixed(2)}, ${cpX.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const area = `${curve} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;

    return { curvePath: curve, areaPath: area };
  }, [points, baselineY]);

  const ceilingY = Math.max(
    paddingTop,
    Math.min(baselineY, paddingTop + (1 - ceilingKwh / maxY) * drawingHeight)
  );

  const selectedPoint =
    selectedPointIndex !== null && points[selectedPointIndex]
      ? points[selectedPointIndex]
      : points[points.length - 1] || null;

  const formatDateLabel = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    } catch {
      return '';
    }
  };

  const deltaPercent = summary?.deltaPercentVsPriorWeek || 0;
  const isDeltaFavorable = deltaPercent <= 0;

  return (
    <View
      testID={testID}
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
        },
        style,
      ]}
      onLayout={onLayoutContainer}
    >
      {/* Distilled Header: Title + Selected Week Reading */}
      <View style={styles.cardHeader}>
        <View style={styles.titleGroup}>
          <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Lingguhang Konsumo
          </Text>
          {selectedPoint && (
            <Text style={[styles.cardSubtitle, { color: theme.muted, fontSize: 12 * fontScale }]}>
              {formatDateLabel(selectedPoint.log.timestamp)} · Metro: {selectedPoint.log.readingKwh.toLocaleString()} kWh
              {selectedPoint.log.isInterpolated ? ' (Tantiya)' : ''}
            </Text>
          )}
        </View>

        {selectedPoint && (
          <View style={styles.selectedValueCol}>
            <Text style={[styles.selectedKwh, { color: theme.brand, fontSize: 16 * fontScale }]}>
              +{selectedPoint.log.weeklyUsageKwh} kWh
            </Text>
            <Text style={[styles.selectedCost, { color: theme.ok, fontSize: 12 * fontScale }]}>
              ₱{Math.round(selectedPoint.log.costEstimate)}
            </Text>
          </View>
        )}
      </View>

      {/* Clean 3-Stat Inline Strip (no nested bordered boxes) */}
      <View style={[styles.statStrip, { backgroundColor: theme.cont }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.muted, fontSize: 10.5 * fontScale }]}>
            vs Nakaraan
          </Text>
          <Text
            style={[
              styles.statVal,
              {
                color: isDeltaFavorable ? theme.ok : theme.danger,
                fontSize: 13.5 * fontScale,
              },
            ]}
          >
            {deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: theme.line }]} />

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.muted, fontSize: 10.5 * fontScale }]}>
            4-Wk Avg
          </Text>
          <Text style={[styles.statVal, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
            {summary ? `${summary.averageWeeklyKwh} kWh` : '--'}
          </Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: theme.line }]} />

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.muted, fontSize: 10.5 * fontScale }]}>
            Budget Limit
          </Text>
          <Text style={[styles.statVal, { color: theme.warn, fontSize: 13.5 * fontScale }]}>
            {ceilingKwh} kWh
          </Text>
        </View>
      </View>

      {/* SVG Curve Canvas */}
      <View style={styles.svgWrapper}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="analogCurveGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.brand} stopOpacity="0.38" />
              <Stop offset="75%" stopColor={theme.brand} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={theme.brand} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines and Y-axis labels */}
          {[0, 0.5, 1].map((pct, idx) => {
            const gridY = paddingTop + (1 - pct) * drawingHeight;
            const gridVal = Math.round(pct * maxY);
            return (
              <G key={idx}>
                <Line
                  x1={paddingLeft}
                  y1={gridY}
                  x2={chartWidth - paddingRight}
                  y2={gridY}
                  stroke={theme.line}
                  strokeWidth="1"
                  strokeDasharray="3, 3"
                />
                <SvgText
                  x={paddingLeft - 6}
                  y={gridY + 4}
                  fill={theme.muted}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="end"
                >
                  {gridVal}
                </SvgText>
              </G>
            );
          })}

          {/* Budget Ceiling Reference Dashed Line */}
          <Line
            x1={paddingLeft}
            y1={ceilingY}
            x2={chartWidth - paddingRight}
            y2={ceilingY}
            stroke={theme.warn}
            strokeWidth="1.5"
            strokeDasharray="6, 4"
          />

          {/* Semi-transparent area fill under curve */}
          {areaPath ? <Path d={areaPath} fill="url(#analogCurveGradient)" /> : null}

          {/* Smooth Bezier Spline Path */}
          {curvePath ? (
            <Path
              d={curvePath}
              fill="none"
              stroke={theme.brand}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Data Points and X-Axis Labels */}
          {points.map((pt, i) => {
            const isSelected = selectedPointIndex === i;
            return (
              <G key={i}>
                {isSelected && (
                  <Line
                    x1={pt.x}
                    y1={pt.y}
                    x2={pt.x}
                    y2={baselineY}
                    stroke={theme.brand}
                    strokeWidth="1.5"
                    strokeDasharray="2, 2"
                  />
                )}

                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6.5 : 4.5}
                  fill={isSelected ? theme.brand : theme.surface}
                  stroke={pt.log.isInterpolated ? theme.warn : theme.brand}
                  strokeWidth={isSelected ? 3 : 2.5}
                  strokeDasharray={pt.log.isInterpolated ? '2, 2' : undefined}
                  onPress={() => setSelectedPointIndex(i)}
                />

                <SvgText
                  x={pt.x}
                  y={baselineY + 17}
                  fill={isSelected ? theme.brand : theme.muted}
                  fontSize={10}
                  fontWeight={isSelected ? '800' : '600'}
                  textAnchor="middle"
                  onPress={() => setSelectedPointIndex(i)}
                >
                  {formatDateLabel(pt.log.timestamp)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleGroup: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontWeight: '800',
  },
  cardSubtitle: {
    marginTop: 2,
    fontWeight: '600',
  },
  selectedValueCol: {
    alignItems: 'flex-end',
  },
  selectedKwh: {
    fontWeight: '900',
  },
  selectedCost: {
    fontWeight: '700',
    marginTop: 1,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  statLabel: {
    fontWeight: '600',
    marginBottom: 2,
  },
  statVal: {
    fontWeight: '800',
  },
  svgWrapper: {
    alignItems: 'center',
  },
});
