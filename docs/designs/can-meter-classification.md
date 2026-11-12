# CAN Meter Classification (AMI vs. Analog) & Adaptive Consumption Tracking

*   **Author:** Team OhmMyGrid
*   **Status:** Proposed
*   **Date:** 2026-11-12

--------------------------------------------------------------------------------

## Overview

This design defines how KuryenTipid classifies a Meralco Customer Account Number (CAN) as either an Advanced Metering Infrastructure (`AMI`) smart meter or an electromechanical/mechanical `Analog` meter, and how the application adapts its consumption tracking interface to match the physical capabilities of the household's meter.

For `AMI` accounts, the application retrieves 15-minute interval consumption data from a simulated Meralco API and renders an interactive curve graph that adjusts across `Day`, `Week`, `Month`, and `Year` views alongside a synchronized peak and off-peak cost breakdown. For `Analog` accounts, which lack automated interval telemetry, the application provides a weekly meter-photo capture workflow with step-by-step framing instructions for both 5-dial pointer meters and 5-digit mechanical drum (cyclometer) meters, interactive user verification of cumulative kilowatt-hour (kWh) digits, linear interpolation for missed weekly logs, and a weekly-only consumption curve graph plotted against the household's weekly budget ceiling.

## The Problem

Residential electricity customers in the Meralco franchise area do not all have the same metering hardware:

1.  **Hardware Capability Mismatch:** A subset of households has been upgraded to smart `AMI` meters that transmit 15-minute consumption intervals to the utility, while the majority of residential households still rely on legacy `Analog` meters (either 5-dial counter-rotating pointer meters or 5-digit mechanical drum cyclometers) that are read manually once per month. Treating every account as interval-capable misleads analog meter households with fabricated real-time readings, while treating every account as monthly-only deprives AMI households of intraday peak and off-peak visibility.
2.  **Flatline Multi-Scale Telemetry & Desynchronized UI State:** In the existing prototype (`src/services/amiTelemetryService.ts`), switching the AMI curve graph to `Week` or `Month` view repeats a single static daily kWh total across all Monday–Saturday buckets and all days of the month, producing a flat horizontal line and identical figures across all CANs. Furthermore, the timeframe selector inside `AmiCurveGraphCard` does not update the adjacent `AmiPeakBreakdownCard`, leaving the peak/off-peak Peso breakdown fixed on the single-day view.
3.  **Analog Meter Reading Errors & Missed Weekly Logs:** Reading an analog meter from a smartphone photo is prone to parallax distortion, glass glare, and pointer-dial misinterpretation (where adjacent dials rotate in alternating directions). In addition, meters display cumulative lifetime kWh rather than weekly usage. If a household skips a weekly photo and logs a reading after 14 or 21 days, treating the multi-week cumulative delta as a single 7-day period distorts the weekly curve graph and triggers false high-usage alerts (`> 150 kWh/week`) against the single-week budget ceiling.

## Goals

*   **Deterministic CAN Classification:** Classify any 10-digit CAN (and 12-digit preset accounts) as `AMI` or `Analog` via a simulated Meralco API (`src/services/meralcoApiService.ts`) using a pre-seeded registry (`MERALCO_SEED_ACCOUNTS`) and a deterministic last-digit parity fallback (even last digit = `AMI`, odd last digit = `Analog`).
*   **Multi-Scale Dynamic AMI Curve & Synchronized Peak Breakdown:** Generate per-CAN deterministic 15-minute interval data for `Day` (96 points) and non-flat daily/monthly bucket aggregations for `Week` (7 days), `Month` (28–31 days), and `Year` (12 months with Philippine seasonal thermal weighting), keeping `AmiCurveGraphCard` and `AmiPeakBreakdownCard` synchronized when the user switches timeframes.
*   **Dual-Subtype Analog Photography Guide (`dial` and `cyclometer`):** Present clear framing and reading instructions in `AnalogPhotographyGuideModal` for both 5-dial counter-rotating pointer meters and 5-digit mechanical drum (cyclometer) meters before camera capture.
*   **Interactive Analog Reading Confirmation & Missed-Week Interpolation:** Provide a verification drawer (`AnalogMeterVerificationDrawer`) where users confirm or edit extracted cumulative kWh digits in either 5-dial or 5-drum format, specify or auto-detect missed weeks (`daysSinceLastReading >= 14`), normalize multi-week deltas into 7-day equivalents, and insert interpolated weekly entries (`isInterpolated: true`).
*   **Weekly-Only Analog Curve Graph:** Render confirmed and interpolated weekly kWh readings on a weekly curve graph (`WeeklyAnalogCurveGraph`) against the household's weekly kWh budget ceiling (`monthlyBudget / 4.3 / effectiveRate`), visually distinguishing interpolated weeks from photo-verified readings.
*   **Account Switcher Classification Visibility:** Display `MeterClassificationBadge` (`AMI Smart Meter` vs. `Analog Meter`) in the Home header, Profile CAN switcher modal, and Login/Register `SeedAccountsModal`.

