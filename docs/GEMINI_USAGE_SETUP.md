# Mobile budget-analysis demo

The existing React Native home tab now includes a themed Tipi budget-analysis card.
It uses mock hourly data, independently of the selected account and existing budget gauge.
Baseline: PHP 2,900 so far, PHP 3,500 budget, five days left, PHP 11.50/kWh.
13:00-16:00 means three hours; evening means 18:00-24:00. Average usage is
8.25 kWh/day; projection is PHP 3,374.38. The warning example changes current bill
to PHP 3,100 and projects PHP 3,574.38. Appliance identification is unconfirmed.

## Local setup

1. Run npm install.
2. Create a .env file (ignored by Git):

    GEMINI_API_KEY=your-server-side-key
    GEMINI_MODEL=gemini-3.8-flash
    EXPO_PUBLIC_USAGE_API_URL=http://YOUR_COMPUTER_LAN_IP:8081

3. Restart Expo with npx expo start --clear. Use the actual port shown by Expo.
4. Open the mobile app in Expo Go on the same Wi-Fi as the computer.
   For Android emulator, use http://10.0.2.2:8081. localhost on a phone is the phone,
   not your computer. Allow the dev server through the local firewall if needed.
5. Home loads the baseline automatically. Choose Warning example to exercise the
   red warning card. Missing configuration shows an actionable error, not fake AI output.

The Gemini SDK runs only in src/app/api/analyze-usage+api.ts. Never put this new key
in EXPO_PUBLIC_GEMINI_API_KEY or import the API route into the mobile UI. Existing
bill/chat/voice helpers still use their previous integration; this change does not migrate them.

The server only accepts two mock scenarios and caches successful results for five
minutes, with concurrent requests sharing one call per scenario. It validates JSON,
strips code fences, and rejects projections inconsistent with deterministic arithmetic.

For standalone builds, deploy the Expo API server separately and set the public URL
to its HTTPS address before rebuilding. Server secrets belong in that server's environment.
Before exposing this demo endpoint publicly, add authentication and rate limiting.

Checks: npx tsc --noEmit; npm test -- --runInBand src/lib/__tests__/usageAnalysis.test.ts

## Account privacy update
The endpoint now requires a server-verified Supabase bearer token. Local demo logins
cannot access Gemini. Cache and in-flight work are isolated by verified user ID and
scenario; responses use private, no-store. The mobile client discards responses
after an account change. Only synthetic demo data is sent; real database readings
are not connected yet. Future database queries must enforce ownership and RLS.

Legacy client-side Gemini calls are disabled; their existing offline examples remain.
Never configure EXPO_PUBLIC_GEMINI_API_KEY. Use only a server environment secret.
The key shared in chat was not saved or tested; replace it before configuring.
Responses are prompted to use up to three short sentences of everyday Taglish.
No deployment or whole-database privacy audit was performed.
