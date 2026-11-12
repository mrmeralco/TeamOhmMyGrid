import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtractedBillData, SmartPlugDevice, SmartPlugSchedule, CANProfile, MeterType } from '../types';
import { mockSmartPlugService } from '../lib/mockSmartPlugService';
import { smartPlugSimulator, INITIAL_SMART_PLUGS } from '../lib/smartPlugSimulator';
import { calculateMeralcoBill } from '../lib/tariffEngine';
import { MOCK_USER, PRESET_CAN_PROFILES } from '../constants/mockData';
import { useAuth } from './AuthContext';
import { cleanCAN, formatCANDisplay } from '../utils/validation';
import { UserProfile } from '../types/auth';
import { resolveMeterType } from '../services/meralcoApiService';

export interface ChatHistoryItem {
  sender: 'user' | 'tipi';
  text: string;
}

export interface EnergyState {
  budget: number;
  projected: number;
  currentKwh: number;
  activeBill: ExtractedBillData | null;
  chatHistory: ChatHistoryItem[];
  smartPlugs: SmartPlugDevice[];
  totalActiveWatts: number;
  isPlugConnected: boolean;
  isRecordingVoice: boolean;
  voiceSecondsLeft: number;
  canProfiles: CANProfile[];
  activeCanId: string;
  activeCanProfile: CANProfile;
}

export interface EnergyContextValue extends EnergyState {
  setBudget: (budget: number) => void;
  setActiveBill: (bill: ExtractedBillData) => void;
  addChatMessage: (sender: 'user' | 'tipi', text: string) => void;
  fastForwardTelemetry: (days: number) => void;
  injectSpike: (watts: number) => void;
  refreshTelemetry: () => Promise<void>;
  toggleSmartPlug: (id: string) => void;
  setPlugRelay: (id: string, relay: 'ON' | 'OFF') => void;
  setAllPlugsRelay: (relay: 'ON' | 'OFF') => void;
  setPlugTimer: (id: string, seconds: number, action?: 'OFF' | 'ON') => void;
  cancelPlugTimer: (id: string) => void;
  setPlugSchedule: (id: string, schedule: SmartPlugSchedule) => void;
  registerVoiceTrigger: (trigger: (() => void) | null) => void;
  triggerVoicePushToTalk: () => void;
  setVoiceRecordingState: (recording: boolean, secondsLeft?: number) => void;
  switchCanProfile: (id: string) => void;
  renameCanProfile: (id: string, newName: string) => void;
  addCanProfile: (name: string, accountNumber: string, serviceAddress?: string, meterType?: MeterType) => void;
  deleteCanProfile: (id: string) => void;
}

export function createDefaultUserCanProfiles(user: {
  id?: string;
  fullName?: string;
  can?: string;
  monthlyBudget?: number;
  serviceAddress?: string;
  meterType?: MeterType;
  meterSerialNumber?: string;
  lastReadingDate?: string;
}): CANProfile[] {
  const rawCan = user.can || '1234567890';
  const cleanDigits = cleanCAN(rawCan);
  const formattedCan = formatCANDisplay(rawCan);
  const budget = user.monthlyBudget && user.monthlyBudget > 0 ? user.monthlyBudget : 3500;
  const customerName = user.fullName || 'Customer';
  const serviceAddress = user.serviceAddress || 'Meralco Franchise Area, Metro Manila';
  const resolvedMeterType: MeterType = user.meterType || resolveMeterType(rawCan);
  const meterSerialNumber =
    user.meterSerialNumber ||
    (resolvedMeterType === 'AMI' ? `MR-AMI-${cleanDigits.slice(-4)}` : `MR-ANA-${cleanDigits.slice(-4)}`);

  return [
    {
      id: `can-${cleanDigits || user.id || 'primary'}`,
      name: 'Bahay',
      accountNumber: formattedCan,
      customerName,
      serviceAddress,
      ratePerKwh: 11.43,
      budget,
      currentKwh: 188,
      meterType: resolvedMeterType,
      meterSerialNumber,
      lastReadingDate: user.lastReadingDate || '2026-05-14',
      billData: {
        customerAccountNumber: formattedCan,
        billingPeriod: {
          startDate: '2026-04-15',
          endDate: '2026-05-14',
        },
        dueDate: '2026-05-25',
        totalKwh: 188,
        totalAmountDue: Math.round(budget * 0.75 * 100) / 100,
        generationCharge: Math.round(budget * 0.44 * 100) / 100,
        verifiedByUser: true,
      },
    },
  ];
}