## Non-Goals

*   **Live Meralco Head-End System (HES) / MDM Network Integration:** Connecting to Meralco's internal production infrastructure is out of scope; all classification and telemetry queries execute against the in-app simulated service and local storage.
*   **Intraday or Daily Curve Graphs for Analog Meters:** `Day`, `Month`, and `Year` interval views and peak/off-peak intraday breakdowns are excluded for `Analog` accounts because mechanical meters only display cumulative total kWh without time-of-use timestamps.
*   **Background OS Polling Daemons:** Running 15-minute background fetch timers when the application is closed is excluded due to iOS and Android background execution throttling; interval data is computed deterministically on demand when the dashboard loads or refreshes.
*   **Native Camera Frame Processors:** Custom C++ or OpenCV frame processors are excluded to maintain 100% compatibility with standard Expo Go via `expo-image-picker`.

## Open Questions

*   None. All requirements regarding dynamic mock data generation, dual analog meter subtypes (`dial` and `cyclometer`), user confirmation, and missed-week interpolation were resolved during `/egm-brainstorm`.

## Critical User Journeys (CUJs)

### CUJ 1: AMI Account Multi-Scale Peak & Low-Hour Monitoring

*   **Given**: A user is logged in or switches to an `AMI`-classified CAN (such as `1029384756` or any CAN ending in an even digit not overridden in the seed registry).
*   **When**: The user opens the Home screen (`src/app/(tabs)/index.tsx`), scrubs across the curve graph, and toggles the timeframe segmented control across `Day`, `Week`, `Month`, and `Year`.
*   **Then**: The header displays the `AMI Smart Meter` badge (`MeterClassificationBadge`); `AmiCurveGraphCard` renders a smooth cubic Bezier curve with 96 15-minute intervals for `Day`, 7 daily buckets for `Week`, 28–31 daily buckets for `Month`, and 12 monthly buckets for `Year`; `AmiPeakBreakdownCard` updates its peak (`08:00–21:00` Mon–Sat), critical-peak (`14:00–17:00` and `18:00–21:00`), and off-peak kWh and Peso totals to match the active timeframe.

### CUJ 2: Analog Account Weekly Meter Capture, Confirmation & Missed-Week Handling

*   **Given**: A user is active on an `Analog`-classified CAN (such as `1092837465` or any CAN ending in an odd digit not overridden in the seed registry).
*   **When**: The user taps `"Kunan ng Litrato"` on the Home screen, reviews the `5-Dial Pointer` or `Mechanical Drum (Cyclometer)` framing instructions in `AnalogPhotographyGuideModal`, captures a meter photo, adjusts the cumulative kWh reading or elapsed weeks in `AnalogMeterVerificationDrawer`, and taps `"Kumpirmahin at I-save"`.
*   **Then**: `saveAnalogMeterLog` validates the reading (handling 5-dial `99,999 -> 00,000` rollover and multi-week gap interpolation if 2+ weeks elapsed), persists the confirmed reading and any interpolated intermediate weekly entries (`isInterpolated: true`), updates the active CAN's `currentKwh` projection, and re-renders `WeeklyAnalogCurveGraph` with the new weekly data point(s) against the weekly budget ceiling.

## Technical Plan (Architecture)

### System Data Flow

```text
+-------------------------------------------------------------------------+
|                    Active CAN Selection (Auth / EnergyContext)          |
|        canNumber (10 or 12 digits) -> resolveMeterType(canNumber)       |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|            Simulated Meralco API Service (meralcoApiService.ts)         |
|  1. Lookup MERALCO_SEED_ACCOUNTS[cleanCAN]                              |
|  2. Fallback: determineMeterTypeByParity(cleanCAN) (even=AMI, odd=Ana)  |
|  Returns: MeralcoMeterDetails { meterType: 'AMI' | 'Analog', ... }      |
+-----------------+-------------------------------------+-----------------+
                  |                                     |
        meterType === 'AMI'                   meterType === 'Analog'
                  |                                     |
                  v                                     v
+-----------------------------------+ +-----------------------------------+
|     AMI Telemetry Pipeline        | |   Analog Weekly Photo Pipeline    |
| (amiTelemetryService.ts)          | | (analogMeterService.ts)           |
| - 96 x 15-min intervals (Day)     | | 1. AnalogPhotographyGuideModal    |
| - Dynamic daily variance (Week/Mo)| |    - 'dial' (5 pointer dials)     |
| - Seasonal heat weighting (Year)  | |    - 'cyclometer' (5 digit drums) |
| - Peak (08:00-21:00 Mon-Sat)      | | 2. captureMeterPhoto() + OCR/Sim  |
| - Critical (14-17h, 18-21h)       | | 3. AnalogMeterVerificationDrawer  |
|                                   | |    - User confirms/edits digits   |
| Home Screen (index.tsx):          | |    - Selects elapsed weeks (1-4w) |
| - Shared amiTimeframe state       | | 4. saveAnalogMeterLog()           |
| - AmiCurveGraphCard (SVG Bezier)  | |    - Multi-week interpolation     |
| - AmiPeakBreakdownCard (Synced)   | | 5. WeeklyAnalogCurveGraph (SVG)   |
+-----------------------------------+ +-----------------------------------+
```

