import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ACTIVITY_LEVELS, allergyList, DIETS, NO_ALLERGIES } from '@/features/auth/health-profile';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { BottomNav } from '@/features/home/home-ui';
import { Chip, ChipRow, EditPill, InfoCard, InfoLine, ProfileTop, profileColors } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// Figma [P-11] Health Profile: what the app knows about the person, read-only, with an Edit pill that opens P-12.
// The data is the Users document (useHealthProfile), the same the AI prompts and the person's doctor read. Stored
// codes stay English; only what is shown is translated (D33).
export default function HealthProfileScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { uid, email, displayName } = useAuth();
  const { t, date } = useT();
  const profile = useHealthProfile(uid, email);

  const allergies = allergyList(profile?.form.allergy ?? '');
  const activity = ACTIVITY_LEVELS.find((option) => option.value === profile?.form.activity);
  const diet = DIETS.find((option) => option.value === profile?.form.diet);
  const condition = profile?.form.condition ?? '';
  const conditionText = condition ? t('condition.withDiabetes', { type: t(`condition.${condition}` as MessageKey) }) : '';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ProfileTop title={t('health.title')} onBack={goBack} action={<EditPill onPress={() => router.push('/health-profile/edit')} />} />
        {!profile ? <ActivityIndicator color={Brand.colors.primary} style={styles.loading} /> : (
          <View style={styles.cards}>
            <InfoCard title={t('health.personal')}>
              <InfoLine label={t('health.name')} value={profile.fullName || displayName || ''} />
              <InfoLine label={t('health.birthdate')} value={profile.form.dateOfBirth ? date(profile.form.dateOfBirth) : ''} />
              <InfoLine label={t('health.accountType')} value={profile.accountType === 'minor' ? t('health.forMyChild') : t('health.forMyself')} />
            </InfoCard>

            <InfoCard title={t('health.condition')}>
              {condition
                ? <ChipRow><Chip label={condition === 'Prediabetes' ? t('condition.Prediabetes') : conditionText} selected /></ChipRow>
                : <Text style={styles.missing}>{t('common.notSet')}</Text>}
            </InfoCard>

            <InfoCard title={t('health.allergies')}>
              {!allergies.length ? <Text style={styles.missing}>{t('health.allergiesMissing')}</Text>
                : allergies[0] === NO_ALLERGIES ? <ChipRow><Chip label={t('health.noAllergies')} /></ChipRow>
                  : <ChipRow>{allergies.map((item) => <Chip key={item} label={allergyLabel(item, t)} />)}</ChipRow>}
            </InfoCard>

            <InfoCard title={t('health.activity')}>
              <Text style={[styles.value, !activity && styles.missing]}>{activity ? `${t(activity.labelKey)} · ${t(activity.detailKey)}` : profile.form.activity || t('common.notSet')}</Text>
            </InfoCard>

            <InfoCard title={t('health.diet')}>
              <Text style={[styles.value, !diet && styles.missing]}>{diet ? `${t(diet.labelKey)} · ${t(diet.detailKey)}` : profile.form.diet || t('common.notSet')}</Text>
            </InfoCard>
          </View>
        )}
      </ScrollView>
      <BottomNav active="profile" />
    </View>
  );
}

/** A common allergy chip in the person's language ("Nuts" -> "Mani"); a typed one is shown as it was typed. */
function allergyLabel(item: string, t: ReturnType<typeof useT>['t']) {
  return ['Nuts', 'Dairy', 'Eggs', 'Seafood'].includes(item) ? t(`allergy.${item}` as MessageKey) : item;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 140 },
  loading: { marginTop: 40 },
  cards: { gap: 14 },
  value: { color: profileColors.navy, fontFamily: Brand.font.medium, fontSize: 15, lineHeight: 22 },
  missing: { color: profileColors.faint, fontFamily: Brand.font.medium, fontSize: 14 },
});
