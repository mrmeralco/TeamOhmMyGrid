import { ExtractedBillData } from '../types';
import { BOT_RESPONSES } from '../constants/mockData';
import { getUsageDemo, parseUsageAnalysis, UsageAnalysis, UsageScenario } from './usageAnalysis';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

export interface ConversationTurn {
  sender: 'user' | 'tipi';
  text: string;
}

export interface TipiQueryContext {
  totalKwh: number;
  budget: number;
  projected: number;
  meterType?: 'AMI' | 'Analog';
  can?: string;
  profileName?: string;
}

function getGeminiApiKey(): string {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_GEMINI_IN_TEST) {
    return '';
  }
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

function getModelCandidates(): string[] {
  const preferred =
    process.env.EXPO_PUBLIC_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  return [preferred, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== preferred)];
}

async function generateWithFallback(
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API key');
  }

  let lastError: Error | null = null;
  for (const model of getModelCandidates()) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (response.ok) {
      return response.json();
    }

    lastError = new Error(`Gemini API error (${model}): ${response.status}`);
    if (response.status !== 404 && response.status !== 429 && response.status !== 503) {
      break;
    }
  }

  throw lastError || new Error('Gemini API request failed');
}

function buildConversationContents(
  history: ConversationTurn[],
  finalUserParts: Record<string, unknown>[]
): Array<{ role: 'user' | 'model'; parts: Record<string, unknown>[] }> {
  const recent = history.slice(-12);
  const turns: Array<{ role: 'user' | 'model'; parts: Record<string, unknown>[] }> = [];

  for (const item of recent) {
    const text = item.text?.trim();
    if (!text) continue;
    const role: 'user' | 'model' = item.sender === 'user' ? 'user' : 'model';

    // Gemini multi-turn contents must start with a 'user' role
    if (turns.length === 0 && role === 'model') {
      continue;
    }

    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) {
      prev.parts.push({ text });
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  }

  // If the caller already appended the identical latest user text into chatHistory, replace it with finalUserParts
  const lastTurn = turns[turns.length - 1];
  const finalTextPart = finalUserParts.find((p) => typeof p.text === 'string')?.text as
    | string
    | undefined;
  if (
    lastTurn &&
    lastTurn.role === 'user' &&
    lastTurn.parts.length === 1 &&
    finalTextPart &&
    lastTurn.parts[0].text === finalTextPart
  ) {
    lastTurn.parts = finalUserParts;
    return turns;
  }

  if (lastTurn && lastTurn.role === 'user') {
    lastTurn.parts.push(...finalUserParts);
  } else {
    turns.push({ role: 'user', parts: finalUserParts });
  }

  return turns;
}

export async function parseMeralcoBillImage(base64Image: string): Promise<ExtractedBillData> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      customerAccountNumber: '123456789012',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-25',
      totalKwh: 215,
      totalAmountDue: 2450.5,
      generationCharge: 1414.95,
      verifiedByUser: false,
    };
  }

  const prompt = `You are a specialist at reading Philippine Meralco electricity bills.
Extract the following information from the provided Meralco bill image:
1. customerAccountNumber (10-12 digit CAN)
2. billingPeriod: object with startDate and endDate (YYYY-MM-DD)
3. dueDate (YYYY-MM-DD)
4. totalKwh (number)
5. totalAmountDue (total peso amount as number)
6. generationCharge (number)

Output valid JSON strictly with this schema:
{
  "customerAccountNumber": "string",
  "billingPeriod": { "startDate": "string", "endDate": "string" },
  "dueDate": "string",
  "totalKwh": 0,
  "totalAmountDue": 0,
  "generationCharge": 0
}`;

  try {
    const json = await generateWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
      },
    });

    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('No content returned from Gemini.');
    }

    const parsed = JSON.parse(candidateText) as ExtractedBillData;
    return {
      ...parsed,
      verifiedByUser: false,
    };
  } catch {
    return {
      customerAccountNumber: '123456789012',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-25',
      totalKwh: 215,
      totalAmountDue: 2450.5,
      generationCharge: 1414.95,
      verifiedByUser: false,
    };
  }
}

function getOfflineFallbackResponse(text: string, context: TipiQueryContext): string {
  if (BOT_RESPONSES[text]) {
    return BOT_RESPONSES[text].text;
  }

  const lower = text.toLowerCase();
  if (lower.includes('aircon') || lower.includes('24') || lower.includes('lobo')) {
    return (
      BOT_RESPONSES['Bakit lumobo ang Aircon ko?']?.text ||
      `Kapag ginawa mong 24°C ang aircon mula 20°C, makakatipid ka ng mga ₱482 bawat buwan dahil 16% ang bawas sa konsumo ng inverter compressor!`
    );
  }
  if (lower.includes('line') || lower.includes('breakdown') || lower.includes('himayin')) {
    return (
      BOT_RESPONSES['Himayin ang Bill Line-by-Line 📋']?.text ||
      `Heto ang breakdown ng bill mo: Generation (58%), Distribution (21%), Transmission (9%), at Taxes (12%).`
    );
  }
  if (lower.includes('500') || lower.includes('tipid') || lower.includes('makakatipid')) {
    return (
      BOT_RESPONSES['Paano ako makakatipid ng ₱500?']?.text ||
      `Kayang-kaya maabot ang ₱500 tipid sa pamamagitan ng pag-set ng AC sa 24°C, pag-unplug ng vampire loads, at pag-shift sa off-peak!`
    );
  }
  if (lower.includes('peak') || lower.includes('oras') || lower.includes('alert')) {
    return (
      BOT_RESPONSES['Bakit may Peak-Hour Alert ngayon?']?.text ||
      `Ang Peak Hours ng Meralco ay karaniwang 8:00 AM hanggang 9:00 PM Lunes hanggang Sabado. Mas magandang mag-plantsa o mag-laba pagsapit ng 9:00 PM pataas.`
    );
  }
  if (lower.includes('bakit') || lower.includes('tumaas') || lower.includes('mataas')) {
    return `Ang projected bill mo ay ₱${context.projected.toLocaleString()} laban sa budget na ₱${context.budget.toLocaleString()}. Malapit ka nang pumasok sa Tier 2 (200 kWh bracket) kung saan mas mataas ang distribution charge. Subukang i-adjust ang aircon timer!`;
  }
  return `Hello! Ako si Tipi, ang iyong KuryenTipid coach. Kasalukuyang nasa ${context.totalKwh} kWh ang konsumo mo ngayong buwan sa budget na ₱${context.budget.toLocaleString()}. May nais ka bang himayin natin sa iyong kuryente?`;
}