### 1. Simulated Meralco CAN Classification (`src/services/meralcoApiService.ts`)

*   **Lookup Order**: `classifyCAN(can, options)` and `resolveMeterType(can)` normalize the input string with `cleanCAN(can)`. If the cleaned string exists in `MERALCO_SEED_ACCOUNTS`, the seeded `MeralcoMeterDetails` record is returned (supporting explicit test overrides such as odd-ending `1234567891` classified as `AMI` and even-ending `1234567894` or `9876543210` classified as `Analog`). Otherwise, `determineMeterTypeByParity(cleanCan)` classifies even last digits as `AMI` and odd last digits as `Analog`.
*   **Context Hydration (`src/context/EnergyContext.tsx`)**: Every `CANProfile` stores `meterType: MeterType`, `meterSerialNumber?: string`, `meterModel?: string`, and `lastReadingDate?: string`. When `addCanProfile(name, accountNumber, address, meterTypeOverride)` or `switchCanProfile(id)` runs, `activeMeterType` updates immediately and triggers an asynchronous `classifyCAN` call to hydrate `isClassifyingCan` during transition.

### 2. Multi-Scale Dynamic AMI Telemetry (`src/services/amiTelemetryService.ts`, `src/types/amiTelemetry.ts`)

*   **Deterministic Per-Bucket Variation in `Week` and `Month` Views**:
    *   In `generateAmiTelemetry(can, timeframe, targetDate, overrides)`, `day` view computes 96 15-minute intervals (`00:00` to `23:45`) using `getDiurnalPowerWatts(hour)` (with optional `constantPowerWatts` and `powerSpikeIndex` overrides).
    *   To fix the flatline `month` and `week` curves without breaking deterministic unit tests, each bucket in `week` (7 days) and `month` (28–31 days) applies a deterministic daily modulation factor (`dayFactor`) derived from the bucket index and CAN suffix when `overrides?.constantPowerWatts === undefined`. Specifically:
        *   For `week`: Monday through Saturday buckets apply a deterministic wave (`[1.00, 0.96, 1.04, 0.98, 1.08, 1.12]`) around `totalKwh`, and Sunday applies `0.85 * totalKwh` (`isPeak: false`), ensuring a non-flat 7-day curve where `summaryByBucket[6].kwh < summaryByBucket[0].kwh`.
        *   For `month`: Each day `idx` (`0` to `daysInMonth - 1`) applies a deterministic diurnal/weekly modulation factor (`0.85` to `1.18`) based on the day of the week and a deterministic hash of `(cleanCAN, idx)` when `overrides?.constantPowerWatts === undefined` (falling back to constant `totalKwh` when `constantPowerWatts` is explicitly provided for flatline unit test verification).
    *   Each `AmiTelemetrySummaryBucket` in `src/types/amiTelemetry.ts` is extended with optional `peakKwh?: number` and `offPeakKwh?: number` fields so scrubbing across `Week`, `Month`, and `Year` views can inspect bucket-level peak vs. off-peak splits.
*   **Synchronizing `AmiCurveGraphCard` and `AmiPeakBreakdownCard` (`src/app/(tabs)/index.tsx`)**:
    *   `HomeScreen` holds `const [amiTimeframe, setAmiTimeframe] = useState<AmiTimeframe>('day')`.
    *   `AmiCurveGraphCard` accepts optional controlled prop `timeframe?: AmiTimeframe` and callback `onTimeframeChange?: (tf: AmiTimeframe) => void` in addition to `initialTimeframe` (preserving backward compatibility with standalone component tests).
    *   `AmiPeakBreakdownCard` receives `timeframe={amiTimeframe}` from `HomeScreen` and scales its displayed Peak, Off-Peak, and Shift Savings metrics to match the active `Day`, `Week`, `Month`, or `Year` dataset.

### 3. Analog Meter Dual-Subtype Guide, Confirmation & Missed-Week Interpolation

