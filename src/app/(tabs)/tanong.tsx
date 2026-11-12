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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
import { TipiMascot } from '../../components/TipiMascot';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { usePushToTalk } from '../../hooks/usePushToTalk';
import { processTextQuery, processVoiceQuery } from '../../lib/geminiService';
import { speakResponse } from '../../lib/audioService';

const SUGGESTION_CHIPS = [
  'Bakit lumobo ang Aircon ko?',
  'Himayin ang Bill 📋',
  'Paano makakatipid ng ₱500?',
  'Peak Hours Alert?',
];

export default function TanongScreen() {
  const { theme, fontScale } = useTheme();
  const {
    currentKwh,
    budget,
    projected,
    chatHistory,
    addChatMessage,
    registerVoiceTrigger,
    setVoiceRecordingState,
  } = useEnergy();

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const scrollViewRef = useRef<any>(null);

  const { isRecording, secondsLeft, startRecording } = usePushToTalk();

  const handleSendText = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || loading) return;

    setInputQuery('');
    addChatMessage('user', query);
    setLoading(true);

    try {
      // STRICT CONSTRAINT: Silent text processing - ZERO vocalization
      const response = await processTextQuery(query, {
        totalKwh: currentKwh,
        budget,
        projected,
      });
      addChatMessage('tipi', response);
    } catch {
      addChatMessage('tipi', 'Pasensya na, nagkaroon ng aberya. Pakisubukan muli.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleStartPushToTalk = useCallback(async () => {
    if (isRecording || loading) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // non-blocking
    }

    startRecording(async (base64Audio) => {
      if (!base64Audio) {
        addChatMessage('tipi', 'Hindi narinig ang boses. Pakisubukan muli.');
        return;
      }

      setLoading(true);
      addChatMessage('user', '🎙️ [Boses na Tanong kay Tipi]');

      try {
        const response = await processVoiceQuery(base64Audio, {
          totalKwh: currentKwh,
          budget,
          projected,
        });

        addChatMessage('tipi', response);
        // STRICT CONSTRAINT: Vocalize ONLY on voice queries
        setIsTalking(true);
        await speakResponse(response);
        setTimeout(() => setIsTalking(false), 4000);
      } catch {
        addChatMessage('tipi', 'Paumanhin, hindi naproseso ang iyong boses.');
      } finally {
        setLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
  }, [isRecording, loading, startRecording, currentKwh, budget, projected, addChatMessage]);

  // Connect central bottom nav mic button to push-to-talk
  useEffect(() => {
    registerVoiceTrigger(handleStartPushToTalk);
    return () => {
      registerVoiceTrigger(null);
    };
  }, [handleStartPushToTalk, registerVoiceTrigger]);

  // Sync recording status and timer to bottom nav mic button
  useEffect(() => {
    setVoiceRecordingState(isRecording, secondsLeft);
  }, [isRecording, secondsLeft, setVoiceRecordingState]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header with Mascot */}
        <View style={[styles.header, { borderBottomColor: theme.line }]}>
          <TipiMascot isTalking={isTalking} size="mini" />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: theme.ink, fontSize: 18 * fontScale }]}>
              Tanong kay Tipi
            </Text>
            <Text style={[styles.headerSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
              {isRecording
                ? `🔴 Nakikinig... ${secondsLeft}s`
                : isTalking
                ? 'Nagsasalita si Tipi...'
                : 'Magsalita sa mic o mag-type ng tanong'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeaderAlertButton from="tanong" />
            <HeaderSettingsButton />
          </View>
        </View>

        {/* Chat History Transcript */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {chatHistory.map((item, index) => {
            const isUser = item.sender === 'user';
            return (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  isUser ? styles.userRow : styles.tipiRow,
                ]}
              >
                {!isUser && (
                  <View style={styles.botAvatarWrapper}>
                    <TipiMascot size="mini" isTalking={false} />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: theme.brand }]
                      : [styles.tipiBubble, { backgroundColor: theme.cont, borderColor: theme.line }],
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      {
                        color: isUser ? theme.brandInk : theme.ink,
                        fontSize: 14 * fontScale,
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={[styles.messageRow, styles.tipiRow]}>
              <View style={[styles.bubble, styles.tipiBubble, { backgroundColor: theme.cont }]}>
                <ActivityIndicator size="small" color={theme.brand} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips */}
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SUGGESTION_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.line }]}
                onPress={() => handleSendText(chip)}
              >
                <Text style={[styles.chipText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Google-Style Chat Input Bar with Orange Mic docked on the rightmost inside */}
        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
          <View
            style={[
              styles.inputCapsule,
              {
                backgroundColor: theme.bg,
                borderColor: isRecording ? theme.brand : theme.line,
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.ink,
                  fontSize: 14 * fontScale,
                },
              ]}
              placeholder="Mag-type ng tanong o magsalita..."
              placeholderTextColor={theme.muted}
              value={inputQuery}
              onChangeText={setInputQuery}
              onSubmitEditing={() => handleSendText()}
              returnKeyType="send"
            />

            {/* Google-Style Orange Mic Icon at Rightmost Side */}
            <TouchableOpacity
              style={[
                styles.capsuleMicBtn,
                {
                  backgroundColor: isRecording ? theme.danger : theme.brand,
                },
              ]}
              onPress={handleStartPushToTalk}
              accessibilityRole="button"
              accessibilityLabel={
                isRecording
                  ? `Nakikinig si Tipi (${secondsLeft}s)`
                  : 'Magsalita kay Tipi gamit ang boses'
              }
              activeOpacity={0.8}
            >
              {isRecording ? (
                <Text style={[styles.micTimerText, { color: theme.brandInk, fontSize: 13 * fontScale }]}>
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
                    stroke={theme.brandInk}
                    strokeWidth="2.2"
                  />
                  <Path
                    d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10"
                    stroke={theme.brandInk}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <Path
                    d="M12 17V21M8 21H16"
                    stroke={theme.brandInk}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </TouchableOpacity>
          </View>

          {/* Send Button when text is present */}
          {inputQuery.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: theme.brand,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={() => handleSendText()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Ipadala ang tanong"
            >
              <Text style={[styles.sendBtnText, { color: theme.brandInk, fontSize: 15 * fontScale }]}>
                ➤
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 80 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontWeight: '800' },
  headerSub: { fontWeight: '600', marginTop: 2 },
  chatScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  tipiRow: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  botAvatarWrapper: {
    width: 32,
    height: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  tipiBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    lineHeight: 20,
    fontWeight: '500',
  },
  chipsRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    fontWeight: '600',
  },
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
  capsuleMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  micTimerText: {
    fontWeight: '900',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontWeight: '800',
  },
});
