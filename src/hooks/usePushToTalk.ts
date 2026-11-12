import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

export function usePushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [recognitionLang, setRecognitionLang] = useState<'fil-PH' | 'en-PH'>('en-PH');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneCallbackRef = useRef<((base64: string | null, transcript?: string) => void) | null>(
    null
  );
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already stopped
      }
      recognitionRef.current = null;
    }
  }, []);

  const startSpeechRecognition = useCallback(
    (onTranscript?: (text: string) => void) => {
      transcriptRef.current = '';
      if (typeof window === 'undefined') return;
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) return;

      try {
        const recognition = new SpeechRecognitionCtor();
        // en-PH and fil-PH on Chromium/WebKit recognize both Filipino (Tagalog), English, and Taglish
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

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        recognitionRef.current = null;
      }
    },
    [recognitionLang]
  );

  const stopRecordingInternal = useCallback(async (): Promise<string | null> => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    stopSpeechRecognition();
    setIsRecording(false);
    setSecondsLeft(5);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return null;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch {
      return null;
    }
  }, [recorder, stopSpeechRecognition]);

  const startRecording = useCallback(
    async (
      onComplete?: (base64: string | null, transcript?: string) => void,
      onTranscript?: (text: string) => void
    ): Promise<string | null> => {
      onDoneCallbackRef.current = onComplete || null;
      startSpeechRecognition(onTranscript);

      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted && !recognitionRef.current) {
          stopSpeechRecognition();
          return null;
        }

        if (granted) {
          try {
            await recorder.prepareToRecordAsync();
            recorder.record();
          } catch {
            // Continue with Web Speech recognition if audio recorder hardware is busy
          }
        }

        setIsRecording(true);
        setSecondsLeft(5);

        let counter = 5;
        countdownTimerRef.current = setInterval(async () => {
          counter -= 1;
          setSecondsLeft(counter);
          if (counter <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            const finalTranscript = transcriptRef.current;
            const b64 = await stopRecordingInternal();
            if (onDoneCallbackRef.current) {
              onDoneCallbackRef.current(b64, finalTranscript);
              onDoneCallbackRef.current = null;
            }
          }
        }, 1000);

        return null;
      } catch {
        stopSpeechRecognition();
        setIsRecording(false);
        setSecondsLeft(5);
        return null;
      }
    },
    [recorder, startSpeechRecognition, stopRecordingInternal, stopSpeechRecognition]
  );

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      stopSpeechRecognition();
    };
  }, [stopSpeechRecognition]);

  return {
    isRecording,
    secondsLeft,
    recognitionLang,
    setRecognitionLang,
     getLatestTranscript: () => transcriptRef.current,
    startRecording,
    stopRecording: stopRecordingInternal,
  };
}