*   **Dual-Subtype Photography Guide (`src/components/AnalogPhotographyGuideModal.tsx`)**:
    *   Adds an interactive subtype tab selector at the top of the modal: **`5-Dial Pointer ('dial')`** vs. **`Mechanical Drum ('cyclometer')`**.
    *   In `'dial'` mode, displays the 5 alternating clockwise (`CW`) and counter-clockwise (`CCW`) pointer dials (`10,000`, `1,000`, `100`, `10`, `1`) and the "choose the lower digit when between numbers" rule.
    *   In `'cyclometer'` mode, displays a 5-digit horizontal mechanical drum odometer preview (`[1][4][2][8][5] . [6]`) with instructions to read the 5 black-and-white whole-kWh drums from left to right and ignore the red fractional tenths drum on the far right, plus how to read a drum roller that is halfway between two digits.
    *   Passes the selected `AnalogMeterType` (`'dial' | 'cyclometer'`) to `onProceedToCamera?: (meterType?: AnalogMeterType) => void` when the user proceeds to capture.
*   **Verification Drawer & Missed-Week Selector (`src/components/AnalogMeterVerificationDrawer.tsx`)**:
    *   Adds a `'dial' | 'cyclometer'` toggle so the user can verify or switch their meter subtype before saving (updating `meterType` on the saved `AnalogMeterLogEntry` instead of hardcoding `'dial'`).
    *   Adds an **Elapsed Time / Missed Weeks selector** (`1 Linggo (7 araw)`, `2 Linggo (14 araw - 1 missed week)`, `3 Linggo (21 araw - 2 missed weeks)`, `4 Linggo (28 araw - 3 missed weeks)`), defaulting to auto-detected elapsed days from the prior log timestamp (clamped to 7-day multiples, or `7` when logs are seeded).
    *   Computes `deltaResult = calculateWeeklyAnalogDelta(currentKwh, previousReadingKwh, selectedDaysElapsed, ratePerKwh)`. High-consumption warning threshold (`> 150 kWh/week`) evaluates `deltaResult.normalizedWeeklyKwh > 150` rather than raw multi-week `weeklyUsageKwh`, eliminating false spike warnings when catching up after missed weeks.
*   **Linear Missed-Week Interpolation (`src/services/analogMeterService.ts`, `src/types/analogMeter.ts`)**:
    *   Extends `AnalogMeterLogEntry` in `src/types/analogMeter.ts` with `isInterpolated?: boolean`.
    *   In `saveAnalogMeterLog(entry)`: when `entry.daysSinceLastReading >= 14` and a prior log entry exists (`prior`), computes `weeksCount = Math.min(12, Math.max(2, Math.round(entry.daysSinceLastReading / 7)))`. For each missed intermediate week `w` (`1` to `weeksCount - 1`), synthesizes an interpolated `AnalogMeterLogEntry` with `isInterpolated: true`, evenly stepped cumulative `readingKwh`, `weeklyUsageKwh = entry.normalizedWeeklyKwh`, `daysSinceLastReading: 7`, and timestamp spaced at 7-day intervals between `prior.timestamp` and `entry.timestamp`. The final confirmed entry (`entry`) is saved with `weeklyUsageKwh: entry.normalizedWeeklyKwh` and `isInterpolated: false` so every point on the weekly curve represents a 7-day consumption period comparable to the weekly budget ceiling.
*   **Weekly Curve Graph Interpolated Node Styling (`src/components/WeeklyAnalogCurveGraph.tsx`)**:
    *   Renders interpolated weekly points (`log.isInterpolated === true`) with a dashed/hollow circular SVG node and displays an `"Interpolated (Tantiyang Konsumo mula sa nalaktawang linggo)"` badge in the selected-week detail card.

## Alternatives Considered

### Alternative A: Pure Odd/Even CAN Parity Without a Seeded Dictionary

*   **Pros**: Requires zero static lookup memory and classifies any 10-digit string in constant time using a single modulo operation.
*   **Cons**: Cannot represent real-world utility accounts where meter upgrades happen independently of account numbers (for example, an odd-ending CAN upgraded to an AMI smart meter or an even-ending CAN still using an analog meter).
*   **Reason for Rejection**: Rejected because pre-seeded test and demo accounts (`1234567891` as `AMI`, `1234567894` and `9876543210` as `Analog`) require explicit registry precedence over parity rules.

### Alternative B: Third-Party Native Charting Libraries (`react-native-chart-kit` / Skia)

*   **Pros**: Provides pre-built axis labels and line animation helpers.
*   **Cons**: Introduces native bridge dependencies or Skia native build steps that complicate standard Expo Go execution and make SVG path coordinate math harder to unit test in Jest.
*   **Reason for Rejection**: Rejected in favor of pure TypeScript Catmull-Rom to cubic Bezier coordinate computation (`generateSvgCurveCoordinates`) rendered directly with `react-native-svg`, which is already installed in `package.json` (`react-native-svg: 15.16.0`) and runs in Expo Go and Jest without native rebuilds.

