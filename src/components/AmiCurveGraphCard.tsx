// ==============================================================================
// KuryenTipid - AMI Dynamic SVG Curve Graph Card
// Interactive Catmull-Rom/cubic Bezier curve visualization with gradient fill,
// multi-timeframe toggles (Day, Week, Month, Year), shaded Peak background band,
// and touch scrubbing inspection tooltip.
// Conforms to PROJECT.md § Interface Contracts
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Line,
  G,
} from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { AmiTimeframe, AmiTelemetryDataset } from '../types/amiTelemetry';
import {
  generateAmiTelemetry,
  generateSvgCurveCoordinates,
  generateSvgAreaPath,
  getPeakWindowBounds,
  formatCurrency,
} from '../services/amiTelemetryService';
import { MERALCO_EFFECTIVE_RATE } from '../lib/tariffEngine';

export interface AmiCurveGraphCardProps {
  /** The Customer Account Number to generate or inspect telemetry for */
  can?: string;
  /** Controlled active timeframe: 'day' | 'week' | 'month' | 'year' */
  timeframe?: AmiTimeframe;
  /** Initial timeframe: 'day' | 'week' | 'month' | 'year' (default: 'day') */
  initialTimeframe?: AmiTimeframe;
  /** Specific target date string (e.g. '2026-05-18') */
  targetDate?: string;
  /** Optional external pre-computed telemetry dataset */
  dataset?: AmiTelemetryDataset;
  /** Callback fired when the user selects a different timeframe */
  onTimeframeChange?: (timeframe: AmiTimeframe) => void;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
}

