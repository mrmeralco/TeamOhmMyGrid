jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockVerifyOtp = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../config/supabase', () => ({
  isLiveSupabaseConfigured: () => true,
  supabase: {
    auth: {
      verifyOtp: (...args: any[]) => mockVerifyOtp(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingBudgetSetup,
  confirmRegistrationOTP,
  hasPendingBudgetSetup,
  updateUserMonthlyBudget,
} from '../../services/authService';

describe('Post-Signup Budget Setup Onboarding', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('marks newly verified sign-up user as needing budget setup before homepage', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: { access_token: 'tok' },
        user: {
          id: 'user-new-1',
          email: 'newuser@example.com',
          email_confirmed_at: '2026-11-13T00:00:00Z',
          user_metadata: {
            full_name: 'Juan Dela Cruz',
            username: 'juandc',
            can: '1234567890',
          },
        },
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    });

    const profile = await confirmRegistrationOTP('newuser@example.com', '123456');

    expect(profile.id).toBe('user-new-1');
    expect(await hasPendingBudgetSetup(profile.id)).toBe(true);
    expect(await hasPendingBudgetSetup('existing-user-99')).toBe(false);
  });

  it('persists updated monthlyBudget to active session and clears pending budget setup flag', async () => {
    await AsyncStorage.setItem(
      '@kuryentipid_active_session',
      JSON.stringify({
        id: 'user-new-2',
        fullName: 'Maria Santos',
        username: 'mariasantos',
        email: 'maria@example.com',
        can: '1234567891',
        sin: '1234-5678-91',
        householdMembers: 4,
        majorAppliances: [],
        monthlyBudget: 3500,
        isEmailVerified: true,
        createdAt: '2026-11-13T00:00:00Z',
      })
    );
    await AsyncStorage.setItem('@kuryentipid_pending_budget_setup_user-new-2', 'true');

    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValue({ update: mockUpdate });

    await updateUserMonthlyBudget('user-new-2', 5200);
    await clearPendingBudgetSetup('user-new-2');

    expect(await hasPendingBudgetSetup('user-new-2')).toBe(false);
    const rawSession = await AsyncStorage.getItem('@kuryentipid_active_session');
    const session = rawSession ? JSON.parse(rawSession) : null;
    expect(session?.monthlyBudget).toBe(5200);
    expect(mockUpdate).toHaveBeenCalledWith({ monthly_budget: 5200 });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-new-2');
  });
});
