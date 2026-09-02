import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthButton, authColors, authStyles } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';

const presets = ['Nuts', 'Dairy', 'Eggs', 'Seafood'];

export default function AllergiesScreen() {
  const router = useRouter();
  const { email } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState('');

  const toggle = (item: string) => {
    setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  const addOther = () => {
    const value = otherText.trim();
    if (value && !selected.includes(value)) setSelected((current) => [...current, value]);
    setOtherText('');
    setShowOtherInput(false);
  };

  const customEntries = selected.filter((item) => !presets.includes(item));
  const visiblePresets = presets.filter((item) => item.toLowerCase().includes(search.toLowerCase()));

  const next = async () => {
    if (email) await saveOnboardingValue(email, 'allergy', selected.join(', '));
    router.push('/onboarding/activity');
  };

  return <View style={[authStyles.screen, styles.screen]}>
    <Progress />
    <Text style={styles.back} onPress={() => router.back()}>‹  Back</Text>
    <Text style={styles.title}>Any allergies or{`\n`}ingredients to avoid?</Text>
    <Text style={styles.subtitle}>This helps us recommend safer meals and avoid ingredients that may affect your health. Select as many as apply.</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder="⌕   Search" placeholderTextColor="#899AB2" style={styles.search} />
    <View style={styles.grid}>
      {visiblePresets.map((item) => (
        <Text key={item} onPress={() => toggle(item)} style={[styles.allergy, selected.includes(item) && styles.selected]}>{item}</Text>
      ))}
      {customEntries.map((item) => (
        <Text key={item} onPress={() => toggle(item)} style={[styles.allergy, styles.selected]}>{item} ✕</Text>
      ))}
      <Text onPress={() => setShowOtherInput((value) => !value)} style={[styles.allergy, showOtherInput && styles.selected]}>Other</Text>
    </View>
    {showOtherInput ? (
      <View style={styles.otherRow}>
        <TextInput value={otherText} onChangeText={setOtherText} placeholder="Type an allergy or ingredient" placeholderTextColor="#899AB2" style={styles.otherInput} onSubmitEditing={addOther} autoFocus />
        <Text onPress={addOther} style={styles.addButton}>Add</Text>
      </View>
    ) : null}
    <View style={styles.bottom}>
      <AuthButton title="Next  ›" onPress={next} />
    </View>
  </View>;
}

function Progress() { return <><View style={styles.progress}><Text style={styles.section}>PERSONAL DETAILS</Text><Text style={styles.step}>60% Complete</Text></View><View style={styles.track}><View style={[styles.fill, { width: '60%' }]} /></View></>; }

const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#DDE5EF', height: 6, marginTop: 10 },
  fill: { backgroundColor: authColors.green, height: '100%' },
  back: { color: '#91A4BF', fontSize: 15, marginTop: 44 },
  title: { color: authColors.navy, fontSize: 31, fontWeight: '900', lineHeight: 38, marginTop: 26 },
  subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 },
  search: { backgroundColor: '#FFF', borderRadius: 28, color: authColors.navy, fontSize: 17, marginTop: 34, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  allergy: { backgroundColor: '#FFF', borderColor: '#FFF', borderRadius: 28, borderWidth: 1, color: authColors.navy, fontSize: 16, fontWeight: '800', minWidth: '43%', padding: 16, textAlign: 'center' },
  selected: { borderColor: authColors.green, color: authColors.green },
  otherRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  otherInput: { backgroundColor: '#FFF', borderColor: authColors.green, borderRadius: 14, borderWidth: 1, color: authColors.navy, flex: 1, fontSize: 15, padding: 14 },
  addButton: { alignSelf: 'center', color: authColors.green, fontSize: 14, fontWeight: '800', paddingHorizontal: 12 },
  bottom: { marginTop: 'auto', paddingTop: 24 },
});