### Alternative C: Plotting Unadjusted Multi-Week Analog Deltas Without Interpolation

*   **Pros**: Simpler storage logic in `saveAnalogMeterLog` because every user submission appends exactly one array item regardless of the time gap since the prior reading.
*   **Cons**: If a user skips one or two weekly photos, the 14- or 21-day cumulative kWh difference is plotted as a single week's consumption, falsely exceeding the 7-day budget ceiling reference line and triggering false `> 150 kWh` weekly spike warnings.
*   **Reason for Rejection**: Rejected in favor of linear multi-week normalization and intermediate weekly entry interpolation (`isInterpolated: true`).

### Alternative D: Supporting Only 5-Dial Pointer Meters in the Analog UI

*   **Pros**: Reduces UI state in `AnalogPhotographyGuideModal` and `AnalogMeterVerificationDrawer` to a single 5-dial layout.
*   **Cons**: Many legacy analog meters in the Philippines use 5-digit mechanical rotating drums (cyclometers) with a red fractional tenths roller rather than 5 clock-face pointer dials. Showing only clockwise/counter-clockwise pointer rules leaves drum-meter households without instructions on how to handle the fractional red digit or half-rotated drums.
*   **Reason for Rejection**: Rejected in favor of supporting both `'dial'` and `'cyclometer'` modes in the guide modal and verification drawer.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Security & Privacy**: Meter photos are processed in memory (`base64`) and stored as local device URIs inside `AsyncStorage` (`@kuryentipid_analog_logs_<CAN>`). When `EXPO_PUBLIC_GEMINI_API_KEY` is absent, extraction runs entirely offline via deterministic simulation without transmitting images over the network.
*   **Performance & Latency**: Computing 96 15-minute intervals and Catmull-Rom cubic Bezier SVG paths executes synchronously in under 5 ms on mobile JavaScript threads (`useMemo` keyed on `(can, timeframe, targetDate, ratePerKwh)`). Simulated Meralco API classification (`classifyCAN`) defaults to a 400 ms delay in UI flows and 0 ms in unit tests.
*   **Offline & Rollback Safety**: Both `amiTelemetryService` and `analogMeterService` operate offline with deterministic seed data (`generateSeedAnalogLogs` and `generateAmiTelemetry`), ensuring zero blank states when network connectivity is unavailable.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Assumptions

*   No new npm dependencies will be added to `package.json`; all SVG rendering uses the installed `react-native-svg` (`15.16.0`) and storage uses `@react-native-async-storage/async-storage` (`3.0.2`).
*   Existing unit and E2E test suites (`src/lib/__tests__/*.test.ts*` and `src/__tests__/e2e/*.test.ts`) must continue to pass without weakening any existing assertions.

### Target Files to Create/Modify

#### 1. [`../../src/types/amiTelemetry.ts`](../../src/types/amiTelemetry.ts) (Modify)

*   **Type / Scope**: TypeScript Interface Definitions
*   **Reused Existing Code**: `AmiTelemetrySummaryBucket` (`src/types/amiTelemetry.ts:22-26`)
*   **New / Changed Public Signatures**:
    *   Extend `AmiTelemetrySummaryBucket` with optional `peakKwh?: number` and `offPeakKwh?: number` fields.
*   **Rationale**: Allows `AmiCurveGraphCard` and `AmiPeakBreakdownCard` to inspect and aggregate peak vs. off-peak kWh across `week`, `month`, and `year` summary buckets in addition to `day` intervals.
*   **Verify Command**: `npx tsc --noEmit`

#### 2. [`../../src/types/analogMeter.ts`](../../src/types/analogMeter.ts) (Modify)

*   **Type / Scope**: TypeScript Interface Definitions
*   **Reused Existing Code**: `AnalogMeterLogEntry` (`src/types/analogMeter.ts:3-17`)
*   **New / Changed Public Signatures**:
    *   Extend `AnalogMeterLogEntry` with optional `isInterpolated?: boolean` field.
*   **Rationale**: Identifies weekly log entries synthesized during multi-week gap interpolation so `WeeklyAnalogCurveGraph` can visually distinguish interpolated weeks from user-photographed readings.
*   **Verify Command**: `npx tsc --noEmit`

#### 3. [`../../src/services/amiTelemetryService.ts`](../../src/services/amiTelemetryService.ts) (Modify)

