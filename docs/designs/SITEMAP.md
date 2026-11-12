# RFC & Design Documents Sitemap

* [KuryenTipid](file:///c:/Users/drak/Desktop/Github%20repositories/TeamOhmMyGrid/docs/designs/kuryentipid.md)
  * **Date:** 2026-11-12
  * **Author:** Team OhmMyGrid
  * **Status:** Complete Technical Design Document
  * **Components:** Stepped Tariff Engine, Standalone Mock Smart Plug Telemetry, Gemini Multimodal Bill OCR, Push-to-Talk Taglish Voice Assistant (Tipi), Peak-Hour Load Shift Scheduler.
  * **Description:** Comprehensive architectural design document for KuryenTipid, an Expo Go React Native mobile application for Meralco consumers featuring stepped tariff modeling, mock telemetry, bill OCR with manual fallback, dual-modality Taglish voice assistant, and multi-theme accessibility.

* [CAN Meter Classification (AMI vs. Analog) & Adaptive Consumption Tracking](file:///c:/Users/drak/Desktop/Github%20repositories/TeamOhmMyGrid/docs/designs/can-meter-classification.md)
  * **Date:** 2026-11-12
  * **Author:** Team OhmMyGrid
  * **Status:** Proposed
  * **Components:** `meralcoApiService`, `amiTelemetryService`, `analogMeterService`, `AmiCurveGraphCard`, `AmiPeakBreakdownCard`, `AnalogPhotographyGuideModal`, `AnalogMeterVerificationDrawer`, `WeeklyAnalogCurveGraph`, `MeterClassificationBadge`.
  * **Description:** Technical design for classifying 10-digit Meralco CANs as AMI or Analog via simulated Meralco API, multi-scale 15-minute AMI telemetry curve and synchronized peak/off-peak breakdown across Day/Week/Month/Year, and weekly Analog meter-photo capture supporting 5-dial pointer and mechanical drum meters with user verification, missed-week interpolation, and weekly curve rendering.
