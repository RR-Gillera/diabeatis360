import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { SetupNote, SetupOption } from '@/features/auth/setup-kit';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { ProfileTop } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Profile > Language: the same two cards as setup (Figma Step 3). Saved to Users.language_preference.
export default function LanguageSettingsScreen() {
  const goBack = useSafeBack('/profile');
  const { uid, email } = useAuth();
  const profile = useHealthProfile(uid, email);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <ProfileTop title="Language" subtitle="Choose your preferred language for a better health management experience." onBack={goBack} />
      {profile ? <LanguagePicker start={profile.language} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
    </ScrollView>
  );
}

function LanguagePicker({ start, onDone }: { start: string; onDone: () => void }) {
  const { uid, email } = useAuth();
  const [language, setLanguage] = useState(start === 'Filipino' ? 'Filipino' : 'English');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!email || saving) return;
    if (language === start) { onDone(); return; }
    setSaving(true);
    try {
      await saveOnboardingValue(email, 'language', language, uid);
      onDone();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View>
      <SetupOption emoji="🇺🇸" title="English" detail="System Default" selected={language === 'English'} onPress={() => setLanguage('English')} />
      <SetupOption emoji="🇵🇭" title="Filipino / Tagalog" detail="Lokal na Wika" selected={language === 'Filipino'} onPress={() => setLanguage('Filipino')} />
      <SetupNote>The app&apos;s screens are in English for now. Your choice is saved, and the Filipino screens arrive in an update.</SetupNote>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  loading: { marginTop: 40 },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 14, marginTop: 16 },
  save: { marginTop: 28 },
});
