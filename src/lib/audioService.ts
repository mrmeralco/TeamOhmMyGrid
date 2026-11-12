import * as Speech from 'expo-speech';

export type TtsPlaybackState = 'idle' | 'playing' | 'paused';

type TtsListener = (state: TtsPlaybackState, activeText: string | null) => void;

const FILIPINO_MARKERS = new Set([
  'ang',
  'ng',
  'sa',
  'mga',
  'na',
  'pa',
  'ba',
  'po',
  'ko',
  'mo',
  'ito',
  'iyan',
  'iyon',
  'para',
  'natin',
  'niyo',
  'nila',
  'yung',
  'ung',
  'kung',
  'kapag',
  'dahil',
  'pero',
  'kaya',
  'kuryente',
  'buwan',
  'araw',
  'bawat',
  'halaga',
  'konsumo',
  'matitipid',
  'tipid',
  'kamusta',
  'kumusta',
  'paano',
  'bakit',
  'magkano',
  'oo',
  'hindi',
  'pwede',
  'puwede',
  'lamang',
  'lang',
  'naman',
  'kasi',
  'mula',
  'hanggang',
  'bago',
  'mas',
  'iyong',
  'aking',
  'amin',
  'atin',
  'nasa',
  'may',
  'wala',
  'walang',
  'maraming',
  'salamat',
  'araw-araw',
  'linggo',
  'bayarin',
  'bawas',
  'taas',
  'baba',
]);

let activeWebUtterance: any = null;
let currentTtsState: TtsPlaybackState = 'idle';
let currentActiveText: string | null = null;
const ttsListeners = new Set<TtsListener>();

function setTtsState(nextState: TtsPlaybackState, text: string | null = currentActiveText) {
  currentTtsState = nextState;
  currentActiveText = nextState === 'idle' ? null : text;
  ttsListeners.forEach((listener) => {
    try {
      listener(currentTtsState, currentActiveText);
    } catch {
      // ignore listener errors
    }
  });
}

export function getTtsState(): { state: TtsPlaybackState; activeText: string | null } {
  return { state: currentTtsState, activeText: currentActiveText };
}

export function subscribeTtsState(listener: TtsListener): () => void {
  ttsListeners.add(listener);
  listener(currentTtsState, currentActiveText);
  return () => {
    ttsListeners.delete(listener);
  };
}

/**
 * Unlocks browser Web Speech Synthesis and HTML5 Audio during a synchronous user gesture
 * so subsequent async TTS playback after Gemini API responses is allowed by the browser.
 */
export function unlockSpeechSynthesis(): void {
  try {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof (window as any).SpeechSynthesisUtterance === 'function'
    ) {
      const synth = window.speechSynthesis;
      synth.cancel();
      synth.resume?.();
      const silent = new (window as any).SpeechSynthesisUtterance('');
      silent.volume = 0;
      synth.speak(silent);
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Detects whether text is primarily Filipino/Taglish ('fil-PH') or English ('en-PH').
 */
export function detectSpeechLanguage(text: string): 'fil-PH' | 'en-PH' {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return 'en-PH';
  }

  let filipinoCount = 0;
  for (const token of tokens) {
    if (FILIPINO_MARKERS.has(token)) {
      filipinoCount += 1;
    }
  }

  return filipinoCount >= 1 && filipinoCount / tokens.length >= 0.08 ? 'fil-PH' : 'en-PH';
}

/**
 * Normalizes currency, energy, and temperature units so both Filipino and English
 * TTS engines pronounce them naturally.
 */
export function normalizeSpeechText(text: string): string {
  return text
    .replace(/₱\s*([\d,]+(?:\.\d+)?)/g, '$1 pesos')
    .replace(/\bkWh\b/gi, 'kilowatt hours')
    .replace(/°C\b/g, ' degrees Celsius')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Scores a voice by how natural/neural it sounds so we always prefer Natural/Online/Neural/Google
 * voices and avoid flat robotic Windows SAPI5 "Desktop" voices whenever better voices exist.
 */
export function scoreVoiceNaturalness(
  voice: { name?: string; language?: string; lang?: string; localService?: boolean },
  targetLanguage: 'fil-PH' | 'en-PH'
): number {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.language || voice.lang || '').toLowerCase();
  let score = 0;

  // Language match scoring
  if (targetLanguage === 'fil-PH') {
    if (lang.startsWith('fil') || lang.startsWith('tl')) score += 50;
    else if (lang.startsWith('en-ph')) score += 40;
    else if (lang.startsWith('en')) score += 25;
  } else {
    if (lang.startsWith('en-ph')) score += 50;
    else if (lang.startsWith('en-us') || lang.startsWith('en-gb')) score += 45;
    else if (lang.startsWith('en')) score += 35;
    else if (lang.startsWith('fil') || lang.startsWith('tl')) score += 25;
  }

  // Natural / Neural voice quality boost
  if (name.includes('natural') || name.includes('neural')) score += 60;
  if (name.includes('online')) score += 40;
  if (name.includes('google')) score += 35;
  if (
    name.includes('angelo') ||
    name.includes('blessica') ||
    name.includes('aria') ||
    name.includes('jenny') ||
    name.includes('sonia') ||
    name.includes('ava') ||
    name.includes('samantha') ||
    name.includes('siri') ||
    name.includes('enhanced') ||
    name.includes('premium')
  ) {
    score += 30;
  }
  if (voice.localService === false) {
    score += 20;
  }

  // Penalize legacy robotic SAPI5 "Desktop" voices if any other voice is available
  if (name.includes('desktop')) {
    score -= 45;
  }

  return score;
}

async function resolveBestVoice(
  targetLanguage: 'fil-PH' | 'en-PH'
): Promise<{ language: string; voice?: string }> {
  try {
    if (typeof Speech.getAvailableVoicesAsync !== 'function') {
      return { language: targetLanguage };
    }
    const voicesPromise = Speech.getAvailableVoicesAsync();
    const timeoutPromise = new Promise<never[]>((resolve) =>
      setTimeout(() => resolve([]), 250)
    );
    const voices = await Promise.race([voicesPromise, timeoutPromise]);
    if (!Array.isArray(voices) || voices.length === 0) {
      return { language: targetLanguage };
    }

    const ranked = [...voices].sort(
      (a, b) =>
        scoreVoiceNaturalness(b, targetLanguage) - scoreVoiceNaturalness(a, targetLanguage)
    );
    const best = ranked[0];
    if (best) {
      return {
        language: best.language || targetLanguage,
        voice: best.identifier,
      };
    }
  } catch {
    // Ignore voice lookup errors
  }

  return { language: targetLanguage };
}

function speakWithWebSpeechApi(
  cleanedText: string,
  detectedLang: 'fil-PH' | 'en-PH',
  rawText: string
): boolean {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof (window as any).SpeechSynthesisUtterance !== 'function'
  ) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume?.();

    const utterance = new (window as any).SpeechSynthesisUtterance(cleanedText);
    utterance.pitch = 1.02;
    utterance.rate = 0.98;
    utterance.volume = 1.0;

    const voices = synth.getVoices?.() || [];
    if (voices.length > 0) {
      const ranked = [...voices].sort(
        (a: any, b: any) =>
          scoreVoiceNaturalness(b, detectedLang) - scoreVoiceNaturalness(a, detectedLang)
      );
      const bestVoice = ranked[0];
      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang || detectedLang;
      } else {
        utterance.lang = detectedLang;
      }
    } else {
      utterance.lang = 'en-US';
    }

    activeWebUtterance = utterance;
    setTtsState('playing', rawText);

    utterance.onstart = () => {
      if (activeWebUtterance === utterance) {
        setTtsState('playing', rawText);
      }
    };
    utterance.onpause = () => {
      if (activeWebUtterance === utterance) {
        setTtsState('paused', rawText);
      }
    };
    utterance.onresume = () => {
      if (activeWebUtterance === utterance) {
        setTtsState('playing', rawText);
      }
    };
    utterance.onend = () => {
      if (activeWebUtterance === utterance) {
        activeWebUtterance = null;
        setTtsState('idle', null);
      }
    };
    utterance.onerror = () => {
      if (activeWebUtterance === utterance) {
        activeWebUtterance = null;
        setTtsState('idle', null);
      }
    };

    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vocalizes response using highest-ranked neural OS/browser voice
 * with full Pause / Resume / Stop support.
 */
