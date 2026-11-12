# Registration email verification

Registration now requires real Supabase email verification. Local registration is disabled because a browser-generated code cannot prove inbox ownership.

1. Apply the project's schema and seed data to your Supabase project.
2. Copy `.env.example` to `.env` and set the project URL and public anon key. Restart Expo after changing these values.
3. Enable **Confirm email** in Supabase Authentication's email provider settings.
4. Configure an SMTP provider for delivery to your testers' email addresses. Keep SMTP credentials in Supabase, never in Expo public environment variables.
5. In both the **Confirm signup** and **Magic Link** email templates, include the code (do not include a login link):

   ```html
   <h2>Verify your KuryenTipid email</h2>
   <p>Your verification code is: <strong>{{ .Token }}</strong></p>
   ```

6. Under Authentication → Sign In / Providers → Email, set **Email OTP expiration to 180 seconds** and use six-digit codes. Supabase must enforce this expiry; the app timer cannot change the provider setting. The app adds a 60-second resend cooldown.
7. Open SQL Editor, paste `supabase/migrations/20261112_email_verification.sql`, and run it. This adds protected cancellation of unverified registrations and requires OTP-authenticated JWTs for access to profiles, utility records, and audit records. The public API key cannot apply this migration or change Auth settings.

The user submits their registration details, enters the emailed code, then sees their CAN. The code-entry screen expires after three minutes, asks for a new code, and disables verification. Resending restarts that timer. Reloading preserves the original deadline.

An interrupted signup resumes after a reload. Pending storage contains the email, send time, verification purpose, and a random cancellation secret; never a password or OTP. The server stores only the secret's SHA-256 hash. “Edit registration details” must successfully cancel the pending auth user before returning to the form. It also releases the CAN reservation and clears the local challenge. Verified users cannot be deleted through this function. Pending registrations created before this update have no cancellation secret and require verification or administrator cleanup.

Each explicit sign-in checks the password using a separate nonpersistent client, revokes that temporary session, and requests an email code for the existing user. The app's persistent session and dashboard access are established only after OTP verification. Do not leave the SQL migration unapplied: the UI alone does not prevent direct password-only API access. This is email ownership verification, not proof of a person's real-world identity or Supabase AAL2 MFA. Existing verified sessions remain signed in until logout.

Test with a real inbox: wrong code, expired code, resend, reload/resume, and successful verification. Confirm that direct navigation to `/dashboard` before verification redirects to login. Existing local demo accounts are not proof of email ownership and cannot be migrated to verified accounts by setting a local flag.

### Recovery after a database reset

Deleting server data does not clear the browser/device's pending verification. On the code screen, choose **Start over on this device** to forget that local challenge and return to registration. This requires no database RPC, does not delete a Supabase Auth account, and does not mark the email verified. If the account still exists in Authentication → Users, log in or use the protected cancellation flow instead. Deleting profile rows alone does not delete Auth users. If tables/functions were removed, restore the schema and email-verification migration before registering again. An expired challenge needs a newly emailed code; resetting local state does not make an old code valid.

The existing database trigger reserves the CAN when Supabase creates the pending auth user. Abandoned signups that were never cancelled may need administrative cleanup. CAN allocation remains prototype behavior, not a connection to Meralco's live customer database.

Additional checks after deployment: cancel an unverified signup and register the same details again; confirm that its old code no longer works; verify that cancellation cannot delete a confirmed user; confirm password-only access to `profiles` is denied while an OTP session can read its own profile; verify a code at 179 seconds and reject it at 180 seconds using the Auth API as well as the app.

References: https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/reference/javascript/auth-verifyotp
