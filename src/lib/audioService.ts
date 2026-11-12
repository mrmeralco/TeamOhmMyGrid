import * as Speech from 'expo-speech';

/**
 * Vocalizes response using expo-speech with Filipino language pack (fil-PH),
 * falling back to English (en-PH / en-US).
 * STRICT CONSTRAINT: Call ONLY when query was initiated via Push-to-Talk voice.
 */
export async function speakResponse(text: string): Promise<void> {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    Speech.speak(text, {
      language: 'fil-PH',
      pitch: 1.0,
      rate: 0.95,
      onError: () => {
        // Fallback to English if fil-PH is unavailable on the device
        Speech.speak(text, {
          language: 'en-PH',
          pitch: 1.0,
          rate: 0.95,
        });
      },
    });
  } catch {
    // Non-blocking catch
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // Non-blocking catch
  }
}
