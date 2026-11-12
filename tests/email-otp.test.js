const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const storage = new Map();
const pendingKey = '@kuryentipid_pending_email_verification';
const activeKey = '@kuryentipid_active_session';
let configured = true, response, sent, calls = 0, cancelAllowed = true, sendError = null;
let methods = [{ method: 'password' }];
const normalizedEmail = 'test@example.com';
const setPending = (overrides = {}) => storage.set(pendingKey, JSON.stringify({ email: normalizedEmail, sentAt: Date.now(), kind: 'signup', cancellationToken: 'a'.repeat(64), ...overrides }));
const client = {
  auth: {
    verifyOtp: async args => { calls++; sent = args; return response; },
    resend: async args => { sent = args; return { error: sendError }; },
    signInWithOtp: async args => { sent = args; return { error: sendError }; },
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: { id: '1', email_confirmed_at: '2026-11-12' } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentAuthenticationMethods: methods }, error: null }) },
  },
  rpc: async (name, args) => { sent = { name, ...args }; return { data: cancelAllowed, error: null }; },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({
    data: { full_name: 'Test User', username: 'testuser', can: '1234567890' }, error: null,
  }) }) }) }),
};
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const validation = {};
vm.runInNewContext(compile('src/utils/validation.ts'), { exports: validation });
const api = {};
vm.runInNewContext(compile('src/services/authService.ts'), {
  exports: api, console,
  require: name => {
    if (name.includes('async-storage')) return { __esModule: true, default: {
      getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key),
    } };
    if (name.includes('config/supabase')) return { supabase: client, isLiveSupabaseConfigured: () => configured,
      createPasswordCheckClient: () => ({ auth: { signInWithPassword: async () => ({ data: { user: { email: normalizedEmail, email_confirmed_at: '2026-11-12' } }, error: null }), signOut: async () => ({ error: null }) } }) };
    if (name.includes('validation')) return validation;
    throw new Error(name);
  },
});
(async () => {
  configured = false;
  assert.equal((await api.registerUser({})).success, false);
  assert.equal((await api.loginUser(normalizedEmail, 'Password1')).success, false);
  configured = true;
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'), /cancelled/);
  assert.equal(calls, 0);
  setPending({ sentAt: Date.now() - 180000 });
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'), /expired after 3 minutes/);
  assert.equal(calls, 0);
  setPending();
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '12'), /6-digit/);
  response = { error: new Error('expired'), data: {} };
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'));
  assert.equal(storage.has(activeKey), false);
  response = { error: null, data: { session: {}, user: { id: '1', email: normalizedEmail } } };
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'));
  response.data.user.email_confirmed_at = '2026-11-12';
  const profile = await api.confirmRegistrationOTP(' TEST@example.com ', '123456');
  assert.equal(profile.isEmailVerified, true);
  assert.equal(await api.getPendingEmailVerification(), null);
  assert.equal(JSON.parse(storage.get(activeKey)).isEmailVerified, true);
  assert.equal(await api.getActiveSession(), null);
  methods = [{ method: 'otp' }];
  assert.equal((await api.getActiveSession()).id, '1');
  configured = false;
  assert.equal(await api.getActiveSession(), null);
  configured = true;
  setPending();
  await assert.rejects(api.resendRegistrationOTP(normalizedEmail), /wait 60 seconds/);
  setPending({ sentAt: Date.now() - 181000 });
  await api.resendRegistrationOTP(normalizedEmail);
  assert.equal(sent.type, 'signup');
  assert.ok(Date.now() - (await api.getPendingEmailVerification()).sentAt < 1000);
  assert.equal((await api.getPendingEmailVerification()).cancellationToken, 'a'.repeat(64));
  cancelAllowed = false;
  await assert.rejects(api.cancelPendingEmailVerification(), /Unable to cancel/);
  assert.equal(storage.has(pendingKey), true);
  cancelAllowed = true;
  await api.cancelPendingEmailVerification();
  assert.equal(sent.name, 'cancel_pending_signup');
  assert.equal(storage.has(pendingKey), false);
  assert.equal(storage.has(activeKey), false);
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'), /cancelled/);
  setPending({ cancellationToken: undefined });
  await assert.rejects(api.cancelPendingEmailVerification(), /older signup/);
  // Reset recovery must work without a cancellation RPC or a surviving user.
  storage.set(activeKey, JSON.stringify({ isEmailVerified: true }));
  sent = null;
  await api.forgetPendingEmailVerification();
  assert.equal(sent, null);
  assert.equal(storage.has(pendingKey), false);
  assert.equal(storage.has(activeKey), false);
  await assert.rejects(api.confirmRegistrationOTP(normalizedEmail, '123456'), /cancelled/);
  assert.equal(storage.has(activeKey), false);
  storage.clear();
  const login = await api.loginUser(normalizedEmail, 'Password1');
  assert.equal(login.success, true);
  assert.equal(login.verificationRequired, true);
  assert.equal(login.data, undefined);
  assert.equal(storage.has(activeKey), false);
  assert.equal(sent.options.shouldCreateUser, false);
  assert.equal((await api.getPendingEmailVerification()).kind, 'login');
  setPending({ kind: 'login', sentAt: Date.now() - 181000 });
  await api.resendRegistrationOTP(normalizedEmail);
  assert.equal(sent.options.shouldCreateUser, false);
  await api.confirmRegistrationOTP(normalizedEmail, '123456');
  assert.equal(storage.has(activeKey), true);
  storage.clear(); sendError = new Error('Delivery failed');
  assert.equal((await api.loginUser(normalizedEmail, 'Password1')).success, false);
  assert.equal(storage.has(activeKey), false);
  assert.equal(storage.has(pendingKey), false);
  storage.set(pendingKey, 'invalid json');
  assert.equal(await api.getPendingEmailVerification(), null);
  console.log('OTP expiry, resend, cancellation, legacy protection, and sign-in gating checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
