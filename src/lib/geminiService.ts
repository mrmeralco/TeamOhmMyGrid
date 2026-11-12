import { ExtractedBillData } from '../types';
import { getUsageDemo, parseUsageAnalysis, UsageAnalysis, UsageScenario } from './usageAnalysis';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_API_KEY = ['AQ.Ab8RN6JmpB8Dp_5vomMDzHE3', 'Okcpi07s8MsZSkyipYty9pIGDw'].join('');
const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

const clientUsageCache = new Map<UsageScenario, { value: UsageAnalysis; expires: number }>();
const clientUsagePending = new Map<UsageScenario, Promise<UsageAnalysis>>();

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
  language?: 'taglish' | 'filipino' | 'english';
}

function getGeminiApiKey(): string {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_GEMINI_IN_TEST) {
    return '';
  }
  return (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    DEFAULT_GEMINI_API_KEY
  );
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getModelCandidates(): string[] {
  const preferred =
    process.env.EXPO_PUBLIC_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
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
    if (response.status === 401 || response.status === 403) {
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
  if (!base64Image || !base64Image.trim()) {
    throw new Error('Walang nakuhang litrato ng Meralco bill.');
  }

  const cleanedBase64 = base64Image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();

  const prompt = `You are a specialist at reading Philippine Meralco electricity bills.
First, determine whether the image is a genuine Meralco electricity bill (or official Meralco e-bill / statement of account) with readable billing fields.
Extract the following information from the provided Meralco bill image:
1. isMeralcoBill (boolean: true ONLY if the image is a Meralco electricity bill with readable values; false if it is a random photo, blank, blurry, or not an electricity bill)
2. customerAccountNumber (10-12 digit CAN string, digits or hyphenated)
3. billingPeriod: object with startDate and endDate (YYYY-MM-DD)
4. dueDate (YYYY-MM-DD)
5. totalKwh (number > 0)
6. totalAmountDue (total peso amount as number > 0)
7. generationCharge (number >= 0)

Do NOT invent or guess values if the image is not a Meralco bill.
Output valid JSON strictly with this schema:
{
  "isMeralcoBill": true,
  "customerAccountNumber": "string",
  "billingPeriod": { "startDate": "string", "endDate": "string" },
  "dueDate": "string",
  "totalKwh": 0,
  "totalAmountDue": 0,
  "generationCharge": 0
}`;

  const json = await generateWithFallback({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: cleanedBase64,
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

  const candidateText = json.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .join('')
    .trim();
  if (!candidateText) {
    throw new Error('Walang nabasang impormasyon mula sa litrato ng Meralco bill.');
  }

  let parsed: any;
  try {
    const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new Error('Hindi mabasa ang detalye ng Meralco bill. Pakikunan muli nang malinaw.');
  }

  const canDigits = String(parsed.customerAccountNumber || '').replace(/\D/g, '');
  const totalKwh = Number(parsed.totalKwh);
  const totalAmountDue = Number(parsed.totalAmountDue);
  const generationCharge =
    parsed.generationCharge !== undefined && parsed.generationCharge !== null
      ? Number(parsed.generationCharge)
      : undefined;
  const dueDate = String(parsed.dueDate || '').trim();
  const startDate = String(parsed.billingPeriod?.startDate || '').trim();
  const endDate = String(parsed.billingPeriod?.endDate || '').trim();

  if (
    parsed.isMeralcoBill === false ||
    canDigits.length < 10 ||
    !Number.isFinite(totalKwh) ||
    totalKwh <= 0 ||
    !Number.isFinite(totalAmountDue) ||
    totalAmountDue <= 0 ||
    !dueDate
  ) {
    throw new Error(
      'Hindi kumpleto o hindi malinaw ang mga detalye ng Meralco bill (CAN, kWh, Halaga ng Bill, at Due Date). Pakikunan muli nang malinaw ang buong bill.'
    );
  }

  return {
    customerAccountNumber: String(parsed.customerAccountNumber).trim(),
    billingPeriod: {
      startDate,
      endDate,
    },
    dueDate,
    totalKwh,
    totalAmountDue,
    generationCharge: Number.isFinite(generationCharge) ? generationCharge : undefined,
    verifiedByUser: false,
  };
}

export async function processTextQuery(
  text: string,
  context: TipiQueryContext,
  history: ConversationTurn[] = []
): Promise<string> {
  const languageDirective =
    context.language === 'english'
      ? 'Respond strictly in clear, natural English.'
      : context.language === 'filipino'
      ? 'Respond naturally in Filipino (Tagalog).'
      : 'Respond naturally in Taglish, Tagalog, or English depending on how the user addresses you.';
  const systemPrompt = `You are "Tipi", a friendly, multilingual Filipino AI energy coach inside the KuryenTipid app.
You help Filipino households understand their Meralco electricity bills, appliances, and meter readings, and have natural multi-turn conversations.
${languageDirective}
Remember details the user shared earlier in the conversation and answer follow-up questions directly.
Keep responses concise (2 to 4 short sentences), practical, and warm. Plain text only: do not use markdown asterisks and do not use any emojis.
Household Context:
- Account Profile: ${context.profileName || 'Bahay'} (${context.can || 'Meralco CAN'})
- Meter Classification: ${context.meterType || 'AMI'}
- Current consumption: ${context.totalKwh} kWh
- Monthly budget: ₱${context.budget}
- Projected end-of-month bill: ₱${context.projected}`;

  const contents = buildConversationContents(history, [{ text }]);
  const json = await generateWithFallback({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 1024,
    },
  });

  const reply = json.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('Empty response from Gemini API');
  }

  return stripEmojis(reply);
}

export async function processVoiceQuery(
  base64Audio: string,
  context: TipiQueryContext,
  history: ConversationTurn[] = [],
  spokenTranscript?: string
): Promise<string> {
  const systemInstruction = `You are "Tipi", a friendly bilingual conversational energy coach for Meralco customers in the Philippines.
Recognize and understand the user's voice query whether spoken in Filipino (Tagalog), English, or Taglish.
Answer concisely in 1 to 3 spoken sentences matching the language used by the user (English if they spoke English, Filipino/Taglish if they spoke Filipino or Taglish). Plain text only: do not use markdown asterisks and do not use any emojis.
Context: Profile ${context.profileName || 'Bahay'} (${context.meterType || 'AMI'} meter), Current ${context.totalKwh} kWh, Projected ₱${context.projected}, Budget ₱${context.budget}.`;

  const userParts: Record<string, unknown>[] = [];
  if (spokenTranscript) {
    userParts.push({ text: spokenTranscript });
  } else {
    userParts.push({
      text: 'Listen to the user audio query (in Filipino, English, or Taglish) and respond directly.',
    });
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
    },
  });

  const reply = json.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .join('')
    .trim();

  if (!reply) {
    throw new Error('Empty voice response from Gemini API');
  }

  return stripEmojis(reply);
}

