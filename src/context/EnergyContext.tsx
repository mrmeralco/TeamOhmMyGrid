import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtractedBillData, SmartPlugDevice, SmartPlugSchedule, CANProfile } from '../types';
import { mockSmartPlugService } from '../lib/mockSmartPlugService';
import { smartPlugSimulator, INITIAL_SMART_PLUGS } from '../lib/smartPlugSimulator';
import { calculateMeralcoBill } from '../lib/tariffEngine';
import { MOCK_USER, PRESET_CAN_PROFILES } from '../constants/mockData';

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
}

const BUDGET_STORAGE_KEY = '@kuryentipid_budget';
const BILL_STORAGE_KEY = '@kuryentipid_active_bill';
const CAN_PROFILES_STORAGE_KEY = '@kuryentipid_can_profiles';
const ACTIVE_CAN_STORAGE_KEY = '@kuryentipid_active_can_id';

const DEFAULT_BILL: ExtractedBillData = PRESET_CAN_PROFILES[0].billData;

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
});

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [canProfiles, setCanProfiles] = useState<CANProfile[]>(PRESET_CAN_PROFILES);
  const [activeCanId, setActiveCanId] = useState<string>('can-1');

  const [budget, setBudgetState] = useState<number>(DEFAULT_STATE.budget);
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
    canProfiles.find((p) => p.id === activeCanId) || canProfiles[0] || PRESET_CAN_PROFILES[0];

  useEffect(() => {
    (async () => {
      try {
        let loadedProfiles = PRESET_CAN_PROFILES;
        const savedCanProfiles = await AsyncStorage.getItem(CAN_PROFILES_STORAGE_KEY);
        if (savedCanProfiles) {
          try {
            const parsed = JSON.parse(savedCanProfiles);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedProfiles = parsed;
              setCanProfiles(parsed);
            }
          } catch {
            // fallback
          }
        }

        const savedActiveCanId = await AsyncStorage.getItem(ACTIVE_CAN_STORAGE_KEY);
        const resolvedCanId =
          savedActiveCanId && loadedProfiles.some((p) => p.id === savedActiveCanId)
            ? savedActiveCanId
            : 'can-1';
        setActiveCanId(resolvedCanId);

        const currentProfile =
          loadedProfiles.find((p) => p.id === resolvedCanId) || loadedProfiles[0];

        // Authoritative source of truth is the active CAN profile in loadedProfiles
        setBudgetState(currentProfile.budget);
        setActiveBillState(currentProfile.billData);
        setCurrentKwh(currentProfile.currentKwh);
        const initialBill = calculateMeralcoBill(currentProfile.currentKwh);
        setProjected(initialBill.totalAmountDue);
      } catch {
        // ignore load error
      }
    })();
  }, []);

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
    AsyncStorage.setItem(BUDGET_STORAGE_KEY, newBudget.toString()).catch(() => {});
    setCanProfiles((prev) => {
      const updated = prev.map((p) => (p.id === activeCanId ? { ...p, budget: newBudget } : p));
      AsyncStorage.setItem(CAN_PROFILES_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const setActiveBill = (bill: ExtractedBillData) => {
    setActiveBillState(bill);
    setCurrentKwh(bill.totalKwh);
    recalculateBill(bill.totalKwh);
    AsyncStorage.setItem(BILL_STORAGE_KEY, JSON.stringify(bill)).catch(() => {});
    setCanProfiles((prev) => {
      const updated = prev.map((p) =>
        p.id === activeCanId ? { ...p, billData: bill, currentKwh: bill.totalKwh } : p
      );
      AsyncStorage.setItem(CAN_PROFILES_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const switchCanProfile = (id: string) => {
    const target = canProfiles.find((p) => p.id === id);
    if (!target) return;
    setActiveCanId(id);
    AsyncStorage.setItem(ACTIVE_CAN_STORAGE_KEY, id).catch(() => {});

    setActiveBillState(target.billData);
    AsyncStorage.setItem(BILL_STORAGE_KEY, JSON.stringify(target.billData)).catch(() => {});

    setBudgetState(target.budget);
    AsyncStorage.setItem(BUDGET_STORAGE_KEY, target.budget.toString()).catch(() => {});

    setCurrentKwh(target.currentKwh);
    recalculateBill(target.currentKwh);
  };

  const renameCanProfile = (id: string, newName: string) => {
    if (!newName.trim()) return;
    setCanProfiles((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p));
      AsyncStorage.setItem(CAN_PROFILES_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
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
      }}
    >
      {children}
    </EnergyContext.Provider>
  );
};

export const useEnergy = () => useContext(EnergyContext);