export const AmiCurveGraphCard: React.FC<AmiCurveGraphCardProps> = ({
  can = '0192-8823-4410',
  timeframe: controlledTimeframe,
  initialTimeframe = 'day',
  targetDate,
  dataset: externalDataset,
  onTimeframeChange,
  style,
  testID = 'ami-curve-graph-card',
}) => {
  const { theme, fontScale, language } = useTheme();
  const [internalTimeframe, setInternalTimeframe] = useState<AmiTimeframe>(
    controlledTimeframe ?? initialTimeframe
  );
  const timeframe = controlledTimeframe ?? internalTimeframe;
  const [chartWidth, setChartWidth] = useState<number>(320);
  const [activeScrubIndex, setActiveScrubIndex] = useState<number | null>(null);

  useEffect(() => {
    if (controlledTimeframe) {
      setInternalTimeframe(controlledTimeframe);
    }
  }, [controlledTimeframe]);

  const chartHeight = 180;
  const padding = 20;

  // Generate or use provided dataset for the selected timeframe
  const dataset: AmiTelemetryDataset = useMemo(() => {
    if (externalDataset && externalDataset.timeframe === timeframe) {
      return externalDataset;
    }
    return generateAmiTelemetry(can, timeframe, targetDate);
  }, [can, timeframe, targetDate, externalDataset]);

  // Extract numerical values based on active timeframe
  const graphValues: number[] = useMemo(() => {
    if (timeframe === 'day') {
      return dataset.readings.map((r) => r.kwh);
    }
    return dataset.summaryByBucket.map((b) => b.kwh);
  }, [dataset, timeframe]);

  // Compute SVG curve spline coordinates and points
  const svgCurve = useMemo(() => {
    return generateSvgCurveCoordinates(graphValues, chartWidth, chartHeight, padding);
  }, [graphValues, chartWidth, chartHeight, padding]);

  // Compute gradient area path
  const areaPath = useMemo(() => {
    return generateSvgAreaPath(svgCurve.pathString, svgCurve.points, chartHeight, padding);
  }, [svgCurve.pathString, svgCurve.points, chartHeight, padding]);

  // Peak window band coordinates for Day view
  const peakBounds = useMemo(() => {
    return getPeakWindowBounds(chartWidth, padding);
  }, [chartWidth, padding]);

  // Handle timeframe switcher toggle
  const handleSelectTimeframe = (newTf: AmiTimeframe) => {
    setInternalTimeframe(newTf);
    setActiveScrubIndex(null);
    onTimeframeChange?.(newTf);
  };

  // Timeframe-adjusted total kWh and cost for header display
  const displayedTotals = useMemo(() => {
    if (timeframe === 'day' || dataset.summaryByBucket.length === 0) {
      return {
        totalKwh: dataset.totalKwh,
        estimatedCost: dataset.estimatedTotalCost,
      };
    }
    const sumKwh = dataset.summaryByBucket.reduce((acc, b) => acc + b.kwh, 0);
    return {
      totalKwh: Number(sumKwh.toFixed(2)),
      estimatedCost: Number((sumKwh * MERALCO_EFFECTIVE_RATE).toFixed(2)),
    };
  }, [dataset, timeframe]);

  // Measure card width dynamically for responsive SVG rendering
  const handleLayout = (event: LayoutChangeEvent) => {
    const layoutWidth = event.nativeEvent.layout.width;
    if (layoutWidth > 0 && Math.abs(layoutWidth - chartWidth) > 5) {
      setChartWidth(layoutWidth - 32); // accounts for card horizontal padding
    }
  };

  // Touch scrubbing gesture handler
  const handleTouch = (event: GestureResponderEvent) => {
    const locX = event.nativeEvent.locationX;
    const { points } = svgCurve;
    if (!points || points.length === 0) return;

    let closestIdx = 0;
    let minDistance = Number.MAX_VALUE;

    points.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - locX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setActiveScrubIndex(closestIdx);
  };

  // Scrubbed item metadata
  const activeReading = useMemo(() => {
    if (activeScrubIndex === null) return null;
    if (timeframe === 'day' && dataset.readings[activeScrubIndex]) {
      return dataset.readings[activeScrubIndex];
    }
    return null;
  }, [activeScrubIndex, timeframe, dataset]);

  const activeBucket = useMemo(() => {
    if (activeScrubIndex === null) return null;
    if (timeframe !== 'day' && dataset.summaryByBucket[activeScrubIndex]) {
      return dataset.summaryByBucket[activeScrubIndex];
    }
    return null;
  }, [activeScrubIndex, timeframe, dataset]);

  const activePoint = activeScrubIndex !== null && svgCurve.points[activeScrubIndex]
    ? svgCurve.points[activeScrubIndex]
    : null;

  const timeframeLabels: { key: AmiTimeframe; label: string }[] = [
    { key: 'day', label: language === 'english' ? 'Day' : 'Araw' },
    { key: 'week', label: language === 'english' ? 'Week' : 'Linggo' },
    { key: 'month', label: language === 'english' ? 'Month' : 'Buwan' },
    { key: 'year', label: language === 'english' ? 'Year' : 'Taon' },
  ];

  return (
    <View
      testID={testID}
      onLayout={handleLayout}
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
        },
        style,
      ]}
    >
      {/* Header Row: Title & Total Value */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            {language === 'english' ? '⚡ AMI Real-Time Energy Curve' : '⚡ AMI Konsumo Curve'}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {dataset.meterSerialNumber} · {displayedTotals.totalKwh.toFixed(2)} kWh
          </Text>
        </View>

        <View style={styles.metricSummary}>
          <Text style={[styles.metricCost, { color: theme.brand, fontSize: 17 * fontScale }]}>
            {formatCurrency(displayedTotals.estimatedCost)}
          </Text>
          <Text style={[styles.metricCostSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
            {language === 'english' ? 'Estimated Total' : 'Tantiyang Halaga'}
          </Text>
        </View>
      </View>

      {/* Timeframe Pill Switcher Buttons */}
      <View style={[styles.switcherContainer, { backgroundColor: theme.cont }]}>
        {timeframeLabels.map((tf) => {
          const isActive = timeframe === tf.key;
          return (
            <TouchableOpacity
              key={tf.key}
              testID={`timeframe-${tf.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Piliin ang ${tf.label} timeframe`}
              onPress={() => handleSelectTimeframe(tf.key)}
              style={[
                styles.switcherPill,
                isActive && [
                  styles.switcherPillActive,
                  { backgroundColor: theme.brand },
                ],
              ]}
            >
              <Text
                style={[
                  styles.switcherText,
                  {
                    color: isActive ? theme.brandInk : theme.ink,
                    fontSize: 12.5 * fontScale,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {tf.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Interactive Tooltip Inspector Bar */}
      <View
        testID="scrub-tooltip"
        style={[
          styles.inspectorBar,
          {
            backgroundColor: theme.cont,
            borderColor: theme.line,
          },
        ]}
      >
        {activeReading ? (
          <View style={styles.inspectorContent}>
            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                {language === 'english' ? 'INTERVAL' : 'ORAS'}
              </Text>
              <Text style={[styles.inspectorValue, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {activeReading.timeLabel}
              </Text>
            </View>

            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                KWH
              </Text>
              <Text style={[styles.inspectorValue, { color: theme.brand, fontSize: 13 * fontScale }]}>
                {activeReading.kwh.toFixed(4)} kWh
              </Text>
            </View>

            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                POWER
              </Text>
              <Text style={[styles.inspectorValue, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {activeReading.powerWatts} W
              </Text>
            </View>

            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                STATUS
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor: activeReading.isCriticalPeak
                      ? theme.dangerBg
                      : activeReading.isPeak
                      ? theme.peakBg
                      : theme.okBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    {
                      color: activeReading.isCriticalPeak
                        ? theme.danger
                        : activeReading.isPeak
                        ? theme.peak
                        : theme.ok,
                      fontSize: 10 * fontScale,
                    },
                  ]}
                >
                  {activeReading.isCriticalPeak
                    ? 'CRITICAL'
                    : activeReading.isPeak
                    ? 'PEAK'
                    : 'OFF-PEAK'}
                </Text>
              </View>
            </View>
          </View>
        ) : activeBucket ? (
          <View style={styles.inspectorContent}>
            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                BUCKET
              </Text>
              <Text style={[styles.inspectorValue, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {activeBucket.label}
              </Text>
            </View>

            <View style={styles.inspectorCol}>
              <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                KONSUMO
              </Text>
              <Text style={[styles.inspectorValue, { color: theme.brand, fontSize: 13 * fontScale }]}>
                {activeBucket.kwh.toFixed(2)} kWh
              </Text>
            </View>

            {activeBucket.peakKwh !== undefined && (
              <View style={styles.inspectorCol}>
                <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                  PEAK / LOW
                </Text>
                <Text style={[styles.inspectorValue, { color: theme.peak, fontSize: 12 * fontScale }]}>
                  {activeBucket.peakKwh.toFixed(1)} / {(activeBucket.offPeakKwh ?? 0).toFixed(1)} kWh
                </Text>
              </View>
            )}

            {activeBucket.isPeak !== undefined && (
              <View style={styles.inspectorCol}>
                <Text style={[styles.inspectorLabel, { color: theme.muted, fontSize: 10 * fontScale }]}>
                  DEMAND
                </Text>
                <Text
                  style={[
                    styles.inspectorValue,
                    {
                      color: activeBucket.isPeak ? theme.peak : theme.ok,
                      fontSize: 13 * fontScale,
                    },
                  ]}
                >
                  {activeBucket.isPeak ? 'Peak' : 'Off-Peak'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.inspectorPlaceholder, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
            {language === 'english'
              ? 'Touch graph to inspect readings'
              : 'I-drag ang graph para makita ang detalye'}
          </Text>
        )}
      </View>

      {/* Pure SVG Curve Visualizer */}
      <View
        style={styles.svgWrapper}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setActiveScrubIndex(null)}
      >
        <Svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <Defs>
            {/* Smooth Vertical Curve Fill Gradient */}
            <LinearGradient id="amiCurveGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.brand} stopOpacity="0.45" />
              <Stop offset="70%" stopColor={theme.brand} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={theme.brand} stopOpacity="0.00" />
            </LinearGradient>
          </Defs>

          {/* Day View: Shaded Peak Demand Band (08:00 - 21:00 PST) */}
          {timeframe === 'day' && (
            <G>
              <Rect
                x={peakBounds.startX}
                y={padding}
                width={peakBounds.width}
                height={chartHeight - padding * 2}
                fill={theme.peakBg}
                opacity={0.65}
                rx={4}
              />
              {/* Peak boundary guide lines */}
              <Line
                x1={peakBounds.startX}
                y1={padding}
                x2={peakBounds.startX}
                y2={chartHeight - padding}
                stroke={theme.peak}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
              <Line
                x1={peakBounds.endX}
                y1={padding}
                x2={peakBounds.endX}
                y2={chartHeight - padding}
                stroke={theme.peak}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            </G>
          )}

          {/* Baseline horizontal grid line */}
          <Line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke={theme.line}
            strokeWidth={1.5}
          />

          {/* Area Fill Under Spline Curve */}
          {areaPath ? (
            <Path
              d={areaPath}
              fill="url(#amiCurveGradient)"
            />
          ) : null}

          {/* Spline Stroke Curve */}
          {svgCurve.pathString ? (
            <Path
              d={svgCurve.pathString}
              fill="none"
              stroke={theme.brand}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Discrete points for Week, Month, and Year views */}
          {timeframe !== 'day' &&
            svgCurve.points.map((pt, idx) => (
              <Circle
                key={`pt-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={timeframe === 'week' ? 4 : 2.5}
                fill={theme.surface}
                stroke={theme.brand}
                strokeWidth={2}
              />
            ))}

          {/* Interactive Touch Scrub Indicator Line and Dot */}
          {activePoint && (
            <G>
              <Line
                x1={activePoint.x}
                y1={padding}
                x2={activePoint.x}
                y2={chartHeight - padding}
                stroke={theme.ink}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={6}
                fill={theme.brand}
                stroke={theme.surface}
                strokeWidth={2}
              />
            </G>
          )}
        </Svg>
      </View>

      {/* Peak vs Low-Demand Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.peak }]} />
          <Text style={[styles.legendText, { color: theme.muted, fontSize: 11 * fontScale }]}>
            Peak (8AM–9PM)
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.ok }]} />
          <Text style={[styles.legendText, { color: theme.muted, fontSize: 11 * fontScale }]}>
            Off-Peak (Gabi/Linggo)
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    fontWeight: '600',
    marginTop: 2,
  },
  metricSummary: {
    alignItems: 'flex-end',
  },
  metricCost: {
    fontWeight: '800',
  },
  metricCostSub: {
    fontWeight: '600',
  },
  switcherContainer: {
    flexDirection: 'row',
    borderRadius: 9999,
    padding: 3,
    marginBottom: 10,
  },
  switcherPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  switcherText: {
    textAlign: 'center',
  },
  inspectorBar: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    justifyContent: 'center',
    marginBottom: 8,
  },
  inspectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inspectorCol: {
    alignItems: 'center',
  },
  inspectorLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inspectorValue: {
    fontWeight: '800',
    marginTop: 1,
  },
  inspectorPlaceholder: {
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  statusTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  statusTagText: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontWeight: '600',
  },
});
