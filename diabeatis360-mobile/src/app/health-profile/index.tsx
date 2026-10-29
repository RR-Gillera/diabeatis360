import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ACTIVITY_LEVELS, allergyList, DIETS, NO_ALLERGIES, optionDetail } from '@/features/auth/health-profile';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { BottomNav } from '@/features/home/home-ui';
import { Chip, ChipRow, EditPill, InfoCard, InfoLine, ProfileTop, profileColors } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Figma [P-11] Health Profile: what the app knows about the person, read-only, with an Edit pill that opens P-12.
// The data is the Users document (useHealthProfile), the same the AI prompts and the person's doctor read.
export default function HealthProfileScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { uid, email, displayName } = useAuth();
  const profile = useHealthProfile(uid, email);

  const allergies = allergyList(profile?.form.allergy ?? '');
  const activity = profile?.form.activity ?? '';
  const diet = profile?.form.diet ?? '';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ProfileTop title="Health Profile" onBack={goBack} action={<EditPill onPress={() => router.push('/health-profile/edit')} />} />
        {!profile ? <ActivityIndicator color={Brand.colors.primary} style={styles.loading} /> : (
          <View style={styles.cards}>
            <InfoCard title="Personal">
              <InfoLine label="Name" value={profile.fullName || displayName || ''} />
              <InfoLine label="Birthdate" value={shortDate(profile.form.dateOfBirth)} />
              <InfoLine label="Account type" value={profile.accountType === 'minor' ? 'For my child' : 'For myself'} />
            </InfoCard>

            <InfoCard title="Condition">
              {profile.form.condition
                ? <ChipRow><Chip label={conditionLabel(profile.form.condition)} selected /></ChipRow>
                : <Text style={styles.missing}>Not set</Text>}
            </InfoCard>

            <InfoCard title="Allergies">
              {!allergies.length ? <Text style={styles.missing}>Not set — add them so meal suggestions can avoid them.</Text>
                : allergies[0] === NO_ALLERGIES ? <ChipRow><Chip label="No allergies" /></ChipRow>
                  : <ChipRow>{allergies.map((item) => <Chip key={item} label={item} />)}</ChipRow>}
            </InfoCard>

            <InfoCard title="Activity level">
              <Text style={[styles.value, !activity && styles.missing]}>{activity ? withDetail(activity, optionDetail(ACTIVITY_LEVELS, activity)) : 'Not set'}</Text>
            </InfoCard>

            <InfoCard title="Dietary preference">
              <Text style={[styles.value, !diet && styles.missing]}>{diet ? withDetail(diet, optionDetail(DIETS, diet)) : 'Not set'}</Text>
            </InfoCard>
          </View>
        )}
      </ScrollView>
      <BottomNav active="profile" />
    </View>
  );
}

/** "Type 2" -> "Type 2 diabetes" (Figma P-11); "Prediabetes" stays as it is. */
function conditionLabel(code: string) {
  return /^type [12]$/i.test(code) ? `${code} diabetes` : code;
}

/** "March 14, 1981" -> "Mar 14, 1981" (Figma P-11). */
function shortDate(text: string) {
  return text.replace(/^([A-Z][a-z]{2})[a-z]+ /, '$1 ');
}

function withDetail(value: string, detail: string) {
  return detail ? `${value} · ${detail}` : value;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 140 },
  loading: { marginTop: 40 },
  cards: { gap: 14 },
  value: { color: profileColors.navy, fontFamily: Brand.font.medium, fontSize: 15, lineHeight: 22 },
  missing: { color: profileColors.faint, fontFamily: Brand.font.medium, fontSize: 14 },
});
