import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

/**
 * usePushToTalk — True walkie-talkie hold-to-record / release-to-send hook.
 *
 * Usage:
 *   const { isRecording, startRecording, stopRecording, recognitionLang, setRecognitionLang } = usePushToTalk();
 *
 *   onPressIn  → await startRecording(onLiveTranscript?)  // just starts; returns immediately
 *   onPressOut → const { base64, transcript } = await stopRecording()  // stops and returns data
 *
 * No auto-stop timer. Recording continues exactly as long as the user holds the button.
 */
export function usePushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState<'fil-PH' | 'en-PH'>('en-PH');

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  // Track whether the audio recorder hardware is active (may fail on web)
  const recorderActiveRef = useRef<boolean>(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Stop speech recognition (web SpeechRecognition API) ──
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped or not started — ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  // ── Start speech recognition for live transcript while holding ──
  const startSpeechRecognition = useCallback(
    (onTranscript?: (text: string) => void) => {
      transcriptRef.current = '';
      if (typeof window === 'undefined') return;
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) return;

      try {
        const recognition = new SpeechRecognitionCtor();
        // fil-PH and en-PH on Chromium/WebKit recognizes both Filipino (Tagalog), English, and Taglish
        recognition.lang = recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (result && result[0]?.transcript) {
              combined += result[0].transcript + ' ';
            }
          }
          const clean = combined.trim();
          if (clean) {
            transcriptRef.current = clean;
            onTranscript?.(clean);
          }
        };

        recognition.onerror = () => {
          // Silently ignore recognition errors (e.g. no-speech, network)
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        recognitionRef.current = null;
      }
    },
    [recognitionLang]
  );

  // ── startRecording: begin recording; returns immediately (no auto-stop) ──
  const startRecording = useCallback(
    async (onTranscript?: (text: string) => void): Promise<void> => {
      transcriptRef.current = '';
      recorderActiveRef.current = false;

      // Start live speech recognition in parallel
      startSpeechRecognition(onTranscript);

      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (granted) {
          try {
            await recorder.prepareToRecordAsync();
            recorder.record();
            recorderActiveRef.current = true;
          } catch {
            // Audio hardware unavailable (e.g., web without mic permission) —
            // fall through to speech-recognition-only mode.
            recorderActiveRef.current = false;
          }
        }
        setIsRecording(true);
      } catch {
        stopSpeechRecognition();
        setIsRecording(false);
      }
    },
    [recorder, startSpeechRecognition, stopSpeechRecognition]
  );

  // ── stopRecording: stop recording and return captured audio + transcript ──
  const stopRecording = useCallback(async (): Promise<{
    base64: string | null;
    transcript: string;
  }> => {
    const finalTranscript = transcriptRef.current;
    stopSpeechRecognition();
    setIsRecording(false);

    let base64: string | null = null;

    if (recorderActiveRef.current) {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) {
          base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } catch {
        base64 = null;
      }
      recorderActiveRef.current = false;
    }

    return { base64, transcript: finalTranscript };
  }, [recorder, stopSpeechRecognition]);

  // Expose the latest live transcript for callers that want it synchronously
  const getLatestTranscript = useCallback(() => transcriptRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeechRecognition();
    };
  }, [stopSpeechRecognition]);

  return {
    isRecording,
    recognitionLang,
    setRecognitionLang,
    getLatestTranscript,
    startRecording,
    stopRecording,
  };
}
