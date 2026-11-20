import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatDate, formatFee } from '@/features/booking/booking-ui';
import { credentialStatus, doctorDisplayName, doctorInitials, licenseStatus } from '@/features/doctor/doctor-profile';
import { InfoRow, LinkRow, ProfileSection } from '@/features/doctor/doctor-profile-ui';
import { subscribeToDoctorPhone, subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorBottomNav, doctorStyles } from '@/features/doctor/doctor-ui';
import type { DoctorProfile } from '@/features/doctor/types';
import { displayPhone } from '@/features/family/phone';
import { homeColors } from '@/features/home/home-ui';
import { formatPeso } from '@/features/wallet/wallet-format';
import { subscribeToWalletBalance } from '@/features/wallet/wallet-service';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

const EDIT_PROFILE = '/doctor/edit-profile' as Href;

const PILL = {
  verified: { text: homeColors.green, background: '#E8F0DE' },
  pending: { text: '#B45309', background: '#FEF3C7' },
  rejected: { text: '#B91C1C', background: '#FEF2F2' },
} as const;

// "My Profile" (Figma frame, FIGMA/DOCTOR/My Profile.png; DECISIONS.md D49). Shows the doctor's details read-only in
// the frame's grouped cards; the pencil (and the rows with a pencil or arrow) open Edit Profile, and the fee, schedule,
// wallet, PIN and language rows open their own screens. Differences from the frame are listed in docs/FIGMA_MAP.md.
export default function DoctorProfileScreen() {
  const router = useRouter();
  const { uid, email, signOut, resetPassword } = useAuth();
  const { t, language } = useT();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [phone, setPhone] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [reset, setReset] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    if (!uid) return;
    const stops = [
      subscribeToDoctorProfile(uid, setProfile, () => setLoadFailed(true)),
      subscribeToDoctorPhone(uid, setPhone, () => {}),
      // The balance on the Wallet row (D47). A failed read just leaves the row without a number.
      subscribeToWalletBalance(uid, setWalletBalance, () => {}),
    ];
    return () => stops.forEach((stop) => stop());
  }, [uid]);

  // Change Password sends Firebase's reset link to the sign-in email (the same link as Forgot Password), so the app
  // never handles the old or new password itself.
  const changePassword = async () => {
    if (!email || reset === 'sending') return;
    setReset('sending');
    try {
      await resetPassword(email);
      setReset('sent');
    } catch {
      setReset('failed');
    }
  };

  const name = profile ? doctorDisplayName(profile.fullName) : '';
  const subtitle = profile ? [profile.specialty, profile.city].filter(Boolean).join(' • ') : '';
  const credential = credentialStatus(profile?.isVerified ?? false, profile?.rejectionReason ?? '');
  const license = licenseStatus(profile?.licenseExpiry ?? null);
  const incomplete = profile !== null && (!profile.specialty || !profile.prcLicenseNumber || !profile.city || !profile.consultationFee);
  const notAdded = t('doctor.profile.notAdded');

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* The white top card: title and pencil, avatar, name with the verified check, specialty and city. */}
        <View style={styles.top}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>{t('doctor.profile.title')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('doctor.profile.edit')} hitSlop={8} style={styles.editButton} onPress={() => router.push(EDIT_PROFILE)}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#334155" />
            </Pressable>
          </View>
          {/* Initials, not a photo: there is no photo field and no file storage on the Spark plan (D18). */}
          <View style={styles.avatarRing}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{doctorInitials(profile?.fullName ?? '')}</Text></View>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name || t('doctor.profile.yourName')}</Text>
            {profile?.isVerified ? (
              <SymbolView accessibilityLabel={t('doctor.profile.verified')} name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={18} tintColor={homeColors.green} />
            ) : null}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {profile && !profile.isVerified ? <Text style={styles.pendingText}>{t('doctor.profile.pending')}</Text> : null}
        </View>

        <View style={styles.body}>
          {loadFailed ? <Text style={[doctorStyles.error, styles.gap]}>{t('doctor.profile.loadFailed')}</Text> : null}
          {incomplete ? (
            <Pressable accessibilityRole="button" style={styles.notice} onPress={() => router.push(EDIT_PROFILE)}>
              <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={15} tintColor={homeColors.orange} />
              <Text style={styles.noticeText}>{t('doctor.profile.incomplete')}</Text>
            </Pressable>
          ) : null}

          <ProfileSection icon={{ ios: 'person.fill', android: 'person' }} title={t('doctor.profile.personal')}>
            {/* The sign-in email: changing it would change how the doctor logs in, so it is shown, not edited. */}
            <InfoRow first label={t('doctor.profile.email')} value={email ?? ''} />
            <InfoRow
              label={t('doctor.profile.phone')}
              value={phone ? displayPhone(phone) : notAdded}
              valueTone={phone ? undefined : 'muted'}
              onPress={() => router.push(EDIT_PROFILE)}
            />
          </ProfileSection>

          <ProfileSection icon={{ ios: 'briefcase.fill', android: 'work' }} title={t('doctor.profile.professional')}>
            <InfoRow first edit label={t('doctor.profile.prc')} value={profile?.prcLicenseNumber || notAdded} valueTone={profile?.prcLicenseNumber ? undefined : 'muted'} onPress={() => router.push(EDIT_PROFILE)} />
            <InfoRow
              edit
              label={t('doctor.profile.expiry')}
              value={profile?.licenseExpiry
                ? `${formatDate(profile.licenseExpiry, language)}${license === 'expired' ? ` · ${t('doctor.profile.expired')}` : ''}`
                : notAdded}
              valueTone={license === 'expired' ? 'danger' : license === 'missing' ? 'muted' : undefined}
              onPress={() => router.push(EDIT_PROFILE)}
            />
          </ProfileSection>

          <ProfileSection icon={{ ios: 'person.text.rectangle.fill', android: 'badge' }} title={t('doctor.profile.credentials')}>
            {/* The frame shows a PRC ID photo; no file can be stored on Spark (D18), so it is the licence the admin reviewed. */}
            <View style={styles.credential}>
              <View style={styles.credentialIcon}>
                <SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} size={20} tintColor="#94A3B8" />
              </View>
              <View style={styles.credentialCopy}>
                <Text style={styles.credentialTitle}>{t('doctor.profile.prcCard')}</Text>
                <Text style={styles.credentialDetail}>
                  {profile?.reviewedAt ? t('doctor.profile.reviewed', { date: formatDate(profile.reviewedAt, language) }) : t('doctor.profile.waiting')}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: PILL[credential].background }]}>
                <Text style={[styles.pillText, { color: PILL[credential].text }]}>{t(`doctor.profile.status.${credential}`)}</Text>
              </View>
            </View>
          </ProfileSection>

          <ProfileSection icon={{ ios: 'calendar.badge.checkmark', android: 'event_available' }} title={t('doctor.profile.availability')}>
            <LinkRow first icon={{ ios: 'clock.fill', android: 'schedule' }} title={t('doctor.manageSchedule')} onPress={() => router.push('/doctor/schedule')} />
            <LinkRow
              icon={{ ios: 'banknote.fill', android: 'payments' }}
              title={t('doctor.profile.fee')}
              value={profile?.consultationFee ? formatFee(profile.consultationFee) : t('doctor.profile.notSet')}
              valueStrong={Boolean(profile?.consultationFee)}
              onPress={() => router.push('/doctor/fee' as Href)}
            />
          </ProfileSection>

          <ProfileSection icon={{ ios: 'shield.fill', android: 'shield' }} title={t('doctor.profile.settings')}>
            <LinkRow
              first
              icon={{ ios: 'lock.fill', android: 'lock' }}
              title={t('doctor.profile.changePassword')}
              detail={reset === 'sent' ? t('doctor.profile.resetSent', { email: email ?? '' }) : reset === 'failed' ? t('doctor.profile.resetFailed') : undefined}
              onPress={changePassword}
            />
            {/* The app PIN (D42) stays: the frame's "Notification Preferences" is left out, because notifications are
                always on (D29) and the reminder settings screen is the patient's. */}
            <LinkRow icon={{ ios: 'circle.grid.3x3.fill', android: 'dialpad' }} title={t('pin.menu.change')} onPress={() => router.push('/change-pin')} />
            <LinkRow
              icon={{ ios: 'wallet.pass.fill', android: 'account_balance_wallet' }}
              title={t('wallet.menu')}
              value={walletBalance === null ? undefined : formatPeso(walletBalance)}
              valueStrong
              onPress={() => router.push('/doctor/wallet')}
            />
            <LinkRow icon={{ ios: 'globe', android: 'language' }} title={t('profile.menu.language')} value={language} onPress={() => router.push('/language-settings')} />
            <LinkRow icon={{ ios: 'exclamationmark.bubble.fill', android: 'report' }} title={t('report.menu')} onPress={() => router.push('/report-problem')} />
          </ProfileSection>

          <Pressable accessibilityRole="button" style={styles.logout} onPress={() => { signOut(); resetTo(router, '/'); }}>
            <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={18} tintColor="#E11D48" />
            <Text style={styles.logoutText}>{t('doctor.profile.logout')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DoctorBottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 140 },
  top: { alignItems: 'center', backgroundColor: homeColors.card, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 20, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.05, shadowRadius: 6 },
  titleRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 22 },
  editButton: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  avatarRing: { borderColor: '#FFFFFF', borderRadius: 52, borderWidth: 4, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.12, shadowRadius: 8 },
  avatar: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 48, height: 96, justifyContent: 'center', width: 96 },
  avatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 32 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 14 },
  name: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 19, textAlign: 'center' },
  subtitle: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, marginTop: 4, textAlign: 'center' },
  pendingText: { color: '#B45309', fontFamily: Brand.font.bold, fontSize: 12, marginTop: 6 },
  body: { paddingHorizontal: 20 },
  gap: { marginTop: 16 },
  notice: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.08)', borderRadius: 14, flexDirection: 'row', gap: 10, marginTop: 16, padding: 14 },
  noticeText: { color: homeColors.textMuted, flex: 1, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18 },
  credential: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 16 },
  credentialIcon: { alignItems: 'center', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', width: 60 },
  credentialCopy: { flex: 1, gap: 2 },
  credentialTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
  credentialDetail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.4 },
  logout: { alignItems: 'center', borderColor: '#E11D48', borderRadius: 999, borderWidth: 1.5, flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 32, minHeight: 56 },
  logoutText: { color: '#E11D48', fontFamily: Brand.font.extraBold, fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
});
