import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cancelPendingEmailVerification, confirmRegistrationOTP, EMAIL_CODE_LIFETIME_MS, getPendingEmailVerification, resendRegistrationOTP } from '../services/authService';

export function LoginEmailVerification({ email, onVerified, onCancel }: { email: string; onVerified: () => Promise<void>; onCancel: () => void }) {
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getPendingEmailVerification().then(pending => { if (active && pending?.email === email) setSentAt(pending.sentAt); }).catch(() => setError('Unable to load verification. Please log in again.'));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [email]);
  const seconds = Math.max(0, Math.ceil((sentAt + EMAIL_CODE_LIFETIME_MS - now) / 1000));
  const cooldown = Math.max(0, Math.ceil((sentAt + 60000 - now) / 1000));
  const verify = async () => {
    if (busy || !seconds || code.length !== 6) return;
    setBusy(true); setError('');
    try { await confirmRegistrationOTP(email, code); await onVerified(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification failed.'); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    if (busy || cooldown || !sentAt) return;
    setBusy(true); setError('');
    try {
      await resendRegistrationOTP(email);
      const pending = await getPendingEmailVerification();
      setSentAt(pending?.sentAt || 0); setNow(Date.now()); setCode('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send code.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Verify your sign-in</Text>
    <Text style={styles.text}>Enter the code sent to {email}.</Text>
    <Text style={styles.text}>{seconds ? `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Code expired. Request a new code to continue.'}</Text>
    <TextInput accessibilityLabel="Email verification code" style={styles.input} value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))} maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy && seconds > 0} onSubmitEditing={verify} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <TouchableOpacity disabled={busy || !seconds || code.length !== 6} onPress={verify} style={[styles.button, (busy || !seconds || code.length !== 6) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify sign-in</Text>}</TouchableOpacity>
    <TouchableOpacity disabled={busy || !!cooldown || !sentAt} onPress={resend}><Text style={styles.link}>{cooldown ? `Resend code in ${cooldown}s` : 'Send a new code'}</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} onPress={async () => { setBusy(true); try { await cancelPendingEmailVerification(); onCancel(); } catch { setError('Unable to cancel. Try again.'); } finally { setBusy(false); } }}><Text style={styles.link}>Back to login</Text></TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 28, width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 28 },
  title: { fontSize: 25, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  text: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 22, marginVertical: 12 },
  button: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' }, disabled: { backgroundColor: '#cbd5e1' },
  link: { color: '#c2410c', textAlign: 'center', padding: 14 }, error: { color: '#b91c1c', marginBottom: 12 },
});
