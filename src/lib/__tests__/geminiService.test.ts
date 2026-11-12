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
});
