import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { EmailDeliveryModal } from '../components/EmailDeliveryModal';
import { isLiveSupabaseConfigured } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { confirmRegistrationOTP, getPendingEmailVerification, resendRegistrationOTP } from '../services/authService';
import { RegistrationFormData, UserProfile } from '../types/auth';
import { evaluatePassword, validateConfirmPassword, validateEmail, validateFullName, validatePassword, validateUsername } from '../utils/validation';

function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#94a3b8" style={[styles.input, !!error && styles.inputError]} />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register, refreshSession } = useAuth();
  const configured = isLiveSupabaseConfigured();
  const [form, setForm] = useState<RegistrationFormData>({ fullName: '', username: '', email: '', can: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null);
  const [showCAN, setShowCAN] = useState(false);

  useEffect(() => {
    let active = true;
    getPendingEmailVerification().then(pending => {
      if (!active || !pending || !configured) return;
      setPendingEmail(pending.email);
      setForm(prev => ({ ...prev, email: pending.email }));
      setResendAt(pending.sentAt + 60000);
      setVerificationOpen(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [configured]);
  useEffect(() => {
    if (!verificationOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [verificationOpen]);

  const change = (key: keyof RegistrationFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
    setError('');
  };
  const submit = async () => {
    if (busy || !configured) return;
    const validations = {
      fullName: validateFullName(form.fullName), username: validateUsername(form.username),
      email: validateEmail(form.email), password: validatePassword(form.password),
      confirmPassword: validateConfirmPassword(form.password, form.confirmPassword),
    };
    const nextErrors: Record<string, string> = {};
    Object.entries(validations).forEach(([key, result]) => {
      if (!result.isValid) nextErrors[key] = result.message || 'Check this field.';
    });
    if (form.can && !/^\d{10}$/.test(form.can)) nextErrors.can = 'Enter the 10 digits from your bill.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setError('');
    try {
      const result = await register(form);
      if (!result.success || !result.data) { setError(result.error || 'Unable to create your account.'); return; }
      setPendingEmail(result.data.email);
      setCode('');
      setNotice('');
      setNow(Date.now());
      setResendAt(Date.now() + 60000);
      setVerificationOpen(true);
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setShowPassword(false);
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy || code.length !== 6) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const profile = await confirmRegistrationOTP(pendingEmail, code);
      await refreshSession();
      setRegisteredUser(profile);
      setVerificationOpen(false);
      setPendingEmail('');
      setShowCAN(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to verify your code.'); }
    finally { setBusy(false); }
  };
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const resend = async () => {
    if (busy || remaining) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await resendRegistrationOTP(pendingEmail);
      setCode(''); setNow(Date.now()); setResendAt(Date.now() + 60000);
      setNotice('A new code was requested. Check your inbox and spam folder.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send a new code.'); }
    finally { setBusy(false); }
  };
  const strength = evaluatePassword(form.password);
  const passwordTip = !strength.hasMinLength ? 'Use at least 8 characters.'
    : !strength.hasLetter ? 'Add a letter.'
    : !strength.hasNumber ? 'Add a number.'
    : !strength.hasUppercase ? 'Add an uppercase letter.'
    : !strength.hasSpecialChar ? 'Add a symbol, such as ! or #.' : '';

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.brand}>KuryenTipid</Text>
          <Text style={styles.step}>{verificationOpen ? 'STEP 2 OF 2' : 'STEP 1 OF 2'}</Text>
          <Text style={styles.title}>{verificationOpen ? 'Check your email' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>{verificationOpen ? 'Enter the 6-digit verification code for' : 'Start managing your household electricity.'}</Text>
          {verificationOpen && <Text style={styles.email}>{pendingEmail}</Text>}
          {!!error && <View style={styles.banner}><Text accessibilityRole="alert" style={styles.bannerText}>{error}</Text></View>}
          {verificationOpen ? (
            <View>
              <Field label="Verification code" value={code} onChangeText={value => { setCode(value.replace(/\D/g, '')); setError(''); }} placeholder="000000" maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" editable={!busy} onSubmitEditing={verify} />
              <Text style={styles.helper}>Check your spam folder if the email is missing.</Text>
              {!!notice && <Text accessibilityLiveRegion="polite" style={styles.helper}>{notice}</Text>}
              <TouchableOpacity accessibilityRole="button" style={[styles.button, (busy || code.length !== 6) && styles.disabled]} disabled={busy || code.length !== 6} onPress={verify}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify email</Text>}
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={busy || remaining > 0} onPress={resend}>
                <Text style={[styles.linkText, remaining > 0 && styles.muted]}>{remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={busy} onPress={() => { setVerificationOpen(false); setError(''); setNotice(''); }}>
                <Text style={styles.secondaryLink}>Edit registration details</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Field label="Full name" placeholder="Your full name" value={form.fullName} onChangeText={value => change('fullName', value)} error={errors.fullName} autoComplete="name" editable={!busy} />
              <Field label="Username" placeholder="4–20 letters or numbers" value={form.username} onChangeText={value => change('username', value.trim().toLowerCase())} error={errors.username} autoCapitalize="none" autoCorrect={false} editable={!busy} />
              <Field label="Email address" placeholder="you@example.com" value={form.email} onChangeText={value => change('email', value.trim())} error={errors.email} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} editable={!busy} />
              <Field label="CAN (optional)" placeholder="10-digit number on your bill" value={form.can} onChangeText={value => change('can', value.replace(/\D/g, ''))} error={errors.can} keyboardType="number-pad" maxLength={10} editable={!busy} />
              <Field label="Password" placeholder="At least 8 characters" value={form.password} onChangeText={value => change('password', value)} error={errors.password} secureTextEntry={!showPassword} autoComplete="new-password" autoCapitalize="none" editable={!busy} />
              <View style={styles.passwordHelp}>
                <Text accessibilityLiveRegion="polite" style={[styles.helper, styles.strengthText]}>{form.password ? `Strength: ${strength.strengthLabel}${strength.strengthLabel !== 'Strong' && passwordTip ? ` - ${passwordTip}` : ''}` : 'Use a letter and a number.'}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'} onPress={() => setShowPassword(!showPassword)}><Text style={styles.linkText}>{showPassword ? 'Hide' : 'Show'}</Text></TouchableOpacity>
              </View>
              <Field label="Confirm password" placeholder="Re-enter your password" value={form.confirmPassword} onChangeText={value => change('confirmPassword', value)} error={errors.confirmPassword} secureTextEntry={!showPassword} autoComplete="new-password" autoCapitalize="none" editable={!busy} onSubmitEditing={submit} />
              <Text style={styles.helper}>We’ll send a code to verify your email.</Text>
              <TouchableOpacity accessibilityRole="button" style={[styles.button, (busy || !configured) && styles.disabled]} disabled={busy || !configured} onPress={submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{configured ? 'Send verification code' : 'Email delivery unavailable'}</Text>}
              </TouchableOpacity>
              {!!pendingEmail && <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={busy} onPress={() => { setVerificationOpen(true); setError(''); }}><Text style={styles.linkText}>Continue email verification</Text></TouchableOpacity>}
            </View>
          )}
          <TouchableOpacity accessibilityRole="button" style={styles.footer} disabled={busy} onPress={() => router.replace('/login')}><Text style={styles.secondaryLink}>Log in</Text></TouchableOpacity>
        </View>
        <EmailDeliveryModal visible={showCAN} user={registeredUser} onProceed={() => { setShowCAN(false); router.replace('/(tabs)'); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', backgroundColor: '#faf2ec' },
  scroll: { flex: 1, width: '100%' },
  content: { flexGrow: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: '#f1e8df' },
  brand: { color: '#ea580c', fontSize: 17, fontWeight: '800', marginBottom: 24 },
  step: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  email: { color: '#0f172a', fontSize: 15, fontWeight: '600', marginBottom: 24, marginTop: -16 },
  field: { marginBottom: 15 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: { minHeight: 48, width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#b91c1c', fontSize: 12, marginTop: 5 },
  banner: { padding: 13, backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 12, marginBottom: 20 },
  bannerText: { color: '#9a3412', fontSize: 13, lineHeight: 19 },
  helper: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  passwordHelp: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -8, marginBottom: 15 },
  strengthText: { flex: 1, marginRight: 12 },
  button: { minHeight: 50, backgroundColor: '#ea580c', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { backgroundColor: '#cbd5e1' },
  link: { alignItems: 'center', paddingTop: 18 },
  linkText: { color: '#c2410c', fontSize: 13, fontWeight: '600' },
  secondaryLink: { color: '#475569', fontSize: 13 },
  muted: { color: '#64748b' },
  footer: { alignItems: 'center', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
});
