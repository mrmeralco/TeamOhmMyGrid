import {
  processTextQuery,
  processVoiceQuery,
  parseMeralcoBillImage,
  buildBillExplanationPrompt,
  buildWhatIfExplanationPrompt,
  buildPlugsExplanationPrompt,
  buildAlertsExplanationPrompt,
  buildDashboardExplanationPrompt,
} from '../geminiService';
import {
  detectSpeechLanguage,
  normalizeSpeechText,
  speakResponse,
  scoreVoiceNaturalness,
  togglePauseSpeaking,
  stopSpeaking,
  getTtsState,
} from '../audioService';
import * as Speech from 'expo-speech';

describe('Gemini Service Client (Live Gemini API & Multi-turn Conversation)', () => {
  const context = {
    totalKwh: 215,
    budget: 3500,
    projected: 3200,
    meterType: 'AMI' as const,
    can: '0192-8823-4410',
    profileName: 'Bahay',
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ENABLE_GEMINI_IN_TEST = '1';
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-gemini-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ENABLE_GEMINI_IN_TEST;
  });

  describe('processTextQuery', () => {
    it('calls Gemini API with household context and strips emojis from output', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '💡 Kapag ginawa mong 24°C ang aircon, makakatipid ka ng ₱482 bawat buwan.',
                  },
                ],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      const reply = await processTextQuery('Magkano matitipid ko sa inverter aircon 24C?', context);
      expect(reply).toBe(
        'Kapag ginawa mong 24°C ang aircon, makakatipid ka ng ₱482 bawat buwan.'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('gemini-3.1-flash-lite:generateContent');
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
        context,
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

    it('throws when API key is disabled in test environment (no premade fallback)', async () => {
      delete process.env.ENABLE_GEMINI_IN_TEST;
      await expect(processTextQuery('Kamusta Tipi', context)).rejects.toThrow(
        'Missing Gemini API key'
      );
    });
  });

  describe('processVoiceQuery', () => {
    it('sends base64 audio to Gemini API and returns plain text reply', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Narinig ko ang tanong mo tungkol sa 215 kWh konsumo mo.' }],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      const res = await processVoiceQuery('dummy-base64-audio', context);
      expect(res).toBe('Narinig ko ang tanong mo tungkol sa 215 kWh konsumo mo.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseMeralcoBillImage', () => {
    it('extracts and verifies required Meralco bill fields via Gemini Vision API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isMeralcoBill: true,
                      customerAccountNumber: '0192882344',
                      billingPeriod: { startDate: '2026-04-15', endDate: '2026-05-14' },
                      dueDate: '2026-05-25',
                      totalKwh: 310,
                      totalAmountDue: 3543.3,
                      generationCharge: 2055.11,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      const bill = await parseMeralcoBillImage('valid-base64-bill-image');
      expect(bill.customerAccountNumber).toBe('0192882344');
      expect(bill.totalKwh).toBe(310);
      expect(bill.totalAmountDue).toBe(3543.3);
      expect(bill.generationCharge).toBe(2055.11);
      expect(bill.dueDate).toBe('2026-05-25');
      expect(bill.verifiedByUser).toBe(false);
    });

    it('rejects non-bill images or missing required fields instead of returning premade fallback data', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isMeralcoBill: false,
                      customerAccountNumber: '',
                      billingPeriod: { startDate: '', endDate: '' },
                      dueDate: '',
                      totalKwh: 0,
                      totalAmountDue: 0,
                      generationCharge: 0,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      await expect(parseMeralcoBillImage('random-photo-base64')).rejects.toThrow(
        /Meralco bill/i
      );
    });

    it('throws when Gemini Vision API fails instead of returning premade bill data', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch as any;

      await expect(parseMeralcoBillImage('corrupt-image-base64')).rejects.toThrow();
    });
  });

  describe('Bilingual Filipino & English TTS language detection', () => {
    it('recognizes Filipino and Taglish sentences as fil-PH and English sentences as en-PH', () => {
      expect(
        detectSpeechLanguage('Kapag ginawa mong 24°C ang aircon, makakatipid ka ng ₱482 bawat buwan.')
      ).toBe('fil-PH');
      expect(
        detectSpeechLanguage('Your projected electricity bill this month is ₱2,840 for 215 kWh.')
      ).toBe('en-PH');
    });

    it('normalizes peso, kWh, and Celsius symbols for natural pronunciation in both languages', () => {
      expect(normalizeSpeechText('Projected bill is ₱2,840 at 215 kWh and 24°C.')).toBe(
        'Projected bill is 2,840 pesos at 215 kilowatt hours and 24 degrees Celsius.'
      );
    });

    it('falls back to an installed voice when fil-PH voice is not installed on the OS so TTS never goes silent, and never hangs if getAvailableVoicesAsync stalls', async () => {
      const speakSpy = jest.spyOn(Speech, 'speak').mockImplementation(() => {});
      jest.spyOn(Speech, 'isSpeakingAsync').mockResolvedValue(false);
      (Speech as any).getAvailableVoicesAsync = jest.fn().mockResolvedValue([
        { identifier: 'ms-zira-en-us', name: 'Microsoft Zira', language: 'en-US' },
      ]);

      await speakResponse('Ang iyong konsumo ay ₱2,450.50 para sa 215 kWh.');

      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][1]).toMatchObject({
        language: 'en-US',
        voice: 'ms-zira-en-us',
      });

      // Simulate web ExponentSpeech.getVoices() never resolving when onvoiceschanged already fired
      (Speech as any).getAvailableVoicesAsync = jest.fn().mockReturnValue(new Promise(() => {}));
      await speakResponse('Hello, your bill is 2,450 pesos.');
      expect(speakSpy).toHaveBeenCalledTimes(2);
      speakSpy.mockRestore();
    });

    it('ranks neural/natural voices above robotic Desktop voices and supports pause/resume/stop TTS state', async () => {
      const naturalFil = scoreVoiceNaturalness(
        { name: 'Microsoft Blessica Online (Natural) - Filipino', language: 'fil-PH', localService: false },
        'fil-PH'
      );
      const roboticDesktop = scoreVoiceNaturalness(
        { name: 'Microsoft David Desktop - English (United States)', language: 'en-US', localService: true },
        'fil-PH'
      );
      expect(naturalFil).toBeGreaterThan(roboticDesktop);

      const speakSpy = jest.spyOn(Speech, 'speak').mockImplementation(() => {});
      const pauseSpy = jest.spyOn(Speech, 'pause').mockResolvedValue();
      const resumeSpy = jest.spyOn(Speech, 'resume').mockResolvedValue();
      const stopSpy = jest.spyOn(Speech, 'stop').mockResolvedValue();
      jest.spyOn(Speech, 'isSpeakingAsync').mockResolvedValue(false);

      await speakResponse('Kamusta, ako si Tipi.');
      expect(getTtsState().state).toBe('playing');

      const pausedState = await togglePauseSpeaking('Kamusta, ako si Tipi.');
      expect(pausedState).toBe('paused');
      expect(getTtsState().state).toBe('paused');
      expect(pauseSpy).toHaveBeenCalled();

      const resumedState = await togglePauseSpeaking('Kamusta, ako si Tipi.');
      expect(resumedState).toBe('playing');
      expect(getTtsState().state).toBe('playing');
      expect(resumeSpy).toHaveBeenCalled();

      stopSpeaking();
      expect(getTtsState().state).toBe('idle');
      expect(stopSpy).toHaveBeenCalled();

      speakSpy.mockRestore();
      pauseSpy.mockRestore();
      resumeSpy.mockRestore();
      stopSpy.mockRestore();
    });

    it('builds complete explanation prompts for Bill, What-If, Smart Plugs, Alerts, and Dashboard handoffs to Tipi AI', () => {
      const billPrompt = buildBillExplanationPrompt({
        can: '0192-8823-4410',
        profileName: 'Bahay',
        totalAmount: 2450.5,
        totalKwh: 215,
        dueDate: '2026-05-25',
        genCharge: 1421.29,
        distCharge: 465.6,
        transCharge: 220.55,
        taxCharge: 343.06,
      });
      expect(billPrompt).toContain('0192-8823-4410');
      expect(billPrompt).toContain('215 kWh');
      expect(billPrompt).toContain('1421.29');
      expect(billPrompt).toContain('line-by-line');

      const whatIfPrompt = buildWhatIfExplanationPrompt({
        targetTemp: 24,
        targetHours: 8,
        unplugVampire: true,
        shiftPeakHours: true,
        fridgeEcoMode: false,
        totalPesosSaved: 737.0,
        totalKwhSaved: 64.5,
      });
      expect(whatIfPrompt).toContain('24°C');
      expect(whatIfPrompt).toContain('737.00');

      const plugsPrompt = buildPlugsExplanationPrompt({
        activeCount: 2,
        totalCount: 4,
        totalActiveWatts: 1053.0,
        totalKwh: 85.4,
        totalCost: 976.12,
        plugSummaries: ['Inverter Aircon (ON, 920W, ₱650/mo)'],
      });
      expect(plugsPrompt).toContain('1053.0W');
      expect(plugsPrompt).toContain('Inverter Aircon');

      const alertsPrompt = buildAlertsExplanationPrompt({
        currentKwh: 215,
        projected: 2840,
        budget: 3500,
      });
      expect(alertsPrompt).toContain('8:00 AM');
      expect(alertsPrompt).toContain('2840.00');

      const dashboardPrompt = buildDashboardExplanationPrompt({
        profileName: 'Bahay',
        can: '0192-8823-4410',
        meterType: 'AMI',
        currentKwh: 215,
        projected: 2840,
        budget: 3500,
        ratePerKwh: 11.43,
        alertMessage: 'Pasok sa budget.',
        culpritAppliance: 'Possible aircon',
      });
      expect(dashboardPrompt).toContain('Bahay');
      expect(dashboardPrompt).toContain('AMI');
      expect(dashboardPrompt).toContain('Pasok sa budget.');
    });
  });
});
