import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export type MeterType = 'analog' | 'digital';
export function validReading(value: string, type: MeterType) {
  return type === 'analog' ? /^\d{4}$/.test(value) : /^\d{1,8}(\.\d{1,3})?$/.test(value);
}
export async function analyzeMeter(base64: string, type: MeterType) {
  if (!supabase) throw new Error('unavailable');
  const { data, error } = await supabase.functions.invoke('analyze-meter', { body: { image: base64, meterType: type } });
  if (error || !data || typeof data.readable !== 'boolean') throw new Error('unavailable');
  if (!data.readable) return null;
  if (typeof data.reading !== 'string' || !validReading(data.reading, type)) return null;
  return data.reading as string;
}
// Store on this device, scoped to the signed-in account. Photos are not persisted.
export async function saveMeterReading(userId: string, reading: string, type: MeterType) {
  if (!validReading(reading, type)) throw new Error('invalid');
  await AsyncStorage.setItem(`meter-reading:${userId}`, JSON.stringify({ reading, type, recordedAt: new Date().toISOString() }));
}
