import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { DIETS } from '@/features/auth/health-profile';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { SetupOption } from '@/features/auth/setup-kit';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { ProfileTop } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Profile > Dietary Preference: the same four choices and cards as setup (Figma Step 9), saved on their own.
export default function DietaryPreferenceScreen() {
  const goBack = useSafeBack('/profile');
  const { uid, email } = useAuth();
  const profile = useHealthProfile(uid, email);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <ProfileTop title="Dietary Preference" subtitle="We'll tailor your meal recommendations based on your selection." onBack={goBack} />
      {profile ? <DietPicker start={profile.form.diet} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
    </ScrollView>
  );
}

function DietPicker({ start, onDone }: { start: string; onDone: () => void }) {
  const { uid, email } = useAuth();
  const [diet, setDiet] = useState(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!email || !diet || saving) return;
    if (diet === start) { onDone(); return; }
    setSaving(true);
    try {
      await saveOnboardingValue(email, 'diet', diet, uid);
      onDone();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View>
      {DIETS.map((option) => (
        <SetupOption key={option.value} icon={option.icon} title={option.value} detail={option.detail} selected={diet === option.value} onPress={() => setDiet(option.value)} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving || !diet} /></View>
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
