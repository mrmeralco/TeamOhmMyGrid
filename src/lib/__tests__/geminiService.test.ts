import { processTextQuery, processVoiceQuery, parseMeralcoBillImage } from '../geminiService';

describe('Gemini Service Client / Offline Fallbacks', () => {
  const context = { totalKwh: 215, budget: 3500, projected: 3200 };

  describe('processTextQuery', () => {
    it('returns canned response for predefined question chips', async () => {
      const res = await processTextQuery('Bakit lumobo ang Aircon ko?', context);
      expect(res).toContain('AC');
    });

    it('returns intelligent offline tip for aircon query when API key is unset', async () => {
      const res = await processTextQuery('Magkano matitipid ko sa inverter aircon 24C?', context);
      expect(res).toContain('24°C');
    });

    it('returns line-by-line breakdown response when asking to breakdown bill', async () => {
      const res = await processTextQuery('Himayin ang bill ko', context);
      expect(res).toContain('Generation');
    });

    it('returns ₱500 saving tips when asking paano makakatipid ng 500', async () => {
      const res = await processTextQuery('Paano makakatipid ng 500 pesos?', context);
      expect(res).toContain('500');
    });

    it('returns peak hours alert information when inquiring about peak hours', async () => {
      const res = await processTextQuery('Kailan ang peak hours ng kuryente?', context);
      expect(res).toContain('Luzon Grid');
    });

    it('returns friendly default coaching message for unknown general greeting', async () => {
      const res = await processTextQuery('Kamusta Tipi', context);
      expect(res).toContain('Tipi');
      expect(res).toContain('215 kWh');
    });
  });

  describe('processVoiceQuery', () => {
    it('returns friendly voice query fallback with contextual figures when API key is unset', async () => {
      const res = await processVoiceQuery('dummy-base64-audio', context);
      expect(res).toContain('boses');
      expect(res).toContain('3,200');
      expect(res).toContain('215 kWh');
    });
  });

  describe('parseMeralcoBillImage', () => {
    it('returns structured Meralco bill data fallback when API key is unset', async () => {
      const bill = await parseMeralcoBillImage('dummy-base64-bill');
      expect(bill.customerAccountNumber).toBe('123456789012');
      expect(bill.totalKwh).toBe(215);
      expect(bill.totalAmountDue).toBe(2450.5);
      expect(bill.verifiedByUser).toBe(false);
    });
  });

  describe('Multi-turn Gemini Conversation with API key', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.ENABLE_GEMINI_IN_TEST = '1';
      process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-gemini-key';
    });

    afterEach(() => {
      global.fetch = originalFetch;
      delete process.env.ENABLE_GEMINI_IN_TEST;
    });

    it('sends prior user and model conversation turns in contents and returns AI response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Oo Juan, tanda ko ang 1.5HP aircon mo sa Bahay!' }],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      const history = [
        { sender: 'tipi' as const, text: 'Kamusta! Ako si Tipi.' },
        { sender: 'user' as const, text: 'Ako si Juan, 1.5HP ang aircon ko.' },
        { sender: 'tipi' as const, text: 'Nice to meet you Juan! Matipid ba ang 1.5HP aircon mo?' },
      ];

      const reply = await processTextQuery(
        'Naaalala mo ba kung ilang HP ang aircon ko?',
        { ...context, meterType: 'AMI', can: '0192-8823-4410', profileName: 'Bahay' },
        history
      );

      expect(reply).toBe('Oo Juan, tanda ko ang 1.5HP aircon mo sa Bahay!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload.contents).toEqual([
        { role: 'user', parts: [{ text: 'Ako si Juan, 1.5HP ang aircon ko.' }] },
        { role: 'model', parts: [{ text: 'Nice to meet you Juan! Matipid ba ang 1.5HP aircon mo?' }] },
        { role: 'user', parts: [{ text: 'Naaalala mo ba kung ilang HP ang aircon ko?' }] },
      ]);
      expect(payload.systemInstruction.parts[0].text).toContain('Bahay');
    });

    it('falls back to secondary Gemini model when primary returns 503', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Sagot mula sa fallback model.' }] } }],
          }),
        });
      global.fetch = mockFetch as any;

      const reply = await processTextQuery('Ano ang konsumo ko?', context, []);
      expect(reply).toBe('Sagot mula sa fallback model.');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
