import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor,
  runOnJS,
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
const TIPI_MASCOT = require('../../../assets/tipi-mascot.png');
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { usePushToTalk } from '../../hooks/usePushToTalk';
import { processTextQuery, processVoiceQuery } from '../../lib/geminiService';
import {
  speakResponse,
  unlockSpeechSynthesis,
  togglePauseSpeaking,
  stopSpeaking,
  subscribeTtsState,
  TtsPlaybackState,
} from '../../lib/audioService';
import { PageTransitionView } from '../../components/PageTransitionView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animation & interaction phases
type MicPhase =
  | 'idle'         // default: normal size, brand color
  | 'recording'    // enlarged, steady orange-red glow (no pulsing)
  | 'pouring'      // ring shrinks, orange-red shape flows from input box into chat
  | 'thinking';    // fluid wash dissolves into chat bubble while AI thinks

// Vibrant orange-red palette
const ORANGE_RED_GLOW = '#FF3B1D';
const ORANGE_RED_FILL = '#FF4D26';

// ─────────────────────────────────────────────────────────────
//  Animated Mic Button (Enlarges steadily on hold, shrinks on release - NO pulsing)
// ─────────────────────────────────────────────────────────────
function AnimatedMicButton({
  phase,
  onPressIn,
  onPressOut,
  secondsLeft,
  theme,
  fontScale,
}: {
  phase: MicPhase;
  onPressIn: () => void;
  onPressOut: () => void;
  secondsLeft: number;
  theme: any;
  fontScale: number;
}) {
  const isRecording = phase === 'recording';

  const btnScale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    if (phase === 'recording') {
      // Enlarge steadily without pulsing or oscillating
      btnScale.value = withSpring(1.32, { damping: 14, stiffness: 200 });
      ringScale.value = withSpring(1.68, { damping: 14, stiffness: 200 });
      ringOpacity.value = withTiming(0.45, { duration: 200 });
      colorProgress.value = withTiming(1, { duration: 200 });
    } else {
      // Immediately shrink back to small resting size on release
      btnScale.value = withSpring(1, { damping: 15, stiffness: 220 });
      ringScale.value = withTiming(1, { duration: 180 });
      ringOpacity.value = withTiming(0, { duration: 180 });
      colorProgress.value = withTiming(0, { duration: 200 });
    }
  }, [phase, btnScale, colorProgress, ringOpacity, ringScale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [`${theme.brand}30`, `${ORANGE_RED_GLOW}55`]
    ),
  }));

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [theme.brand, ORANGE_RED_GLOW]
    ),
  }));

  return (
    <View style={styles.micWrapper}>
      {/* Steady glow ring (non-pulsing) */}
      <Animated.View style={[styles.micRing, ringStyle]} pointerEvents="none" />

      {/* Push-to-talk pressable mic */}
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Push to talk kay Tipi"
      >
        <Animated.View style={[styles.capsuleMicBtn, btnStyle]}>
          {isRecording ? (
            <Text style={[styles.micTimerText, { color: '#ffffff', fontSize: 13 * fontScale }]}>
              {secondsLeft}s
            </Text>
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Rect
                x="9"
                y="3"
                width="6"
                height="11"
                rx="3"
                stroke="#ffffff"
                strokeWidth="2.2"
              />
              <Path
                d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <Path
                d="M12 17V21M8 21H16"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </Svg>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Morphing Fluid Shape
//  Starts as a circular droplet right at the mic button (bottom: 92, right: 16),
//  smoothly stretches, pulls, and morphs into the chat box shape with ease-out.
//  DOES NOT FADE OUT: travels and fits directly and seamlessly into place!
// ─────────────────────────────────────────────────────────────
function MorphingFluidShape({
  active,
  targetDistance,
  targetWidth: measuredTargetWidth,
  targetHeight: measuredTargetHeight,
  spokenText,
  fontScale,
  onDone,
}: {
  active: boolean;
  targetDistance: number;
  targetWidth?: number;
  targetHeight?: number;
  spokenText?: string;
  fontScale: number;
  onDone: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withTiming(
        1,
        {
          duration: 1080, // .4s faster for snappy yet fluid stretch and pull
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(onDone)();
          }
        }
      );
    } else {
      progress.value = 0;
    }
  }, [active, onDone, progress]);

  // Use the exact measured dimensions of the bubble if available, or fall back to estimate
  const resolvedTargetWidth =
    measuredTargetWidth && measuredTargetWidth > 50
      ? measuredTargetWidth
      : Math.min(SCREEN_WIDTH * 0.82, Math.max(180, (spokenText?.length || 32) * 8.2 + 36));
  const resolvedTargetHeight =
    measuredTargetHeight && measuredTargetHeight > 30 ? measuredTargetHeight : 48;
  const initialCircleSize = 44;

  const animatedContainerStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // ── Dynamic Stretch & Pull Physics ──
    // Phase 1 (p: 0 -> 0.28): Elastic stretch/pull upward.
    // The circle elongates vertically (scaleY up to 1.35) and pinches horizontally (scaleX down to 0.78).
    // Phase 2 (p: 0.28 -> 0.72): The stretch recoils and energy transfers laterally,
    // blooming outward as the width expands into the speech bubble.
    // Phase 3 (p: 0.72 -> 1.0): Scales settle cleanly back to 1.0 as it eases into docking.
    let stretchY = 1;
    let stretchX = 1;

    if (p < 0.28) {
      const pullT = p / 0.28;
      const curve = Math.sin(pullT * (Math.PI / 2));
      stretchY = 1 + 0.35 * curve;
      stretchX = 1 - 0.22 * curve;
    } else if (p < 0.72) {
      const releaseT = (p - 0.28) / 0.44;
      const curve = Math.sin(releaseT * (Math.PI / 2));
      stretchY = 1.35 - 0.35 * curve;
      stretchX = 0.78 + 0.22 * curve;
    } else {
      stretchY = 1;
      stretchX = 1;
    }

    // Width expands with an S-curve, staying pulled and compact early on, then expanding broadly
    const widthProgress = p < 0.22 ? 0 : Math.min(1, (p - 0.22) / 0.58);
    const widthT = widthProgress * widthProgress * (3 - 2 * widthProgress);
    const width = initialCircleSize + (resolvedTargetWidth - initialCircleSize) * widthT;
    const height = initialCircleSize + (resolvedTargetHeight - initialCircleSize) * widthT;

    // Morph corner radiuses:
    // Starts as perfect circle (22px all corners)
    // Morphs into chat bubble: top-left: 16, top-right: 16, bottom-left: 16, bottom-right: 4 (talk tail!)
    const radiusProgress = p < 0.28 ? 0 : Math.min(1, (p - 0.28) / 0.54);
    const topLeftRadius = 22 - 6 * radiusProgress;
    const topRightRadius = 22 - 6 * radiusProgress;
    const bottomLeftRadius = 22 - 6 * radiusProgress;
    const bottomRightRadius = 22 - 18 * radiusProgress;

    // Lifts vertically by the exact target distance to meet the chat bubble
    const translateY = -targetDistance * p;

    // Solid opacity throughout - DOES NOT FADE OUT: stretches directly into place
    return {
      width,
      height,
      borderTopLeftRadius: topLeftRadius,
      borderTopRightRadius: topRightRadius,
      borderBottomLeftRadius: bottomLeftRadius,
      borderBottomRightRadius: bottomRightRadius,
      transform: [
        { translateY },
        { scaleY: stretchY },
        { scaleX: stretchX },
      ],
      opacity: 1,
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Spoken text reveals smoothly as the stretch unfolds into the broad chat bubble
    const textOpacity = p < 0.32 ? 0 : Math.min(1, (p - 0.32) / 0.35);
    return {
      opacity: textOpacity,
    };
  });

  if (!active) return null;

  return (
    <Animated.View
      style={[styles.morphingFluidShape, animatedContainerStyle]}
      pointerEvents="none"
    >
      {spokenText ? (
        <Animated.View style={[styles.morphingTextWrapper, animatedTextStyle]}>
          <Text
            numberOfLines={2}
            style={[
              styles.morphingText,
              { fontSize: 14 * fontScale },
            ]}
          >
            {spokenText}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
//  User Chat Bubble with Fading Orange-Red Fluid Wash
// ─────────────────────────────────────────────────────────────
function UserMessageBubble({
  text,
  isLatestVoice,
  pourActive,
  theme,
  fontScale,
  onBubbleLayout,
}: {
  text: string;
  isLatestVoice: boolean;
  pourActive: boolean;
  theme: any;
  fontScale: number;
  onBubbleLayout?: (layout: { width: number; height: number; y: number }) => void;
}) {
  const tintOpacity = useSharedValue(isLatestVoice ? 1 : 0);

  useEffect(() => {
    if (isLatestVoice && !pourActive) {
      // The morphing shape has landed! Start dissolving the orange-red fluid wash into theme.brand over 1.4s
      tintOpacity.value = 1;
      tintOpacity.value = withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) });
    }
  }, [isLatestVoice, pourActive, tintOpacity]);

  const tintStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    backgroundColor: ORANGE_RED_FILL,
    opacity: tintOpacity.value,
  }));

  // While pourActive is true, hide this bubble so only the morphing shape is visible stretching and flying
  const isHiddenDuringPour = isLatestVoice && pourActive;

  return (
    <View
      onLayout={(e) => {
        if (isLatestVoice && onBubbleLayout) {
          const { width, height, y } = e.nativeEvent.layout;
          onBubbleLayout({ width, height, y });
        }
      }}
      style={[
        styles.bubble,
        styles.userBubble,
        {
          backgroundColor: theme.brand,
          overflow: 'hidden',
          opacity: isHiddenDuringPour ? 0 : 1,
        },
      ]}
    >
      {/* Orange-red fluid wash that slowly fades into the background */}
      <Animated.View style={tintStyle} pointerEvents="none" />
      <Text
        style={[
          styles.bubbleText,
          { color: theme.brandInk, fontSize: 14 * fontScale },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN: Tanong kay Tipi
// ─────────────────────────────────────────────────────────────
export default function TanongScreen() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const {
    currentKwh,
    budget,
    projected,
    chatHistory,
    addChatMessage,
    registerVoiceTrigger,
    setVoiceRecordingState,
    activeCanProfile,
    pendingTipiPrompt,
    clearPendingTipiPrompt,
  } = useEnergy();

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [ttsState, setTtsState] = useState<TtsPlaybackState>('idle');
  const [activeTtsText, setActiveTtsText] = useState<string | null>(null);
  const [micPhase, setMicPhase] = useState<MicPhase>('idle');
  const [pourActive, setPourActive] = useState(false);
  const [pourTargetDistance, setPourTargetDistance] = useState<number>(120);
  const [pourTargetWidth, setPourTargetWidth] = useState<number>(0);
  const [pourTargetHeight, setPourTargetHeight] = useState<number>(0);
  const [pourSpeechText, setPourSpeechText] = useState('');
  const [latestVoiceIndex, setLatestVoiceIndex] = useState<number | null>(null);

  const capturedAudioRef = useRef<string | null>(null);

  const handleBubbleLayout = useCallback((layout: { width: number; height: number; y: number }) => {
    if (layout.width > 0 && layout.height > 0) {
      setPourTargetWidth(layout.width);
      setPourTargetHeight(layout.height);
    }
  }, []);

  const scrollViewRef = useRef<any>(null);
  const scrollViewHeightRef = useRef<number>(520);
  const contentHeightRef = useRef<number>(110);

  const { isRecording, getLatestTranscript, startRecording, stopRecording } =
    usePushToTalk();
  // secondsLeft removed — hook no longer has an auto-countdown timer (true PTT: hold = record, release = stop)

  // ── Calculate dynamic distance from mic button to where the chat message lands ──
  const calculateTargetDistance = useCallback(() => {
    const viewportH = scrollViewHeightRef.current || 520;
    const contentH = contentHeightRef.current || 110;
    const userChatsCount = chatHistory.filter((m) => m.sender === 'user').length;
    const isInitialEmpty = userChatsCount === 0;

    // Offset from capsule bottom (bottom: 92) to ScrollView bottom:
    const capsuleToScrollBottom = 60;

    if (isInitialEmpty) {
      const messageBottomFromTop =
        chatHistory.length === 0 ? 64 : Math.max(184, contentH + 54);
      const distance = capsuleToScrollBottom + (viewportH - messageBottomFromTop);
      return Math.max(70, distance);
    } else {
      if (contentH + 80 >= viewportH) {
        return capsuleToScrollBottom + 16;
      } else {
        const messageBottomFromTop = contentH + 50;
        const distance = capsuleToScrollBottom + (viewportH - messageBottomFromTop);
        return Math.max(capsuleToScrollBottom + 16, Math.min(280, distance));
      }
    }
  }, [chatHistory]);

  // ── Push-To-Talk: Held (Press In) ──
  // True PTT: just start recording; do NOT auto-stop.
  // The user holds the button; release (onPressOut) triggers stopRecording + sends to Gemini.
  const handlePressIn = useCallback(async () => {
    if (loading) return;

    unlockSpeechSynthesis();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setMicPhase('recording');
    capturedAudioRef.current = null;

    // startRecording now just starts; no callback, no auto-stop.
    // Live transcript updates the input box so the user sees what they're saying.
    await startRecording((liveTranscript) => {
      setInputQuery(liveTranscript);
    });
  }, [loading, startRecording]);

  // ── Push-To-Talk: Released (Press Out) ──
  // True PTT: user releases button → stopRecording() returns captured audio + final transcript.
  const handlePressOut = useCallback(async () => {
    if (micPhase !== 'recording') return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    // stopRecording stops the recorder + speech recognition and returns the data
    const { base64: capturedAudioBase64, transcript: recognizedText } = await stopRecording();
    capturedAudioRef.current = null;

    const displayMessage = recognizedText.trim() || inputQuery.trim() || 'Voice message';

    if (!capturedAudioBase64 && !displayMessage) {
      setMicPhase('idle');
      setInputQuery('');
      return;
    }

    setPourSpeechText(displayMessage);

    // Calculate exact travel distance based on current chat occupancy
    const dynamicDistance = calculateTargetDistance();
    setPourTargetDistance(dynamicDistance);

    // Clear input box so the shape and text smoothly lift/flow into the chat
    setInputQuery('');
    setMicPhase('pouring');
    setPourActive(true);

    const priorHistory = [...chatHistory];

    // Commit user message to chat history
    addChatMessage('user', displayMessage);
    setLatestVoiceIndex(chatHistory.length);

    const userChatsCount = chatHistory.filter((m) => m.sender === 'user').length;
    if (userChatsCount > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }

    const queryContext = {
      totalKwh: currentKwh,
      budget,
      projected,
      meterType: activeCanProfile?.meterType,
      can: activeCanProfile?.accountNumber,
      profileName: activeCanProfile?.name,
      language,
    };

    // Start Gemini API query in background with multi-turn conversation history
    const queryPromise = capturedAudioBase64
      ? processVoiceQuery(
          capturedAudioBase64,
          queryContext,
          priorHistory,
          recognizedText || undefined
        )
      : processTextQuery(recognizedText, queryContext, priorHistory);

    // AI thinking & vocalized response
    try {
      // 1. Wait until user's message is successfully docked in the chat (1080ms morph duration)
      await new Promise((resolve) => setTimeout(resolve, 1080));

      // 2. NOW pop up the AI thinking message after the message is successfully in the chat
      setLoading(true);
      setMicPhase('thinking');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);

      // 3. Keep the thinking message visible for a significant 1-second delay
      const thinkingDelay = new Promise((resolve) => setTimeout(resolve, 1000));
      const [response] = await Promise.all([queryPromise, thinkingDelay]);

      addChatMessage('tipi', response);
      setIsTalking(true);
      await speakResponse(response);
      setTimeout(() => setIsTalking(false), 4000);
    } catch {
      addChatMessage('tipi', 'Paumanhin, nagkaroon ng aberya sa pagsusuri ng iyong tanong.');
    } finally {
      setLoading(false);
      setMicPhase('idle');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [
    micPhase,
    inputQuery,
    calculateTargetDistance,
    stopRecording,
    addChatMessage,
    chatHistory,
    currentKwh,
    budget,
    projected,
    activeCanProfile,
    language,
  ]);

  const handlePourDone = useCallback(() => {
    setPourActive(false);
  }, []);

  // ── Standard Text Send & AI Handoff ──
  const handleSendText = useCallback(
    async (textToSend?: string) => {
      const query = (textToSend || inputQuery).trim();
      if (!query || loading) return;

      unlockSpeechSynthesis();
      const priorHistory = [...chatHistory];
      setInputQuery('');
      setLatestVoiceIndex(null);
      addChatMessage('user', query);

      // Briefly let the user message mount in the chat before popping up the thinking spinner
      setTimeout(() => {
        setLoading(true);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);

      try {
        // 1.0s significant thinking delay after prompt
        const minThinkingDelay = new Promise((resolve) => setTimeout(resolve, 1000));
        const [response] = await Promise.all([
          processTextQuery(
            query,
            {
              totalKwh: currentKwh,
              budget,
              projected,
              meterType: activeCanProfile?.meterType,
              can: activeCanProfile?.accountNumber,
              profileName: activeCanProfile?.name,
              language,
            },
            priorHistory
          ),
          minThinkingDelay,
        ]);
        addChatMessage('tipi', response);
        setIsTalking(true);
        await speakResponse(response);
        setTimeout(() => setIsTalking(false), 4000);
      } catch {
        addChatMessage('tipi', 'Pasensya na, nagkaroon ng aberya. Pakisubukan muli.');
      } finally {
        setLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [
      inputQuery,
      loading,
      chatHistory,
      addChatMessage,
      currentKwh,
      budget,
      projected,
      activeCanProfile,
    ]
  );

  // Automatically execute any prompt handed over from Bill, Home, What-If, Plugs, or Alerts screens
  useEffect(() => {
    if (pendingTipiPrompt && !loading) {
      const promptToRun = pendingTipiPrompt;
      clearPendingTipiPrompt();
      handleSendText(promptToRun);
    }
  }, [pendingTipiPrompt, loading, clearPendingTipiPrompt, handleSendText]);

  useEffect(() => {
    const unsubscribe = subscribeTtsState((state, text) => {
      setTtsState(state);
      setActiveTtsText(text);
      setIsTalking(state === 'playing');
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleReplaySpeech = useCallback(async (text: string) => {
    unlockSpeechSynthesis();
    await togglePauseSpeaking(text);
  }, []);

  const handleStopSpeech = useCallback(() => {
    stopSpeaking();
    setIsTalking(false);
  }, []);

  // ── Central Navigation Mic Trigger (Sync) ──
  const handleNavMicTrigger = useCallback(() => {
    if (micPhase === 'recording') {
      handlePressOut();
    } else {
      handlePressIn();
    }
  }, [micPhase, handlePressIn, handlePressOut]);

  useEffect(() => {
    registerVoiceTrigger(handleNavMicTrigger);
    return () => {
      registerVoiceTrigger(null);
    };
  }, [handleNavMicTrigger, registerVoiceTrigger]);

  useEffect(() => {
    setVoiceRecordingState(isRecording, 0);
  }, [isRecording, setVoiceRecordingState]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: '#FF6B0018' }]}>
            <Image
              source={TIPI_MASCOT}
              style={styles.headerAvatar}
              resizeMode="contain"
            />
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: theme.ink, fontSize: 18 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Ask ' : 'Tanong kay '}<Text style={{ color: '#FF6B00' }}>Tipi</Text>
              </Text>
              <Text style={[styles.headerSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
              {micPhase === 'recording'
                ? isEnglish
                  ? 'Tipi is listening... release when done'
                  : 'Nakikinig si Tipi... bitawan kapag tapos na'
                : micPhase === 'thinking'
                ? isEnglish
                  ? 'Tipi is thinking...'
                  : 'Iniisip ni Tipi ang sagot...'
                : ttsState === 'paused'
                ? isEnglish
                  ? "Tipi's voice is paused"
                  : 'Naka-pause ang boses ni Tipi'
                : isTalking
                ? isEnglish
                  ? 'Tipi is speaking...'
                  : 'Nagsasalita si Tipi...'
                : isEnglish
                ? 'Type or hold the mic to ask'
                : 'Mag-type o pindutin ang mic para magtanong'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {(ttsState === 'playing' || ttsState === 'paused') && (
              <TouchableOpacity
                style={[
                  styles.headerTtsControlBtn,
                  { backgroundColor: theme.cont, borderColor: theme.brand },
                ]}
                onPress={() => togglePauseSpeaking()}
                accessibilityRole="button"
                accessibilityLabel={
                  ttsState === 'playing'
                    ? isEnglish
                      ? "Pause Tipi's voice"
                      : 'I-pause ang boses ni Tipi'
                    : isEnglish
                    ? "Resume Tipi's voice"
                    : 'Ipagpatuloy ang boses ni Tipi'
                }
              >
                <Text
                  style={[
                    styles.headerTtsControlText,
                    { color: theme.brand, fontSize: 11.5 * fontScale },
                  ]}
                >
                  {ttsState === 'playing'
                    ? isEnglish
                      ? 'Pause'
                      : 'I-pause'
                    : isEnglish
                    ? 'Resume'
                    : 'Ipagpatuloy'}
                </Text>
              </TouchableOpacity>
            )}
            <HeaderAlertButton from="tanong" />
            <HeaderSettingsButton />
          </View>
        </View>

        {/* Chat History Transcript */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.chatScroll,
            chatHistory.length === 0 && !loading && styles.emptyScroll,
          ]}
          onLayout={(e) => {
            scrollViewHeightRef.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_w, h) => {
            contentHeightRef.current = h;
          }}
          showsVerticalScrollIndicator={false}
        >
          {chatHistory.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.ink, fontSize: 15 * fontScale }]}>
                {isEnglish ? 'Ask Tipi' : 'Magtanong kay Tipi'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.muted, fontSize: 13 * fontScale }]}>
                {isEnglish
                  ? 'Type your question below or hold the mic.'
                  : 'I-type ang iyong tanong sa ibaba o hawakan ang mic.'}
              </Text>
            </View>
          )}

          {chatHistory.map((item, index) => {
            const isUser = item.sender === 'user';
            const isLatestVoice = isUser && index === latestVoiceIndex;

            return (
              <Animated.View
                key={index}
                entering={FadeIn.duration(280)}
                layout={LinearTransition.springify().damping(18)}
                style={[styles.messageRow, isUser ? styles.userRow : styles.tipiRow]}
              >
                {!isUser && (
                  <View style={styles.botAvatarWrapper}>
                    <Image
                      source={TIPI_MASCOT}
                      style={styles.botAvatarImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {isUser ? (
                  <UserMessageBubble
                    text={item.text}
                    isLatestVoice={isLatestVoice}
                    pourActive={pourActive}
                    theme={theme}
                    fontScale={fontScale}
                    onBubbleLayout={handleBubbleLayout}
                  />
                ) : (
                  <View
                    style={[
                      styles.bubble,
                      styles.tipiBubble,
                      { backgroundColor: theme.cont, borderColor: theme.line },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: theme.ink, fontSize: 14 * fontScale },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <View style={styles.ttsBubbleControlsRow}>
                      <TouchableOpacity
                        style={[
                          styles.speakReplayBtn,
                          {
                            backgroundColor:
                              activeTtsText === item.text &&
                              (ttsState === 'playing' || ttsState === 'paused')
                                ? `${theme.brand}18`
                                : 'transparent',
                            borderColor:
                              activeTtsText === item.text &&
                              (ttsState === 'playing' || ttsState === 'paused')
                                ? theme.brand
                                : 'transparent',
                          },
                        ]}
                        onPress={() => handleReplaySpeech(item.text)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          activeTtsText === item.text && ttsState === 'playing'
                            ? 'I-pause ang boses ni Tipi'
                            : activeTtsText === item.text && ttsState === 'paused'
                            ? 'Ipagpatuloy ang boses ni Tipi'
                            : 'Pakinggan ang sagot ni Tipi'
                        }
                      >
                        {activeTtsText === item.text && ttsState === 'playing' ? (
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Rect x="6" y="4" width="4" height="16" rx="1" fill={theme.brand} />
                            <Rect x="14" y="4" width="4" height="16" rx="1" fill={theme.brand} />
                          </Svg>
                        ) : activeTtsText === item.text && ttsState === 'paused' ? (
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M6 4L20 12L6 20V4Z" fill={theme.brand} />
                          </Svg>
                        ) : (
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M11 5L6 9H2V15H6L11 19V5Z"
                              stroke={theme.brand}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <Path
                              d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53"
                              stroke={theme.brand}
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </Svg>
                        )}
                        <Text
                          style={[
                            styles.speakReplayText,
                            { color: theme.brand, fontSize: 11.5 * fontScale },
                          ]}
                        >
                          {activeTtsText === item.text && ttsState === 'playing'
                            ? isEnglish
                              ? 'Pause'
                              : 'I-pause'
                            : activeTtsText === item.text && ttsState === 'paused'
                            ? isEnglish
                              ? 'Resume'
                              : 'Ipagpatuloy'
                            : isEnglish
                            ? 'Listen'
                            : 'Pakinggan'}
                        </Text>
                      </TouchableOpacity>

                      {activeTtsText === item.text &&
                        (ttsState === 'playing' || ttsState === 'paused') && (
                          <TouchableOpacity
                            style={styles.stopSpeechBtn}
                            onPress={handleStopSpeech}
                            accessibilityRole="button"
                            accessibilityLabel={isEnglish ? "Stop Tipi's voice" : 'Ihinto ang boses ni Tipi'}
                          >
                            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                              <Rect x="5" y="5" width="14" height="14" rx="2" fill={theme.muted} />
                            </Svg>
                            <Text
                              style={[
                                styles.speakReplayText,
                                { color: theme.muted, fontSize: 11 * fontScale },
                              ]}
                            >
                              {isEnglish ? 'Stop' : 'Ihinto'}
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                )}
              </Animated.View>
            );
          })}

          {/* AI Thinking Spinner */}
          {loading && (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={[styles.messageRow, styles.tipiRow]}
            >
              <View style={styles.botAvatarWrapper}>
                <Image
                  source={TIPI_MASCOT}
                  style={styles.botAvatarImage}
                  resizeMode="contain"
                />
              </View>
              <View
                style={[
                  styles.bubble,
                  styles.tipiBubble,
                  { backgroundColor: theme.cont, borderColor: theme.line },
                ]}
              >
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={theme.brand} />
                  <Text style={[styles.thinkingText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    {isEnglish ? 'Analyzing your electricity usage...' : 'Inaanalisa ang iyong kuryente...'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>


        {/* Chat Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
          <View
            style={[
              styles.inputCapsule,
              {
                backgroundColor: micPhase === 'recording' ? `${ORANGE_RED_GLOW}14` : theme.bg,
                borderColor: micPhase === 'recording' ? ORANGE_RED_GLOW : theme.line,
              },
            ]}
          >
            {/* Real-time speech-to-text appears right inside this typing box */}
            <TextInput
              style={[
                styles.textInput,
                {
                  color: micPhase === 'recording' ? ORANGE_RED_GLOW : theme.ink,
                  fontSize: 14 * fontScale,
                  fontWeight: micPhase === 'recording' ? '600' : '400',
                },
              ]}
              placeholder={
                micPhase === 'recording'
                  ? isEnglish
                    ? 'Tipi is listening... speak now'
                    : 'Nakikinig si Tipi... magsalita ka na'
                  : isEnglish
                  ? 'Type or hold the mic...'
                  : 'Mag-type o hawakan ang mic...'
              }
              placeholderTextColor={micPhase === 'recording' ? ORANGE_RED_GLOW : theme.muted}
              value={inputQuery}
              onChangeText={setInputQuery}
              onSubmitEditing={() => handleSendText()}
              returnKeyType="send"
              editable={micPhase !== 'recording'}
            />

            {/* Mic Button: Enlarges steadily on hold, shrinks on release */}
            <AnimatedMicButton
              phase={micPhase}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              secondsLeft={0}
              theme={theme}
              fontScale={fontScale}
            />
          </View>

          {/* Send Button when text is typed manually */}
          {inputQuery.trim().length > 0 && micPhase !== 'recording' && (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: theme.brand, opacity: loading ? 0.6 : 1 }]}
              onPress={() => handleSendText()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Ipadala ang tanong"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke={theme.brandInk}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        {/* Morphing Fluid Shape: Dynamically travels from mic button all the way to where the message stays */}
        <MorphingFluidShape
          active={pourActive}
          targetDistance={pourTargetDistance}
          targetWidth={pourTargetWidth}
          targetHeight={pourTargetHeight}
          spokenText={pourSpeechText}
          fontScale={fontScale}
          onDone={handlePourDone}
        />

        <View style={{ height: 80 }} />
      </KeyboardAvoidingView>
    </PageTransitionView>
  </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    position: 'relative',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontWeight: '400', letterSpacing: 0.2 },
  headerSub: { fontWeight: '400', marginTop: 2 },
  headerTtsControlBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerTtsControlText: {
    fontWeight: '800',
  },

  chatScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontWeight: '500',
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userRow: { justifyContent: 'flex-end' },
  tipiRow: { justifyContent: 'flex-start', gap: 8 },
  botAvatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B0014',
    borderWidth: 1,
    borderColor: '#FF6B002B',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatarImage: {
    width: 26,
    height: 26,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { borderBottomRightRadius: 4 },
  tipiBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { lineHeight: 20, fontWeight: '500' },
  ttsBubbleControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  speakReplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  stopSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  speakReplayText: {
    fontWeight: '700',
  },

  // Thinking state
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    fontWeight: '600',
  },

  chipsRow: { paddingHorizontal: 12, paddingVertical: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: { fontWeight: '600' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  inputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingLeft: 16,
    paddingRight: 6,
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },

  // Mic Button
  micWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  micRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  capsuleMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micTimerText: { fontWeight: '900' },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontWeight: '800' },

  // Morphing Fluid Shape:
  // Starts as a 44x44 circular droplet positioned right over the mic button (bottom: 92, right: 16)
  // and morphs into a chat bubble as it travels upward with ease-out
  morphingFluidShape: {
    position: 'absolute',
    right: 16,
    bottom: 92,
    backgroundColor: ORANGE_RED_FILL,
    shadowColor: ORANGE_RED_GLOW,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 35,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  morphingTextWrapper: {
    width: '100%',
    justifyContent: 'center',
  },
  morphingText: {
    color: '#ffffff',
    fontWeight: '500',
    lineHeight: 20,
  },
});