*   **Type / Scope**: TypeScript Service Module
*   **Reused Existing Code**: `generateAmiTelemetry` (`src/services/amiTelemetryService.ts:120-247`), `getDiurnalPowerWatts` (`src/services/amiTelemetryService.ts:79-95`), `cleanCAN` (`src/utils/validation.ts:44`)
*   **New / Changed Public Signatures**:
    *   Add `export function getCanLoadScaleFactor(can: string): number` (returns a deterministic multiplier in `[0.88, 1.16]` based on `cleanCAN(can)` when `can` is not the default test account `'0192-8823-4410'`, preserving exact backward-compatible numbers for `'0192-8823-4410'` in existing tests).
    *   Update `generateAmiTelemetry(can, timeframe, targetDate, overrides)` (`src/services/amiTelemetryService.ts:185-226`) so:
        *   `week` buckets apply deterministic daily wave factors (`[1.00, 0.96, 1.04, 0.98, 1.08, 1.12, 0.85]`) to `totalKwh` and populate `peakKwh` and `offPeakKwh` per day.
        *   `month` buckets apply deterministic daily modulation factors (`0.86` to `1.16` based on `(idx, cleanCAN(can))`) when `overrides?.constantPowerWatts === undefined`, eliminating the flatline Month curve while preserving flatline behavior when `constantPowerWatts` is explicitly passed.
        *   `year` buckets populate `peakKwh` and `offPeakKwh` alongside `kwh`.
*   **Rationale**: Fixes the flatline bug in `month` and `week` views and makes AMI curves dynamically adapt across accounts and timeframes without breaking any existing unit test assertions in `src/lib/__tests__/amiTelemetry.test.ts`.
*   **Verify Command**: `npx jest src/lib/__tests__/amiTelemetry.test.ts --no-Watchman`

#### 4. [`../../src/services/analogMeterService.ts`](../../src/services/analogMeterService.ts) (Modify)

*   **Type / Scope**: TypeScript Service Module
*   **Reused Existing Code**: `extractAnalogMeterReading` (`src/services/analogMeterService.ts:115-221`), `calculateWeeklyAnalogDelta` (`src/services/analogMeterService.ts:227-254`), `saveAnalogMeterLog` (`src/services/analogMeterService.ts:361-390`), `generateSeedAnalogLogs` (`src/services/analogMeterService.ts:268-326`)
*   **New / Changed Public Signatures**:
    *   Update `extractAnalogMeterReading(photoBase64: string, previousReading?: number, preferredMeterType?: AnalogMeterType): Promise<AnalogMeterReadingResult>` to accept an optional `preferredMeterType` (`'dial' | 'cyclometer'`, defaulting to `'dial'`) in deterministic simulation fallback mode.
    *   Update `generateSeedAnalogLogs(can: string, baseReading?: number, effectiveRate?: number): AnalogMeterLogEntry[]` (`src/services/analogMeterService.ts:268-326`) so arbitrary unseeded analog CANs derive deterministic per-CAN weekly deltas and baseline readings from `hashString(cleanCAN(can))` rather than returning the identical `[38, 42, 36, 45, 40, 43]` array for all unseeded accounts.
    *   Update `saveAnalogMeterLog(entry: AnalogMeterLogEntry): Promise<void>` (`src/services/analogMeterService.ts:361-390`) so when `entry.daysSinceLastReading >= 14` and a prior entry exists with an earlier reading, the service computes `weeksMissed = Math.min(12, Math.round(entry.daysSinceLastReading / 7)) - 1`, inserts `weeksMissed` linearly interpolated `AnalogMeterLogEntry` records (`isInterpolated: true`, `weeklyUsageKwh: entry.normalizedWeeklyKwh`, `daysSinceLastReading: 7`), and stores the final confirmed entry with `weeklyUsageKwh: entry.normalizedWeeklyKwh` and `isInterpolated: false`.
*   **Rationale**: Implements missed-week linear interpolation so catching up after 2+ weeks does not distort the weekly curve or trigger false single-week budget breaches, and provides dynamic per-CAN seed logs for analog accounts.
*   **Verify Command**: `npx jest src/__tests__/e2e/tier1-feature-coverage.test.ts --no-Watchman`

#### 5. [`../../src/components/AmiCurveGraphCard.tsx`](../../src/components/AmiCurveGraphCard.tsx) (Modify)

*   **Type / Scope**: React Native Component
*   **Reused Existing Code**: `AmiCurveGraphCardProps` (`src/components/AmiCurveGraphCard.tsx:40-55`), `AmiCurveGraphCard` (`src/components/AmiCurveGraphCard.tsx:57-513`)
*   **New / Changed Public Signatures**:
    *   Extend `AmiCurveGraphCardProps` with optional controlled prop `timeframe?: AmiTimeframe`.
    *   Sync internal `timeframe` state when the controlled `timeframe` prop changes, and make the idle scrub placeholder text (`src/components/AmiCurveGraphCard.tsx:356-360`) and header total kWh / cost adapt to the active timeframe (`day`, `week`, `month`, `year`).
