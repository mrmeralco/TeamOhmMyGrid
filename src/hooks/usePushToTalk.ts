import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

export function usePushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneCallbackRef = useRef<((base64: string | null) => void) | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const stopRecordingInternal = useCallback(async (): Promise<string | null> => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsRecording(false);
    setSecondsLeft(3);

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
  }, [recorder]);

  const startRecording = useCallback(
    async (onComplete?: (base64: string | null) => void): Promise<string | null> => {
      onDoneCallbackRef.current = onComplete || null;
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) return null;

        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
        setSecondsLeft(3);

        let counter = 3;
        countdownTimerRef.current = setInterval(async () => {
          counter -= 1;
          setSecondsLeft(counter);
          if (counter <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            const b64 = await stopRecordingInternal();
            if (onDoneCallbackRef.current) {
              onDoneCallbackRef.current(b64);
              onDoneCallbackRef.current = null;
            }
          }
        }, 1000);

        return null;
      } catch {
        setIsRecording(false);
        setSecondsLeft(3);
        return null;
      }
    },
    [recorder, stopRecordingInternal]
  );

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    secondsLeft,
    startRecording,
    stopRecording: stopRecordingInternal,
  };
}
