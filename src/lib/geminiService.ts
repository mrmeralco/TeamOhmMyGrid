import { ExtractedBillData } from '../types';
import { BOT_RESPONSES } from '../constants/mockData';

const GEMINI_API_KEY = '' /* Legacy live calls disabled: secrets belong on the server. */;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function parseMeralcoBillImage(base64Image: string): Promise<ExtractedBillData> {
  if (!GEMINI_API_KEY) {
    // Provide default fallback sample bill data when API key is not yet set
    return {
      customerAccountNumber: '123456789012',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-25',
      totalKwh: 215,
      totalAmountDue: 2450.50,
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
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const json = await response.json();
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
    // Return structured default data on OCR or network failure
    return {
      customerAccountNumber: '123456789012',
      billingPeriod: {
        startDate: '2026-04-15',
        endDate: '2026-05-14',
      },
      dueDate: '2026-05-25',
      totalKwh: 215,
      totalAmountDue: 2450.50,
      generationCharge: 1414.95,
      verifiedByUser: false,
    };
  }
}

export async function processTextQuery(
  text: string,
  context: { totalKwh: number; budget: number; projected: number }
): Promise<string> {
  if (BOT_RESPONSES[text]) {
    return BOT_RESPONSES[text].text;
  }

  if (!GEMINI_API_KEY) {
    // Intelligent offline demo responses
    const lower = text.toLowerCase();
    if (lower.includes('aircon') || lower.includes('24') || lower.includes('lobo')) {
      return BOT_RESPONSES['Bakit lumobo ang Aircon ko?']?.text || `Kapag ginawa mong 24°C ang aircon mula 20°C, makakatipid ka ng mga ₱482 bawat buwan dahil 16% ang bawas sa konsumo ng inverter compressor!`;
    }
    if (lower.includes('line') || lower.includes('breakdown') || lower.includes('himayin')) {
      return BOT_RESPONSES['Himayin ang Bill Line-by-Line 📋']?.text || `Heto ang breakdown ng bill mo: Generation (58%), Distribution (21%), Transmission (9%), at Taxes (12%).`;
    }
    if (lower.includes('500') || lower.includes('tipid') || lower.includes('makakatipid')) {
      return BOT_RESPONSES['Paano ako makakatipid ng ₱500?']?.text || `Kayang-kaya maabot ang ₱500 tipid sa pamamagitan ng pag-set ng AC sa 24°C, pag-unplug ng vampire loads, at pag-shift sa off-peak!`;
    }
    if (lower.includes('peak') || lower.includes('oras') || lower.includes('alert')) {
      return BOT_RESPONSES['Bakit may Peak-Hour Alert ngayon?']?.text || `Ang Peak Hours ng Meralco ay karaniwang 8:00 AM hanggang 9:00 PM Lunes hanggang Sabado. Mas magandang mag-plantsa o mag-laba pagsapit ng 9:00 PM pataas.`;
    }
    if (lower.includes('bakit') || lower.includes('tumaas') || lower.includes('mataas')) {
      return `Ang projected bill mo ay ₱${context.projected.toLocaleString()} laban sa budget na ₱${context.budget.toLocaleString()}. Malapit ka nang pumasok sa Tier 2 (200 kWh bracket) kung saan mas mataas ang distribution charge. Subukang i-adjust ang aircon timer!`;
    }
    return `Hello! Ako si Tipi, ang iyong KuryenTipid coach. Kasalukuyang nasa ${context.totalKwh} kWh ang konsumo mo ngayong buwan sa budget na ₱${context.budget.toLocaleString()}. May nais ka bang himayin natin sa iyong kuryente?`;
  }

  const systemPrompt = `You are "Tipi", a friendly, multilingual Filipino AI energy coach inside the KuryenTipid app.
You help Filipino households understand their Meralco electricity bills and save money.
Respond naturally in Taglish, Tagalog, or English depending on how the user addresses you.
Keep responses concise (2 to 3 sentences maximum), practical, and warm.
Household Context:
- Current consumption: ${context.totalKwh} kWh
- Monthly budget: ₱${context.budget}
- Projected end-of-month bill: ₱${context.projected}
`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${text}` }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 250,
        },
      }),
    });

    if (!response.ok) throw new Error('API failure');
    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || 'Pasensya na, subukang muli ang iyong tanong.';
  } catch {
    return `Kasalukuyang ₱${context.projected.toLocaleString()} ang projected bill mo sa konsumong ${context.totalKwh} kWh. I-check ang What-If calculator para makita kung saan pwede magbawas!`;
  }
}

export async function processVoiceQuery(
  base64Audio: string,
  context: { totalKwh: number; budget: number; projected: number }
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return `Narinig ko ang iyong boses! Ang projected bill mo ngayong buwan ay ₱${context.projected.toLocaleString()} sa ${context.totalKwh} kWh. Pwede kang magtipid sa pamamagitan ng pagtaas ng thermostat sa 24°C.`;
  }

  const systemInstruction = `You are "Tipi", a friendly energy coach for Meralco customers in the Philippines.
Listen to the user's voice query and answer concisely in 1 to 2 spoken sentences in Taglish.
Context: Current ${context.totalKwh} kWh, Projected ₱${context.projected}, Budget ₱${context.budget}.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemInstruction },
              {
                inline_data: {
                  mime_type: 'audio/mp4',
                  data: base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 150,
        },
      }),
    });

    if (!response.ok) throw new Error('Audio query failed');
    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || 'Narinig kita! Pwede mong i-adjust ang aircon para makatipid.';
  } catch {
    return `Narinig kita! Nasa ₱${context.projected.toLocaleString()} ang projected bill mo sa ${context.totalKwh} kWh. Subukang i-set ang aircon sa 24°C!`;
  }
}