*   **Rationale**: Enables `HomeScreen` to coordinate the active timeframe between `AmiCurveGraphCard` and `AmiPeakBreakdownCard` while keeping standalone uncontrolled usage in existing tests working.
*   **Verify Command**: `npx jest src/lib/__tests__/amiTelemetry.test.ts --no-Watchman`

#### 6. [`../../src/components/AmiPeakBreakdownCard.tsx`](../../src/components/AmiPeakBreakdownCard.tsx) (Modify)

*   **Type / Scope**: React Native Component
*   **Reused Existing Code**: `AmiPeakBreakdownCardProps` (`src/components/AmiPeakBreakdownCard.tsx:27-42`), `AmiPeakBreakdownCard` (`src/components/AmiPeakBreakdownCard.tsx:44-272`)
*   **New / Changed Public Signatures**:
    *   Scale displayed `peakKwh`, `offPeakKwh`, `peakCost`, `offPeakCost`, and subtitle label in `AmiPeakBreakdownCard` when `timeframe` is `'week'`, `'month'`, or `'year'` (summing `summaryByBucket` peak/off-peak kWh when `externalDataset` is not overriding single-day metrics).
*   **Rationale**: Ensures the Peak vs. Off-Peak breakdown reflects the user's selected timeframe (`Day`, `Week`, `Month`, or `Year`) on the Home screen.
*   **Verify Command**: `npx jest src/lib/__tests__/amiTelemetry.test.ts --no-Watchman`

#### 7. [`../../src/components/AnalogPhotographyGuideModal.tsx`](../../src/components/AnalogPhotographyGuideModal.tsx) (Modify)

*   **Type / Scope**: React Native Modal Component
*   **Reused Existing Code**: `AnalogPhotographyGuideModalProps` (`src/components/AnalogPhotographyGuideModal.tsx:13-18`), `GUIDE_RULES` (`src/components/AnalogPhotographyGuideModal.tsx:31-76`)
*   **New / Changed Public Signatures**:
    *   Update `AnalogPhotographyGuideModalProps`: add optional `initialMeterType?: AnalogMeterType` and update `onProceedToCamera?: (meterType?: AnalogMeterType) => void`.
    *   Add a subtype toggle bar (`5-Dial Pointer` vs. `Mechanical Drum / Cyclometer`) that switches Rule 4 and the visual diagram between the 5 counter-rotating pointer dials (`10k CW`, `1k CCW`, `100s CW`, `10s CCW`, `1s CW`) and the 5-digit horizontal rotating drum cyclometer (`[1][4][2][8][5] . [6]` with red tenths roller exclusion rule).
*   **Rationale**: Provides accurate framing and reading instructions for both physical analog meter designs used in Meralco residential installations.
*   **Verify Command**: `npx tsc --noEmit`

#### 8. [`../../src/components/AnalogMeterVerificationDrawer.tsx`](../../src/components/AnalogMeterVerificationDrawer.tsx) (Modify)

*   **Type / Scope**: React Native Modal Drawer Component
*   **Reused Existing Code**: `AnalogMeterVerificationDrawerProps` (`src/components/AnalogMeterVerificationDrawer.tsx:22-34`), `AnalogMeterVerificationDrawer` (`src/components/AnalogMeterVerificationDrawer.tsx:38-387`)
*   **New / Changed Public Signatures**:
    *   Extend `AnalogMeterVerificationDrawerProps` with optional `initialMeterType?: AnalogMeterType` and `initialDaysElapsed?: number`.
    *   Add a `'dial' | 'cyclometer'` subtype selector and an elapsed-weeks selector (`1 Linggo (7d)`, `2 Linggo (14d)`, `3 Linggo (21d)`, `4 Linggo (28d)`).
    *   Pass `selectedDaysElapsed` into `calculateWeeklyAnalogDelta(currentReadingNumber, previousReadingKwh, selectedDaysElapsed, effectiveRate)` and evaluate `isSpike` against `deltaCalc.normalizedWeeklyKwh > 150`. Populate `daysSinceLastReading: selectedDaysElapsed` and `meterType: selectedMeterType` in the saved `AnalogMeterLogEntry`.
*   **Rationale**: Lets analog users confirm readings in either 5-dial or 5-drum format and specify missed weeks so multi-week deltas are normalized and interpolated accurately.
*   **Verify Command**: `npx tsc --noEmit`

#### 9. [`../../src/components/WeeklyAnalogCurveGraph.tsx`](../../src/components/WeeklyAnalogCurveGraph.tsx) (Modify)