export async function processTextQuery(
  text: string,
  context: TipiQueryContext,
  history: ConversationTurn[] = []
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return getOfflineFallbackResponse(text, context);
  }

  const systemPrompt = `You are "Tipi", a friendly, multilingual Filipino AI energy coach inside the KuryenTipid app.
You help Filipino households understand their Meralco electricity bills, appliances, and meter readings, and have natural multi-turn conversations.
Respond naturally in Taglish, Tagalog, or English depending on how the user addresses you.
Remember details the user shared earlier in the conversation and answer follow-up questions directly.
Keep responses concise (2 to 4 short sentences), practical, and warm. Plain text only (avoid markdown asterisks).
Household Context:
- Account Profile: ${context.profileName || 'Bahay'} (${context.can || 'Meralco CAN'})
- Meter Classification: ${context.meterType || 'AMI'}
- Current consumption: ${context.totalKwh} kWh
- Monthly budget: ₱${context.budget}
- Projected end-of-month bill: ₱${context.projected}`;

  try {
    const contents = buildConversationContents(history, [{ text }]);
    const json = await generateWithFallback({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
      },
    });

    const reply = json.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '')
      .join('')
      .trim();
    return reply || getOfflineFallbackResponse(text, context);
  } catch {
    return getOfflineFallbackResponse(text, context);
  }
}

export async function processVoiceQuery(
  base64Audio: string,
  context: TipiQueryContext,
  history: ConversationTurn[] = [],
  spokenTranscript?: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return `Narinig ko ang iyong boses! Ang projected bill mo ngayong buwan ay ₱${context.projected.toLocaleString()} sa ${context.totalKwh} kWh. Pwede kang magtipid sa pamamagitan ng pagtaas ng thermostat sa 24°C.`;
  }

  const systemInstruction = `You are "Tipi", a friendly conversational energy coach for Meralco customers in the Philippines.
Listen to the user's voice query (and consider earlier conversation turns) and answer concisely in 1 to 3 spoken sentences in Taglish. Plain text only.
Context: Profile ${context.profileName || 'Bahay'} (${context.meterType || 'AMI'} meter), Current ${context.totalKwh} kWh, Projected ₱${context.projected}, Budget ₱${context.budget}.`;

  try {
    const userParts: Record<string, unknown>[] = [];
    if (spokenTranscript) {
      userParts.push({ text: spokenTranscript });
    } else {
      userParts.push({ text: 'Pakisagot ang boses na tanong ng user.' });
    }
    userParts.push({
      inline_data: {
        mime_type: 'audio/mp4',
        data: base64Audio,
      },
    });

    const contents = buildConversationContents(history, userParts);
    const json = await generateWithFallback({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
      },
    });

    const reply = json.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '')
      .join('')
      .trim();
    return reply || 'Narinig kita! Pwede mong i-adjust ang aircon para makatipid.';
  } catch {
    if (spokenTranscript) {
      return processTextQuery(spokenTranscript, context, history);
    }
    return `Narinig kita! Nasa ₱${context.projected.toLocaleString()} ang projected bill mo sa ${context.totalKwh} kWh. Subukang i-set ang aircon sa 24°C!`;
  }
}

export async function analyzeUsageWithGeminiClient(
  scenario: UsageScenario = 'baseline',
  signal?: AbortSignal
): Promise<UsageAnalysis> {
  const demo = getUsageDemo(scenario);
  const willExceed = demo.projected > demo.budget;
  const prompt =
    'You are Tipi, a concise Filipino household energy coach. Analyze this mock dataset: ' +
    JSON.stringify(demo) +
    '. Each reading is average W for one hour. 13:00-16:00 is exactly three hours; evening is 18:00-24:00. ' +
    'Use projected_final_bill exactly ' +
    demo.projected +
    ', and will_exceed_budget exactly ' +
    willExceed +
    '. ' +
    'Set culprit_appliance to a cautious hypothesis such as "Possible aircon (unconfirmed)". ' +
    'Write alert_message in at most 2 short sentences and 40 words of friendly Taglish. ' +
    'Return strictly valid JSON with keys: will_exceed_budget (boolean), culprit_appliance (string), projected_final_bill (number), alert_message (string).';

  const json = await generateWithFallback(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
      },
    },
    signal
  );

  const candidateText = json.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .join('')
    .trim();
  if (!candidateText) {
    throw new Error('Empty model response');
  }
  return parseUsageAnalysis(candidateText, scenario);
}
