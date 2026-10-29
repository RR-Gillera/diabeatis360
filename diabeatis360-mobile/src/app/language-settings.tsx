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
import { useT } from '@/i18n/language-context';
import type { Language } from '@/i18n/translate';

// Profile > Language: the same two cards as setup (Figma Step 3). Saving writes Users.language_preference and switches
// every screen at once (D33); the AI also answers in that language (functions/lib/prompts.js).
export default function LanguageSettingsScreen() {
  const goBack = useSafeBack('/profile');
  const { uid, email } = useAuth();
  const { t } = useT();
  const profile = useHealthProfile(uid, email);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <ProfileTop title={t('languageSettings.title')} subtitle={t('setup.language.subtitle')} onBack={goBack} />
      {profile ? <LanguagePicker start={profile.language === 'Filipino' ? 'Filipino' : 'English'} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
    </ScrollView>
  );
}

function LanguagePicker({ start, onDone }: { start: Language; onDone: () => void }) {
  const { uid, email } = useAuth();
  const { t, setLanguage } = useT();
  const [language, setChoice] = useState<Language>(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!email || saving) return;
    if (language === start) { onDone(); return; }
    setSaving(true);
    try {
      await saveOnboardingValue(email, 'language', language, uid);
      setLanguage(language);
      onDone();
    } catch {
      setError(t('common.couldNotSave'));
      setSaving(false);
    }
  };

  return (
    <View>
      <SetupOption emoji="🇺🇸" title="English" detail={t('setup.language.englishDetail')} selected={language === 'English'} onPress={() => setChoice('English')} />
      <SetupOption emoji="🇵🇭" title="Filipino / Tagalog" detail={t('setup.language.filipinoDetail')} selected={language === 'Filipino'} onPress={() => setChoice('Filipino')} />
      <SetupNote>{t('languageSettings.note')}</SetupNote>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? t('common.saving') : t('common.save')} onPress={save} disabled={saving} /></View>
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