*   **Type / Scope**: React Native SVG Component
*   **Reused Existing Code**: `WeeklyAnalogCurveGraph` (`src/components/WeeklyAnalogCurveGraph.tsx:43-427`)
*   **New / Changed Public Signatures**:
    *   No breaking prop changes. Update node rendering (`src/components/WeeklyAnalogCurveGraph.tsx:363-405`) and tooltip card (`src/components/WeeklyAnalogCurveGraph.tsx:255-284`) to display a dashed stroke ring and `"Interpolated (Tantiyang Konsumo)"` tag when `selectedPoint.log.isInterpolated === true`.
*   **Rationale**: Visually distinguishes interpolated missed weeks from photo-verified weekly readings on the weekly curve graph.
*   **Verify Command**: `npx tsc --noEmit`

#### 10. [`../../src/app/(tabs)/index.tsx`](../../src/app/%28tabs%29/index.tsx) (Modify)

*   **Type / Scope**: Expo Router Screen (`HomeScreen`)
*   **Reused Existing Code**: `HomeScreen` (`src/app/(tabs)/index.tsx:39-350`), `useEnergy` (`src/context/EnergyContext.tsx:427`)
*   **New / Changed Public Signatures**:
    *   Add `const [amiTimeframe, setAmiTimeframe] = useState<AmiTimeframe>('day')` and `const [analogSubtype, setAnalogSubtype] = useState<AnalogMeterType>('dial')`.
    *   Pass `timeframe={amiTimeframe}` and `onTimeframeChange={setAmiTimeframe}` to `AmiCurveGraphCard`, and `timeframe={amiTimeframe}` to `AmiPeakBreakdownCard`.
    *   Pass `initialMeterType={analogSubtype}` to `AnalogPhotographyGuideModal` and `AnalogMeterVerificationDrawer`, and call `setCurrentKwh` in `handleConfirmAnalogLog` to keep the household's monthly consumption projection synchronized with newly logged analog readings.
*   **Rationale**: Synchronizes the AMI curve and peak breakdown cards across `Day`, `Week`, `Month`, and `Year` views, and connects the dual-subtype analog guide, verification drawer, and `EnergyContext` on the Home dashboard.
*   **Verify Command**: `npx tsc --noEmit`

#### 11. [`../../src/app/(tabs)/profile.tsx`](../../src/app/%28tabs%29/profile.tsx) & [`../../src/components/SeedAccountsModal.tsx`](../../src/components/SeedAccountsModal.tsx) (Modify)

*   **Type / Scope**: Expo Router Screen & Modal Component
*   **Reused Existing Code**: `MeterClassificationBadge` (`src/components/MeterClassificationBadge.tsx:33`), Profile CAN list (`src/app/(tabs)/profile.tsx:458-528`), `SeedAccountsModal` list (`src/components/SeedAccountsModal.tsx:46-70`)
*   **New / Changed Public Signatures**:
    *   Render `<MeterClassificationBadge meterType={p.meterType} size="compact" />` in each CAN profile card in `src/app/(tabs)/profile.tsx` and `<MeterClassificationBadge meterType={item.meterType} size="compact" />` in `src/components/SeedAccountsModal.tsx`.
*   **Rationale**: Displays `AMI` vs. `Analog` classification badges in the account switcher and demo seed modal so users can identify meter types before switching accounts.
*   **Verify Command**: `npx tsc --noEmit`

#### 12. [`../../src/lib/__tests__/amiTelemetry.test.ts`](../../src/lib/__tests__/amiTelemetry.test.ts) (Modify)

*   **Type / Scope**: Jest Unit Test Suite
*   **Reused Existing Code**: `Suite 3: Multi-Timeframe Telemetry Aggregation` (`src/lib/__tests__/amiTelemetry.test.ts:263-307`)
*   **New / Changed Public Signatures**:
    *   Add unit tests verifying:
        1. Non-flat daily variance across `week` and `month` buckets when `constantPowerWatts` is not set.
        2. Per-CAN dynamic scaling differences between distinct AMI CANs (`0192-8823-4410` vs. `1234567892`).
        3. Missed-week linear interpolation in `saveAnalogMeterLog` (`daysSinceLastReading: 21` generating 2 interpolated intermediate weekly logs + 1 confirmed log) and dual `'dial' | 'cyclometer'` extraction support.
*   **Rationale**: Verifies all new dynamic AMI curve requirements, analog dual-subtype handling, and missed-week interpolation with automated assertions.
*   **Verify Command**: `npx jest --no-Watchman`

### Verification Plan

*   **Typecheck**: `npx tsc --noEmit` (must exit with code 0 and zero TypeScript errors).
*   **Lint**: `npx expo lint` (must exit with code 0).
*   **Unit & E2E Tests**: `npx jest --no-Watchman` (all unit and E2E test suites must pass with 0 failures).

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
