import React, { useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { MeterIllustration } from '../components/MeterIllustration';
import { analyzeMeter, MeterType, saveMeterReading, validReading } from '../services/meterService';

export default function MeterReadingScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [language, setLanguage] = useState<'en' | 'tl' | null>(null);
  const [type, setType] = useState<MeterType>('analog');
  const [stage, setStage] = useState<'capture' | 'manual' | 'review' | 'saved'>('capture');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [digital, setDigital] = useState('');
  const [active, setActive] = useState(3);
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputs = useRef<Array<React.ElementRef<typeof TextInput> | null>>([]);
  const lock = useRef(false);
  const tl = language === 'tl';
  const t = (en: string, tagalog: string) => tl ? tagalog : en;
  const reading = type === 'analog' ? digits.join('') : digital;
  const complete = validReading(reading, type);
  const manual = () => { setStage('manual'); setActive(3); };

  async function capture(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setNotice(t('Camera permission is needed. You can upload a photo or enter the reading manually.', 'Kailangan ng pahintulot sa camera. Maaari kang mag-upload o manu-manong maglagay ng basa.'));
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.7 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto(asset.uri); setDigits(['', '', '', '']); setDigital('');
      if (!asset.base64 || asset.base64.length > 8_000_000) {
        manual(); setNotice(t('This photo cannot be processed. Use a smaller photo or the manual guide.', 'Hindi maproseso ang litrato. Gumamit ng mas maliit na litrato o ng manwal na gabay.')); return;
      }
      try {
        const value = await analyzeMeter(asset.base64, type);
        if (value === null) {
          manual(); setNotice(t('Your photo is not readable. Please follow the manual input guide below.', 'Hindi mabasa ang iyong litrato. Sundin ang gabay sa manwal sa ibaba.'));
        } else {
          if (type === 'analog') setDigits(value.split('')); else setDigital(value);
          setStage('review');
        }
      } catch {
        manual(); setNotice(t('Automatic reading is unavailable. Please follow the manual input guide below.', 'Hindi magamit ang awtomatikong pagbasa. Sundin ang gabay sa manwal sa ibaba.'));
      }
    } catch {
      setNotice(t('Could not open the photo. Try again, upload an image, or use manual entry.', 'Hindi mabuksan ang litrato. Subukan muli, mag-upload, o gumamit ng manwal na paglagay.'));
    } finally { lock.current = false; setBusy(false); }
  }

  async function submit() {
    if (!complete || !user || lock.current) return;
    lock.current = true; setBusy(true);
    try { await saveMeterReading(user.id, reading, type); setStage('saved'); }
    catch { setNotice(t('The reading could not be saved. Please try again.', 'Hindi na-save ang basa. Pakisubukan muli.')); }
    finally { lock.current = false; setBusy(false); }
  }
  if (isLoading) return <ActivityIndicator />;
  if (!user?.isEmailVerified) return <Redirect href="/login" />;
  const button = (label: string, action: () => void, secondary = false, disabled = busy) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></TouchableOpacity>;

  return <SafeAreaView style={styles.page}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {button(t('← Dashboard', '← Dashboard'), () => router.replace('/dashboard'), true)}
      <Text style={styles.eyebrow}>KURYENTIPID</Text>
      <Text style={styles.title}>{t('Read your meter', 'Basahin ang iyong metro')}</Text>
      <Text style={styles.heading}>Choose your language / Piliin ang wika</Text>
      <View style={styles.row}>{(['en', 'tl'] as const).map(lang => <TouchableOpacity key={lang} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: language === lang, disabled: busy }} onPress={() => setLanguage(lang)} style={[styles.language, language === lang && styles.selected]}><Text style={styles.body}>{lang === 'en' ? 'English' : 'Tagalog'}</Text></TouchableOpacity>)}</View>
      {language && <>
        <Text style={styles.heading}>{t('Meter type', 'Uri ng metro')}</Text>
        <View style={styles.row}>{(['analog', 'digital'] as const).map(kind => <TouchableOpacity key={kind} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: type === kind, disabled: busy }} style={[styles.language, type === kind && styles.selected]} onPress={() => { setType(kind); setStage('capture'); setDigits(['', '', '', '']); setDigital(''); setPhoto(''); setActive(3); }}><Text style={styles.body}>{kind === 'analog' ? t('Analog · 4 dials', 'Analog · 4 na dayal') : 'Digital'}</Text></TouchableOpacity>)}</View>
        <MeterIllustration digital={type === 'digital'} active={stage === 'manual' ? active : -1} value={digital} tagalog={tl} />
        <Text style={styles.body}>{t('Digital meter? Simply read the numbers directly from the digital display screen.', 'Digital ang metro? Basahin lamang ang mga numero sa digital display.')}</Text>
        {stage === 'capture' && <View style={styles.card}>
          <Text style={styles.heading}>{t('Take a clear photo', 'Kumuha ng malinaw na litrato')}</Text>
          <Text style={styles.body}>{t('Keep the whole meter display in focus, face it straight on, and avoid glare. Your photo is sent for automated analysis.', 'Isama ang buong display, itapat ang camera, at iwasan ang silaw. Ipapadala ang litrato para sa awtomatikong pagsusuri.')}</Text>
          {button(t('Take photo', 'Kumuha ng litrato'), () => { void capture(true); })}
          {button(t('Upload photo', 'Mag-upload ng litrato'), () => { void capture(false); }, true)}
          {button(t('Use manual guide', 'Gamitin ang manwal na gabay'), manual, true)}
        </View>}
        {busy && <View accessibilityLiveRegion="polite"><ActivityIndicator color="#b45309" /><Text style={styles.body}>{t('Please wait…', 'Sandali lang…')}</Text></View>}
        {!!photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" accessibilityLabel={t('Your meter photo', 'Litrato ng iyong metro')} />}
        {stage === 'manual' && <View style={styles.card}>
          <Text style={styles.heading}>{type === 'analog' ? t(`Step ${4 - active} of 4 · ${active === 3 ? 'Rightmost dial' : active === 0 ? 'Leftmost dial' : 'Next dial to the left'}`, `Hakbang ${4 - active} sa 4 · ${active === 3 ? 'Pinakakanang dayal' : active === 0 ? 'Pinakakaliwang dayal' : 'Susunod na dayal sa kaliwa'}`) : t('Enter the digital display', 'Ilagay ang basa sa digital display')}</Text>
          {type === 'analog' && <>
            <Text style={styles.body}>{t('Read from right to left. Between 2 and 3, enter 2. Before 6, it is still 5: use the number the hand has passed in its rotation direction. Between 9 and 0, use 9.', 'Basahin mula kanan pakaliwa. Sa pagitan ng 2 at 3, ilagay ang 2. Bago ang 6, 5 pa rin: gamitin ang numerong nalampasan ayon sa ikot ng karayom. Sa pagitan ng 9 at 0, gamitin ang 9.')}</Text>
            <Text style={styles.body}>{t('Exactly on a number? Check the dial immediately to its right: if it has not passed 0, use the previous number. If it has passed 0, use the pointed number. For the rightmost dial, record the pointed number.', 'Eksakto sa numero? Tingnan ang dayal sa kanan nito: kung hindi pa lumampas sa 0, gamitin ang naunang numero. Kung lumampas na sa 0, gamitin ang tinuturo. Sa pinakakanang dayal, gamitin ang tinuturo.')}</Text>
            <Text style={styles.hint}>{t('Illustrations are examples. Follow the number order on your own meter. Each digit advances to the left automatically.', 'Halimbawa lamang ang mga larawan. Sundin ang ayos ng numero sa iyong metro. Awtomatikong lilipat pakaliwa matapos ang bawat digit.')}</Text>
          </>}
        </View>}
        {(stage === 'manual' || stage === 'review') && <View style={styles.card}>
          <Text style={styles.heading}>{t('Review your reading', 'Suriin ang iyong basa')}</Text>
          <Text style={styles.body}>{t('Check every digit against your meter before submitting. The complete reading is displayed in its normal left-to-right order.', 'Ihambing ang bawat digit sa metro bago isumite. Ang buong basa ay ipinapakita sa karaniwang ayos mula kaliwa pakanan.')}</Text>
          {type === 'analog' ? <View style={styles.row}>{digits.map((digit, index) => <View key={index} style={{ flex: 1 }}><Text style={styles.hint}>{t('Dial', 'Dayal')} {4 - index}</Text><TextInput ref={ref => { inputs.current[index] = ref; }} accessibilityLabel={`${t('Dial', 'Dayal')} ${4 - index}`} value={digit} editable={!busy} keyboardType="number-pad" maxLength={1} selectTextOnFocus onFocus={() => setActive(index)} style={[styles.input, active === index && styles.selected]} onChangeText={text => {
            if (!/^\d?$/.test(text)) return;
            const next = [...digits]; next[index] = text; setDigits(next);
            if (text && stage === 'manual') { const target = index > 0 ? index - 1 : next.findIndex(v => !v); if (target >= 0) { setActive(target); inputs.current[target]?.focus(); } else { setStage('review'); inputs.current[index]?.blur(); } }
          }} /></View>)}</View> : <TextInput accessibilityLabel={t('Digital reading in kWh', 'Digital na basa sa kWh')} editable={!busy} keyboardType="decimal-pad" value={digital} onChangeText={setDigital} maxLength={12} placeholder="01234" style={styles.input} />}
          <Text accessibilityLiveRegion="polite" style={styles.reading}>{complete ? `${reading} kWh` : t('Enter all digits to continue', 'Ilagay ang lahat ng digit upang magpatuloy')}</Text>
          {stage === 'manual' ? button(t('Review reading', 'Suriin ang basa'), () => setStage('review'), false, busy || !complete) : button(t('Submit Reading', 'Isumite ang Basa'), () => { void submit(); }, false, busy || !complete)}
          {button(t('Retake photo', 'Kumuha muli ng litrato'), () => setStage('capture'), true)}
        </View>}
        {stage === 'saved' && <View style={styles.card}><Text style={styles.heading}>{t('Reading saved on this device', 'Na-save ang basa sa device na ito')}</Text><Text style={styles.reading}>{reading} kWh</Text>{button(t('New reading', 'Bagong basa'), () => { setStage('capture'); setDigits(['', '', '', '']); setDigital(''); setPhoto(''); })}</View>}
      </>}
    </ScrollView>
    <Modal visible={!!notice} transparent animationType="fade" onRequestClose={() => setNotice('')}><View style={styles.overlay}><View style={styles.modal} accessibilityViewIsModal><Text accessibilityRole="alert" style={styles.body}>{notice}</Text>{button(t('Continue', 'Magpatuloy'), () => setNotice(''), false, false)}</View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffcf0' }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, gap: 16, paddingBottom: 48 },
  eyebrow: { fontSize: 12, letterSpacing: 3, color: '#a16207', fontWeight: '700' }, title: { fontSize: 32, fontWeight: '800', color: '#422006' },
  heading: { fontSize: 19, fontWeight: '700', color: '#422006' }, body: { fontSize: 16, lineHeight: 25, color: '#57452c' }, hint: { fontSize: 13, lineHeight: 20, color: '#715d41' },
  row: { flexDirection: 'row', gap: 8 }, language: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e5d4a8', borderRadius: 12, backgroundColor: '#fff' }, selected: { borderColor: '#b45309', backgroundColor: '#fde68a' },
  card: { padding: 18, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eee2c4', gap: 14 },
  button: { padding: 15, borderRadius: 12, backgroundColor: '#92400e', alignItems: 'center' }, secondary: { backgroundColor: '#fef3c7' }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' }, secondaryText: { color: '#78350f' }, disabled: { opacity: 0.45 },
  input: { borderWidth: 2, borderColor: '#d6c8a5', borderRadius: 12, padding: 14, fontSize: 25, color: '#422006', textAlign: 'center' }, reading: { fontSize: 23, fontWeight: '700', color: '#78350f', textAlign: 'center' }, photo: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#fef3c7' },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 24, borderRadius: 18, backgroundColor: '#fff', gap: 20 },
});
