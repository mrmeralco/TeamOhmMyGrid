# Meter photo analysis

The dashboard Home tab links to `/meter-reading`. English/Tagalog selection precedes capture. Manual reading works without a backend; submissions save the latest reading on this device under the signed-in user ID. Photos are not saved by the application. There is no utility submission or cloud reading history.

Automatic readability assessment and reading use the `analyze-meter` Supabase Edge Function and an OpenAI vision model. This is a model-based readability check, not a calibrated blur score; users must review every result. Four-dial analog meters and digital cumulative kWh registers are supported. Unsupported/uncertain images open the manual guide. Network/service failures have a separate message.

## Configure

1. In your Supabase project's Edge Function secrets, set `OPENAI_API_KEY` and `METER_VISION_MODEL` to an image-capable Responses API model supporting structured outputs that your account can access. Do not put these in `EXPO_PUBLIC_*` variables or commit them.
2. Deploy with `supabase functions deploy analyze-meter` to the project used by the app. Keep JWT verification enabled. The function also validates the caller with Supabase Auth and requires a verified email.
3. Rebuild native apps after adding the Expo Image Picker camera permission configuration.
4. Test with a verified Supabase account. Local/demo sessions cannot invoke authenticated analysis and use the manual fallback.

The API uses [image inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Requests disable response storage. The photo is transmitted to Supabase and OpenAI for analysis.

## Device acceptance checks

- Select each language; check camera permission denial, picker cancellation, gallery selection, and retake.
- Photograph clear analog/digital meters; verify extracted digits and leading zeros before submission.
- Try blur, glare, missing dials, unrelated images, unsupported dial counts, offline mode, and unavailable analysis.
- Enter 4, 3, 2, 1 starting from the right: review must show 1234, not 4321. Edit any digit and verify the saved value.
- Check the 9→0 exception, alternating rotation arrows, exact-number explanation, reduced motion, narrow screens, and keyboard navigation.
- Digital input accepts up to eight integer digits and three decimal places; incomplete/invalid values cannot submit.

Live analysis and physical camera behavior require deployment, secrets, and device validation; automated checks do not establish recognition accuracy.