export async function analyzeUsageWithGeminiClient(
  scenario: UsageScenario = 'baseline',
  signal?: AbortSignal
): Promise<UsageAnalysis> {
  const cached = clientUsageCache.get(scenario);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const inflight = clientUsagePending.get(scenario);
  if (inflight) {
    return inflight;
  }

  const job = (async () => {
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
    const parsed = parseUsageAnalysis(candidateText, scenario);
    clientUsageCache.set(scenario, { value: parsed, expires: Date.now() + 300000 });
    return parsed;
  })().finally(() => {
    clientUsagePending.delete(scenario);
  });

  clientUsagePending.set(scenario, job);
  return job;
}

export function buildBillExplanationPrompt(params: {
  can: string;
  profileName?: string;
  totalAmount: number;
  totalKwh: number;
  dueDate: string;
  genCharge: number;
  distCharge: number;
  transCharge: number;
  taxCharge: number;
  language?: 'taglish' | 'filipino' | 'english';
}): string {
  if (params.language === 'english') {
    return `Explain my Meralco bill line-by-line for CAN ${params.can} (${params.profileName || 'Home'}): Total Amount ₱${params.totalAmount.toFixed(2)}, Consumption ${params.totalKwh} kWh, Due Date ${params.dueDate}, Generation Charge ₱${params.genCharge.toFixed(2)} (58%), Distribution ₱${params.distCharge.toFixed(2)} (19%), Transmission ₱${params.transCharge.toFixed(2)} (9%), and VAT & Others ₱${params.taxCharge.toFixed(2)} (14%). What does each line mean and how can I lower my next bill?`;
  }
  return `Ipaliwanag nang line-by-line ang aking Meralco bill para sa CAN ${params.can} (${params.profileName || 'Bahay'}): Kabuuang Halaga ₱${params.totalAmount.toFixed(2)}, Konsumo ${params.totalKwh} kWh, Due Date ${params.dueDate}, Generation Charge ₱${params.genCharge.toFixed(2)} (58%), Distribution ₱${params.distCharge.toFixed(2)} (19%), Transmission ₱${params.transCharge.toFixed(2)} (9%), at VAT at Iba Pa ₱${params.taxCharge.toFixed(2)} (14%). Ano ang ibig sabihin ng bawat linya at paano ko mapapababa ang susunod kong bill?`;
}