export async function speakResponse(text: string): Promise<void> {
  try {
    const cleaned = normalizeSpeechText(text);
    if (!cleaned) return;

    stopSpeaking();

    const detectedLang = detectSpeechLanguage(cleaned);

    // 1. Ranked Natural/Neural Web Speech Synthesis
    if (speakWithWebSpeechApi(cleaned, detectedLang, text)) {
      return;
    }

    // 2. Native Expo Speech with natural voice ranking
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    const { language, voice } = await resolveBestVoice(detectedLang);
    const fallbackLanguage = detectedLang === 'fil-PH' ? 'en-PH' : 'en-US';

    setTtsState('playing', text);
    Speech.speak(cleaned, {
      language,
      voice,
      pitch: 1.02,
      rate: 0.98,
      onDone: () => setTtsState('idle', null),
      onStopped: () => setTtsState('idle', null),
      onError: () => {
        Speech.speak(cleaned, {
          language: fallbackLanguage,
          pitch: 1.02,
          rate: 0.98,
          onDone: () => setTtsState('idle', null),
          onStopped: () => setTtsState('idle', null),
          onError: () => setTtsState('idle', null),
        });
      },
    });
  } catch {
    setTtsState('idle', null);
  }
}

/**
 * Pauses active AI TTS playback (supports both Gemini WAV audio and SpeechSynthesis / Expo Speech).
 */
export async function pauseSpeaking(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setTtsState('paused', currentActiveText);
        return;
      }
    }
    if (typeof Speech.pause === 'function') {
      await Speech.pause();
      setTtsState('paused', currentActiveText);
      return;
    }
    // On Android native where Speech.pause is unsupported, stop cleanly
    await Speech.stop();
    setTtsState('idle', null);
  } catch {
    // Non-blocking
  }
}

/**
 * Resumes paused AI TTS playback.
 */
export async function resumeSpeaking(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setTtsState('playing', currentActiveText);
        return;
      }
    }
    if (typeof Speech.resume === 'function') {
      await Speech.resume();
      setTtsState('playing', currentActiveText);
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Toggles between playing and paused TTS states, or starts speaking the provided text if idle.
 */
export async function togglePauseSpeaking(fallbackText?: string): Promise<TtsPlaybackState> {
  if (currentTtsState === 'playing') {
    await pauseSpeaking();
    return 'paused';
  }
  if (currentTtsState === 'paused') {
    if (!fallbackText || currentActiveText === fallbackText) {
      await resumeSpeaking();
      return 'playing';
    }
  }
  if (fallbackText) {
    await speakResponse(fallbackText);
    return 'playing';
  }
  return currentTtsState;
}

export function stopSpeaking(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      activeWebUtterance = null;
    }
    Speech.stop();
  } catch {
    // Non-blocking catch
  } finally {
    setTtsState('idle', null);
  }
}
