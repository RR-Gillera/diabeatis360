import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGuardianVerification, type GuardianVerification } from '@/features/auth/guardian-service';
import { DIETS } from '@/features/auth/health-profile';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { wellnessStats } from '@/features/gamification/gamification-service';
import { compactNumber, memberTier } from '@/features/gamification/member-tier';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { BottomNav } from '@/features/home/home-ui';
import { MenuRow, PremiumCard, profileColors, TierBadge } from '@/features/profile/profile-ui';
import { reminderPermission } from '@/features/reminders/reminder-service';
import { activeSubscription, subscribeToSubscriptions, type Subscription } from '@/features/subscription/subscription-service';
import { resetTo } from '@/lib/navigation';
import { useT } from '@/i18n/language-context';

// Figma "Profile and Premium Screens": the person at the top (initials, name, email, membership tier), three stat tiles,
// then the menu. The health profile itself is on its own screens now (P-11 view, P-12 edit), and appointment history
// lives on the Doctors tab (My appointments), as in Figma. The photo is replaced by initials: storing photos needs
// Firebase Storage, which the free Spark plan does not include (DECISIONS.md D18, D31).
export default function ProfileScreen() {
  const router = useRouter();
  const { uid, email, displayName, signOut } = useAuth();
  const { t, label } = useT();
  const profile = useHealthProfile(uid, email);
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [guardian, setGuardian] = useState<GuardianVerification | null>(null);
  const [reminders, setReminders] = useState<'on' | 'off' | 'unavailable'>('unavailable');
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, setEntries, () => {});
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSubscriptions(uid, setSubscriptions, () => {});
  }, [uid]);

  // Set only on a pediatric account (DECISIONS.md D16); null for an adult's own account.
  useEffect(() => {
    if (!uid) return;
    return subscribeToGuardianVerification(uid, setGuardian, () => {});
  }, [uid]);

  // Checked each time Profile comes back into view: the person may have just changed it in the phone's settings.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    reminderPermission().then((value) => { if (!cancelled) setReminders(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, []));

  const stats = useMemo(() => wellnessStats(entries), [entries]);
  const { tier } = memberTier(stats.points);
  const premium = activeSubscription(subscriptions) !== null;
  const name = profile?.fullName || displayName || t('profile.yourName');
  const diet = profile?.form.diet ?? '';
  const dietOption = DIETS.find((option) => option.value === diet);
  const dietLine = dietOption ? t(dietOption.labelKey).toUpperCase() : diet.toUpperCase();
  const language = profile?.language === 'Filipino' ? t('profile.language.filipino') : t('profile.language.english');
  const reminderStatus = reminders === 'on' ? t('profile.reminders.on') : reminders === 'off' ? t('profile.reminders.off') : t('profile.reminders.unavailable');

  const logOut = () => { setConfirmLogout(false); signOut(); resetTo(router, '/'); };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.person}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('profile.editYourProfile')} onPress={() => router.push('/health-profile/edit')} style={styles.avatarWrap}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(name)}</Text></View>
            <View style={styles.avatarEdit}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={13} tintColor="#FFFFFF" />
            </View>
          </Pressable>
          <View style={styles.personCopy}>
            <Text accessibilityRole="header" style={styles.name} numberOfLines={2}>{name}</Text>
            <Text style={styles.email} numberOfLines={1}>{email}</Text>
            <TierBadge tier={tier} />
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={compactNumber(stats.totalLogs)} label={t('profile.stat.logs')} />
          <Stat value={compactNumber(stats.streak)} label={t('profile.stat.streak')} />
          <Stat value={compactNumber(stats.points)} label={t('profile.stat.points')} />
        </View>

        {guardian ? (
          <View style={styles.guardian}>
            <Text style={styles.guardianTitle}>{t('profile.guardian.managedBy', { name: guardian.guardianFullName || t('profile.guardian.someone'), relationship: label('guardianRelationship', guardian.relationship) })}</Text>
            <Text style={[styles.guardianStatus, guardian.status === 'rejected' && styles.guardianRejected]}>
              {label('verificationStatus', guardian.status)}
              {guardian.status === 'rejected' && guardian.rejectionReason ? ` — ${guardian.rejectionReason}` : ''}
            </Text>
            {guardian.status === 'rejected' ? (
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/onboarding/guardian', params: { mode: 'resubmit' } })}>
                <Text style={styles.guardianLink}>{t('profile.guardian.resubmit')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.menu}>
          <MenuRow icon={{ ios: 'person.text.rectangle', android: 'manage_accounts' }} title={t('profile.menu.edit')} onPress={() => router.push('/health-profile')} />
          <MenuRow icon={{ ios: 'fork.knife', android: 'restaurant' }} title={t('profile.menu.diet')} subtitle={diet ? dietLine : undefined} onPress={() => router.push('/dietary-preference')} />
          <MenuRow icon={{ ios: 'character.bubble', android: 'translate' }} title={t('profile.menu.language')} subtitle={language} onPress={() => router.push('/language-settings')} />
          <MenuRow icon={{ ios: 'bell.fill', android: 'notifications' }} title={t('profile.menu.notifications')} subtitle={reminderStatus} onPress={() => router.push('/notification-settings')} />
          <MenuRow icon={{ ios: 'gift.fill', android: 'redeem' }} tint="green" title={t('profile.menu.rewards')} subtitle={t('profile.rewardsLine', { tier: tier.toUpperCase(), points: compactNumber(stats.points) })} onPress={() => router.push('/rewards')} />
          {premium
            ? <PremiumCard title={t('profile.premium.member')} subtitle={t('profile.premium.manage')} onPress={() => router.push('/subscription')} />
            : <PremiumCard title={t('profile.premium.upgrade')} subtitle={t('profile.premium.upgradeDetail')} onPress={() => router.push('/subscription')} />}
          <MenuRow icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout' }} title={t('profile.menu.logout')} tone="danger" onPress={() => setConfirmLogout(true)} />
        </View>

        <View style={styles.legal}>
          <Text accessibilityRole="link" style={styles.legalLink} onPress={() => router.push('/privacy-policy')}>{t('profile.privacy')}</Text>
          <Text style={styles.legalDot}>·</Text>
          <Text accessibilityRole="link" style={styles.legalLink} onPress={() => router.push('/terms-of-service')}>{t('profile.terms')}</Text>
        </View>
      </ScrollView>
      <BottomNav active="profile" />

      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.dim}>
          <View style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>{t('profile.logout.title')}</Text>
            <Text style={styles.dialogText}>{t('profile.logout.text')}</Text>
            <Pressable accessibilityRole="button" onPress={logOut} style={({ pressed }) => [styles.dialogDanger, pressed && styles.pressed]}>
              <Text style={styles.dialogDangerText}>{t('profile.logout.confirm')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirmLogout(false)} style={({ pressed }) => [styles.dialogCancel, pressed && styles.pressed]}>
              <Text style={styles.dialogCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label.toLowerCase()}: ${value}`} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const shadow = { elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12 } as const;

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 140 },
  pressed: { opacity: 0.86 },
  person: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 8 },
  avatarWrap: { height: 84, width: 84 },
  avatar: { alignItems: 'center', backgroundColor: '#DCF2A9', borderColor: '#FFFFFF', borderRadius: 26, borderWidth: 3, height: 84, justifyContent: 'center', width: 84, ...shadow },
  avatarText: { color: '#3F6212', fontFamily: Brand.font.extraBold, fontSize: 28 },
  avatarEdit: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderColor: '#FFFFFF', borderRadius: 14, borderWidth: 2, bottom: -4, height: 28, justifyContent: 'center', position: 'absolute', right: -4, width: 28 },
  personCopy: { flex: 1, gap: 4 },
  name: { color: profileColors.navy, fontFamily: Brand.font.extraBold, fontSize: 22, letterSpacing: -0.3 },
  email: { color: profileColors.muted, fontFamily: Brand.font.regular, fontSize: 14, marginBottom: 4 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 24 },
  stat: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, flex: 1, gap: 4, paddingVertical: 18, ...shadow },
  statValue: { color: Brand.colors.primary, fontFamily: Brand.font.extraBold, fontSize: 22 },
  statLabel: { color: profileColors.muted, fontFamily: Brand.font.bold, fontSize: 10, letterSpacing: 0.6 },
  guardian: { backgroundColor: '#FFFFFF', borderRadius: 20, gap: 4, marginTop: 16, padding: 16, ...shadow },
  guardianTitle: { color: profileColors.navy, fontFamily: Brand.font.bold, fontSize: 13 },
  guardianStatus: { color: profileColors.muted, fontFamily: Brand.font.medium, fontSize: 12 },
  guardianRejected: { color: Brand.colors.danger },
  guardianLink: { color: Brand.colors.primary, fontFamily: Brand.font.bold, fontSize: 13, marginTop: 4 },
  menu: { gap: 12, marginTop: 24 },
  legal: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 24 },
  legalLink: { color: profileColors.faint, fontFamily: Brand.font.medium, fontSize: 12, paddingVertical: 6 },
  legalDot: { color: profileColors.faint, fontSize: 12 },
  dim: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 28, gap: 12, padding: 24 },
  dialogTitle: { color: profileColors.navy, fontFamily: Brand.font.extraBold, fontSize: 22 },
  dialogText: { color: profileColors.muted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  dialogDanger: { alignItems: 'center', backgroundColor: Brand.colors.danger, borderRadius: 16, justifyContent: 'center', minHeight: 54 },
  dialogDangerText: { color: '#FFFFFF', fontFamily: Brand.font.bold, fontSize: 16 },
  dialogCancel: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', minHeight: 54 },
  dialogCancelText: { color: profileColors.navy, fontFamily: Brand.font.bold, fontSize: 16 },
});
