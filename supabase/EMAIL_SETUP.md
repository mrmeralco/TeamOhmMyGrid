# Registration email verification

Registration now requires real Supabase email verification. Local registration is disabled because a browser-generated code cannot prove inbox ownership.

1. Apply the project's schema and seed data to your Supabase project.
2. Copy `.env.example` to `.env` and set the project URL and public anon key. Restart Expo after changing these values.
3. Enable **Confirm email** in Supabase Authentication's email provider settings.
4. Configure an SMTP provider for delivery to your testers' email addresses. Keep SMTP credentials in Supabase, never in Expo public environment variables.
5. In the **Confirm signup** email template, include the code:

   ```html
   <h2>Verify your KuryenTipid email</h2>
   <p>Your verification code is: <strong>{{ .Token }}</strong></p>
   ```

6. Configure a six-digit OTP and an appropriate expiry in Supabase. The provider enforces expiry and rate limits; the UI adds a 60-second resend cooldown.

The user submits their registration details, enters the emailed code, then sees their CAN. No app session is created before verification. An interrupted signup resumes automatically after a reload. Only the email address and send time are persisted, never the password or OTP. Resending requires an existing pending signup. The registration screen disables sending when project configuration is missing.

Test with a real inbox: wrong code, expired code, resend, reload/resume, and successful verification. Confirm that direct navigation to `/dashboard` before verification redirects to login. Existing local demo accounts are not proof of email ownership and cannot be migrated to verified accounts by setting a local flag.

The existing database trigger reserves the CAN when Supabase creates the pending auth user. Abandoned signups may need administrative cleanup. CAN allocation remains the existing prototype behavior, not a connection to Meralco's live customer database.

References: https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/reference/javascript/auth-verifyotp