const DEFAULT_BILL: ExtractedBillData | null = PRESET_CAN_PROFILES[0].billData || null;

const DEFAULT_STATE: EnergyState = {
  budget: 3500,
  projected: 2840,
  currentKwh: 188,
  activeBill: DEFAULT_BILL,
  chatHistory: [
    {
      sender: 'tipi',
      text: 'Kamusta! Ako si Tipi. Nakikita ko na nasa ₱2,840 ang projected bill mo sa ₱3,500 na budget. 12 kWh na lang bago pumasok sa Tier 2!',
    },
  ],
  smartPlugs: INITIAL_SMART_PLUGS,
  totalActiveWatts: 1053.0,
  isPlugConnected: false,
  isRecordingVoice: false,
  voiceSecondsLeft: 3,
  canProfiles: PRESET_CAN_PROFILES,
  activeCanId: 'can-1',
  activeCanProfile: PRESET_CAN_PROFILES[0],
};

export const EnergyContext = createContext<EnergyContextValue>({
  ...DEFAULT_STATE,
  setBudget: () => {},
  setActiveBill: () => {},
  addChatMessage: () => {},
  fastForwardTelemetry: () => {},
  injectSpike: () => {},
  refreshTelemetry: async () => {},
  toggleSmartPlug: () => {},
  setPlugRelay: () => {},
  setAllPlugsRelay: () => {},
  setPlugTimer: () => {},
  cancelPlugTimer: () => {},
  setPlugSchedule: () => {},
  registerVoiceTrigger: () => {},
  triggerVoicePushToTalk: () => {},
  setVoiceRecordingState: () => {},
  switchCanProfile: () => {},
  renameCanProfile: () => {},
  addCanProfile: () => {},
  deleteCanProfile: () => {},
});

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [canProfiles, setCanProfiles] = useState<CANProfile[]>(() =>
    user ? createDefaultUserCanProfiles(user) : PRESET_CAN_PROFILES
  );
  const [activeCanId, setActiveCanId] = useState<string>(() =>
    user ? `can-${cleanCAN(user.can) || user.id || 'primary'}` : 'can-1'
  );

  const [budget, setBudgetState] = useState<number>(user?.monthlyBudget || DEFAULT_STATE.budget);
  const [currentKwh, setCurrentKwh] = useState<number>(DEFAULT_STATE.currentKwh);
  const [projected, setProjected] = useState<number>(DEFAULT_STATE.projected);
  const [activeBill, setActiveBillState] = useState<ExtractedBillData | null>(DEFAULT_STATE.activeBill);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(DEFAULT_STATE.chatHistory);

  // Smart Plug Simulator State
  const [smartPlugs, setSmartPlugs] = useState<SmartPlugDevice[]>(INITIAL_SMART_PLUGS);
  const [totalActiveWatts, setTotalActiveWatts] = useState<number>(smartPlugSimulator.getTotalActiveWatts());
  const [isPlugConnected, setIsPlugConnected] = useState<boolean>(false);

  // Push-to-Talk Voice State
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceSecondsLeft, setVoiceSecondsLeft] = useState<number>(3);
  const voiceTriggerRef = useRef<(() => void) | null>(null);

  const activeCanProfile =
    canProfiles.find((p) => p.id === activeCanId) ||
    canProfiles[0] ||
    (user ? createDefaultUserCanProfiles(user)[0] : PRESET_CAN_PROFILES[0]);

  const getStorageKeys = (userId?: string | null) => {
    const suffix = userId ? `_${userId}` : '_guest';
    return {
      profilesKey: `@kuryentipid_can_profiles${suffix}`,
      activeCanKey: `@kuryentipid_active_can_id${suffix}`,
      budgetKey: `@kuryentipid_budget${suffix}`,
      billKey: `@kuryentipid_active_bill${suffix}`,
    };
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (user) {
          const { profilesKey, activeCanKey } = getStorageKeys(user.id);
          let loadedProfiles: CANProfile[] = [];
          const savedCanProfiles = await AsyncStorage.getItem(profilesKey);
          if (savedCanProfiles) {
            try {
              const parsed = JSON.parse(savedCanProfiles);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Ensure it's not the old Maria Santos mock data leaked into user storage
                const isOldMock = parsed.every(
                  (p) =>
                    p.customerName === 'Maria Santos' ||
                    p.customerName === 'Santos Sari-Sari Store' ||
                    p.customerName === 'Maria Santos (Condo)'
                );
                if (!isOldMock) {
                  loadedProfiles = parsed.map((p: any) => ({
                    ...p,
                    meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
                    meterSerialNumber:
                      p.meterSerialNumber ||
                      ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
                        cleanCAN(p.accountNumber || p.id).slice(-4),
                  }));
                }
              }
            } catch {
              // fallback
            }
          }

          if (loadedProfiles.length === 0) {
            loadedProfiles = createDefaultUserCanProfiles(user);
            await AsyncStorage.setItem(profilesKey, JSON.stringify(loadedProfiles));
          }

          const savedActiveCanId = await AsyncStorage.getItem(activeCanKey);
          const resolvedCanId =
            savedActiveCanId && loadedProfiles.some((p) => p.id === savedActiveCanId)
              ? savedActiveCanId
              : loadedProfiles[0].id;

          if (!isMounted) return;
          setCanProfiles(loadedProfiles);
          setActiveCanId(resolvedCanId);

          const currentProfile =
            loadedProfiles.find((p) => p.id === resolvedCanId) || loadedProfiles[0];

          setBudgetState(currentProfile.budget);
          setActiveBillState(currentProfile.billData || null);
          setCurrentKwh(currentProfile.currentKwh);
          const initialBill = calculateMeralcoBill(currentProfile.currentKwh);
          setProjected(initialBill.totalAmountDue);
        } else {
          // Unauthenticated / demo guest
          const { profilesKey, activeCanKey } = getStorageKeys(null);
          let loadedProfiles = PRESET_CAN_PROFILES;
          const savedCanProfiles = await AsyncStorage.getItem(profilesKey);
          if (savedCanProfiles) {
            try {
              const parsed = JSON.parse(savedCanProfiles);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedProfiles = parsed.map((p: any) => ({
                  ...p,
                  meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
                  meterSerialNumber:
                    p.meterSerialNumber ||
                    ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
                      cleanCAN(p.accountNumber || p.id).slice(-4),
                }));
              }
            } catch {}
          }
          const savedActiveCanId = await AsyncStorage.getItem(activeCanKey);
          const resolvedCanId =
            savedActiveCanId && loadedProfiles.some((p) => p.id === savedActiveCanId)
              ? savedActiveCanId
              : 'can-1';

          if (!isMounted) return;
          setCanProfiles(loadedProfiles);
          setActiveCanId(resolvedCanId);
          const currentProfile =
            loadedProfiles.find((p) => p.id === resolvedCanId) || loadedProfiles[0];
          setBudgetState(currentProfile.budget);
          setActiveBillState(currentProfile.billData || null);
          setCurrentKwh(currentProfile.currentKwh);
          const initialBill = calculateMeralcoBill(currentProfile.currentKwh);
          setProjected(initialBill.totalAmountDue);
        }
      } catch {
        // ignore load error
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.can, user?.fullName, user?.monthlyBudget]);

  // Subscribe to Smart Plug IoT Simulator changes
  useEffect(() => {
    const unsubscribe = smartPlugSimulator.subscribe((plugs) => {
      setSmartPlugs([...plugs]);
      setTotalActiveWatts(smartPlugSimulator.getTotalActiveWatts());
      setIsPlugConnected(smartPlugSimulator.isConnected());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const recalculateBill = useCallback((kwh: number) => {
    const bill = calculateMeralcoBill(kwh);
    setProjected(bill.totalAmountDue);
  }, []);

  const setBudget = (newBudget: number) => {
    setBudgetState(newBudget);
    const { budgetKey, profilesKey } = getStorageKeys(user?.id);
    AsyncStorage.setItem(budgetKey, newBudget.toString()).catch(() => {});
    setCanProfiles((prev) => {
      const updated = prev.map((p) => (p.id === activeCanId ? { ...p, budget: newBudget } : p));
      AsyncStorage.setItem(profilesKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const setActiveBill = (bill: ExtractedBillData) => {
    setActiveBillState(bill);
    setCurrentKwh(bill.totalKwh);
    recalculateBill(bill.totalKwh);
    const { billKey, profilesKey } = getStorageKeys(user?.id);
    AsyncStorage.setItem(billKey, JSON.stringify(bill)).catch(() => {});
    setCanProfiles((prev) => {
      const updated = prev.map((p) =>
        p.id === activeCanId ? { ...p, billData: bill, currentKwh: bill.totalKwh } : p
      );
      AsyncStorage.setItem(profilesKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const switchCanProfile = (id: string) => {
    const target = canProfiles.find((p) => p.id === id);
    if (!target) return;
    setActiveCanId(id);
    const { activeCanKey, billKey, budgetKey } = getStorageKeys(user?.id);
    AsyncStorage.setItem(activeCanKey, id).catch(() => {});

    setActiveBillState(target.billData || null);
    AsyncStorage.setItem(billKey, JSON.stringify(target.billData)).catch(() => {});

    setBudgetState(target.budget);
    AsyncStorage.setItem(budgetKey, target.budget.toString()).catch(() => {});

    setCurrentKwh(target.currentKwh);
    recalculateBill(target.currentKwh);
  };

  const renameCanProfile = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const { profilesKey } = getStorageKeys(user?.id);
    setCanProfiles((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p));
      AsyncStorage.setItem(profilesKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const addCanProfile = (
    name: string,
    accountNumber: string,
    serviceAddress?: string,
    meterType?: MeterType
  ) => {
    const clean = cleanCAN(accountNumber);
    if (!clean || clean.length !== 10) return;
    const formatted = formatCANDisplay(clean);
    const resolvedMeterType: MeterType = meterType || resolveMeterType(clean);
    const newProfile: CANProfile = {
      id: `can-${clean}-${Date.now()}`,
      name: name.trim() || `CAN ${formatted}`,
      accountNumber: formatted,
      customerName: user?.fullName || 'Customer',
      serviceAddress: serviceAddress?.trim() || 'Meralco Franchise Area, Metro Manila',
      ratePerKwh: 11.43,
      budget: budget || 3500,
      currentKwh: 150,
      meterType: resolvedMeterType,
      meterSerialNumber:
        (resolvedMeterType === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') + clean.slice(-4),
      lastReadingDate: '2026-05-14',
      billData: {
        customerAccountNumber: formatted,
        billingPeriod: {
          startDate: '2026-04-15',
          endDate: '2026-05-14',
        },
        dueDate: '2026-05-25',
        totalKwh: 150,
        totalAmountDue: Math.round((budget || 3500) * 0.7 * 100) / 100,
        generationCharge: Math.round((budget || 3500) * 0.4 * 100) / 100,
        verifiedByUser: true,
      },
    };
    const { profilesKey } = getStorageKeys(user?.id);
    setCanProfiles((prev) => {
      const updated = [...prev, newProfile];
      AsyncStorage.setItem(profilesKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const deleteCanProfile = (id: string) => {
    if (canProfiles.length <= 1) return;
    const { profilesKey, activeCanKey } = getStorageKeys(user?.id);
    setCanProfiles((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      AsyncStorage.setItem(profilesKey, JSON.stringify(updated)).catch(() => {});
      if (activeCanId === id && updated.length > 0) {
        const nextActive = updated[0];
        setActiveCanId(nextActive.id);
        AsyncStorage.setItem(activeCanKey, nextActive.id).catch(() => {});
        setBudgetState(nextActive.budget);
        setActiveBillState(nextActive.billData || null);
        setCurrentKwh(nextActive.currentKwh);
        recalculateBill(nextActive.currentKwh);
      }
      return updated;
    });
  };

  const addChatMessage = (sender: 'user' | 'tipi', text: string) => {
    setChatHistory((prev) => [...prev, { sender, text }]);
  };

  const toggleSmartPlug = (id: string) => {
    smartPlugSimulator.togglePlugRelay(id);
  };

  const setPlugRelay = (id: string, relay: 'ON' | 'OFF') => {
    smartPlugSimulator.setPlugRelay(id, relay);
  };

  const setAllPlugsRelay = (relay: 'ON' | 'OFF') => {
    smartPlugSimulator.setAllPlugsRelay(relay);
  };

  const setPlugTimer = (id: string, seconds: number, action: 'OFF' | 'ON' = 'OFF') => {
    smartPlugSimulator.setPlugTimer(id, seconds, action);
  };

  const cancelPlugTimer = (id: string) => {
    smartPlugSimulator.cancelPlugTimer(id);
  };

  const setPlugSchedule = (id: string, schedule: SmartPlugSchedule) => {
    smartPlugSimulator.setPlugSchedule(id, schedule);
  };

  const fastForwardTelemetry = (days: number) => {
    mockSmartPlugService.fastForwardDays(days);
    setCurrentKwh((prev) => {
      const next = prev + days * 8;
      recalculateBill(next);
      return next;
    });
  };

  const injectSpike = (watts: number) => {
    mockSmartPlugService.injectSpikeLoad(watts);
    setCurrentKwh((prev) => {
      const next = prev + 15;
      recalculateBill(next);
      return next;
    });
  };

  const refreshTelemetry = async () => {
    const readings = await mockSmartPlugService.getLatestReadings();
    const intervalSum = readings.reduce((sum, r) => sum + r.intervalKwh, 0);
    setCurrentKwh((prev) => {
      const next = Number((prev + intervalSum).toFixed(2));
      recalculateBill(next);
      return next;
    });
  };

  // Push-to-Talk voice registry
  const registerVoiceTrigger = useCallback((trigger: (() => void) | null) => {
    voiceTriggerRef.current = trigger;
  }, []);

  const triggerVoicePushToTalk = useCallback(() => {
    if (voiceTriggerRef.current) {
      voiceTriggerRef.current();
    }
  }, []);

  const setVoiceRecordingState = useCallback((recording: boolean, secondsLeft: number = 3) => {
    setIsRecordingVoice(recording);
    setVoiceSecondsLeft(secondsLeft);
  }, []);

  return (
    <EnergyContext.Provider
      value={{
        budget,
        projected,
        currentKwh,
        activeBill,
        chatHistory,
        smartPlugs,
        totalActiveWatts,
        isPlugConnected,
        isRecordingVoice,
        voiceSecondsLeft,
        canProfiles,
        activeCanId,
        activeCanProfile,
        setBudget,
        setActiveBill,
        addChatMessage,
        fastForwardTelemetry,
        injectSpike,
        refreshTelemetry,
        toggleSmartPlug,
        setPlugRelay,
        setAllPlugsRelay,
        setPlugTimer,
        cancelPlugTimer,
        setPlugSchedule,
        registerVoiceTrigger,
        triggerVoicePushToTalk,
        setVoiceRecordingState,
        switchCanProfile,
        renameCanProfile,
        addCanProfile,
        deleteCanProfile,
      }}
    >
      {children}
    </EnergyContext.Provider>
  );
};

export const useEnergy = () => useContext(EnergyContext);