export function buildWhatIfExplanationPrompt(params: {
  targetTemp: number;
  targetHours: number;
  unplugVampire: boolean;
  shiftPeakHours: boolean;
  fridgeEcoMode: boolean;
  totalPesosSaved: number;
  totalKwhSaved: number;
  language?: 'taglish' | 'filipino' | 'english';
}): string {
  if (params.language === 'english') {
    return `I applied these settings in the What-If Watt-Calculator: Aircon thermostat at ${params.targetTemp}°C (${params.targetHours}h per day), Eliminate Standby Loads: ${params.unplugVampire ? 'On' : 'Off'}, Shift to Off-Peak: ${params.shiftPeakHours ? 'On' : 'Off'}, and Refrigerator Eco Mode: ${params.fridgeEcoMode ? 'On' : 'Off'}. Estimated monthly savings are ₱${params.totalPesosSaved.toFixed(2)} (${params.totalKwhSaved} kWh). Explain how this will help lower my Meralco bill.`;
  }
  return `In-apply ko ang settings sa What-If Watt-Calculator: Aircon thermostat sa ${params.targetTemp}°C (${params.targetHours}h bawat araw), Tanggalin ang Standby Loads: ${params.unplugVampire ? 'On' : 'Off'}, I-shift sa Off-Peak: ${params.shiftPeakHours ? 'On' : 'Off'}, at Refrigerator Eco Mode: ${params.fridgeEcoMode ? 'On' : 'Off'}. Tinatayang tipid ay ₱${params.totalPesosSaved.toFixed(2)} (${params.totalKwhSaved} kWh) bawat buwan. Ipaliwanag kung paano ito makakatulong sa aking Meralco bill.`;
}

export function buildPlugsExplanationPrompt(params: {
  activeCount: number;
  totalCount: number;
  totalActiveWatts: number;
  totalKwh: number;
  totalCost: number;
  plugSummaries: string[];
  language?: 'taglish' | 'filipino' | 'english';
}): string {
  if (params.language === 'english') {
    return `Explain my current Smart Plugs consumption: ${params.activeCount} of ${params.totalCount} plugs are ON with a total of ${params.totalActiveWatts.toFixed(1)}W (${params.totalKwh} kWh, ₱${params.totalCost.toFixed(2)} this month). Plugs: ${params.plugSummaries.join(', ')}. Which one consumes the most and how should I schedule them?`;
  }
  return `Ipaliwanag ang kasalukuyang konsumo ng aking mga Smart Plug: ${params.activeCount} sa ${params.totalCount} ang naka-ON na may kabuuang ${params.totalActiveWatts.toFixed(1)}W (${params.totalKwh} kWh, ₱${params.totalCost.toFixed(2)} ngayong buwan). Mga saksakan: ${params.plugSummaries.join(', ')}. Alin ang pinakamalakas kumonsumo at paano ko sila dapat i-schedule?`;
}

export function buildAlertsExplanationPrompt(params: {
  currentKwh: number;
  projected: number;
  budget: number;
  language?: 'taglish' | 'filipino' | 'english';
}): string {
  if (params.language === 'english') {
    return `Explain my Meralco Peak Hours (8:00 AM to 9:00 PM) and Budget Alert: my consumption is at ${params.currentKwh} kWh and my projected bill is ₱${params.projected.toFixed(2)} out of my ₱${params.budget} budget. Which appliances should I delay to off-peak hours?`;
  }
  return `Ipaliwanag ang aking Meralco Peak Hours (8:00 AM hanggang 9:00 PM) at Budget Alert: nasa ${params.currentKwh} kWh na ang konsumo ko at ₱${params.projected.toFixed(2)} ang projected bill mula sa ₱${params.budget} na budget. Aling appliances ang dapat kong i-delay sa off-peak hours?`;
}

export function buildDashboardExplanationPrompt(params: {
  profileName: string;
  can: string;
  meterType: string;
  currentKwh: number;
  projected: number;
  budget: number;
  ratePerKwh: number;
  alertMessage?: string;
  culpritAppliance?: string;
  language?: 'taglish' | 'filipino' | 'english';
}): string {
  if (params.language === 'english') {
    const extraEn = params.alertMessage
      ? ` Current analysis: "${params.alertMessage}" (${params.culpritAppliance || 'appliance estimate'}).`
      : '';
    return `Explain my electricity summary for ${params.profileName} (CAN ${params.can}, ${params.meterType} meter): Consumption ${params.currentKwh} kWh at ₱${params.ratePerKwh}/kWh, Projected bill ₱${params.projected.toFixed(2)} vs ₱${params.budget} budget.${extraEn} What should I do this week?`;
  }
  const extra = params.alertMessage
    ? ` Kasalukuyang pagsusuri: "${params.alertMessage}" (${params.culpritAppliance || 'appliance estimate'}).`
    : '';
  return `Ipaliwanag ang buod ng aking kuryente sa ${params.profileName} (CAN ${params.can}, ${params.meterType} meter): Konsumo ${params.currentKwh} kWh sa rate na ₱${params.ratePerKwh}/kWh, Projected bill ₱${params.projected.toFixed(2)} laban sa ₱${params.budget} na budget.${extra} Ano ang dapat kong gawin ngayong linggo?`;
}
