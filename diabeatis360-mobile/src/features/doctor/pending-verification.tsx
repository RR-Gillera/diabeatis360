import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand } from '@/constants/theme';

import type { DoctorProfile } from './types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <AppText weight="bold" style={styles.rowValue}>{value || '—'}</AppText>
    </View>
  );
}

/**
 * Shown instead of the doctor screens while Providers.is_verified is false (DECISIONS.md D9; Figma D-03, D-04).
 * The doctor layout listens to the Providers doc, so this switches to the dashboard on its own the moment an admin
 * verifies the credentials. After a rejection the doctor can correct the details and send them again (onResubmit).
 */
export function PendingVerification({ profile, onSignOut, onResubmit }: { profile: DoctorProfile; onSignOut: () => void; onResubmit: () => void }) {
  const rejected = Boolean(profile.rejectionReason);
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.icon, rejected && styles.iconRejected]}>
          <SymbolView
            name={rejected
              ? { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }
              : { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' }}
            size={44}
            tintColor={rejected ? '#EF4444' : '#F59E0B'}
          />
        </View>
        <AppText weight="extraBold" style={styles.title}>{rejected ? 'Verification not approved' : 'Verification in progress'}</AppText>

        {rejected ? (
          <View style={styles.reason}>
            <AppText weight="bold" style={styles.reasonLabel}>REASON</AppText>
            <AppText weight="bold" style={styles.reasonText}>{profile.rejectionReason}</AppText>
            <AppText style={styles.reasonHint}>Correct your details and send them again. An admin will review them once more.</AppText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Submitted details</AppText>
              <Row label="PRC number" value={profile.prcLicenseNumber} />
              <Row label="Specialty" value={profile.specialty} />
              <Row label="City" value={profile.city} />
            </View>
            <AppText style={styles.body}>An admin will review your credentials. This screen opens your dashboard by itself once you are approved.</AppText>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {rejected ? <PrimaryButton title="Update details and resubmit" onPress={onResubmit} /> : null}
        <Pressable accessibilityRole="button" onPress={onSignOut} hitSlop={8}><AppText weight="bold" style={styles.signOut}>Sign out</AppText></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { alignItems: 'center', flexGrow: 1, gap: 16, justifyContent: 'center', padding: Brand.sizes.screenPadding, paddingTop: 80 },
  icon: { alignItems: 'center', backgroundColor: '#FEEFD9', borderRadius: 56, height: 112, justifyContent: 'center', width: 112 },
  iconRejected: { backgroundColor: '#FDE2E2' },
  title: { fontSize: 26, textAlign: 'center' },
  card: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 28, gap: 12, padding: 18, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardTitle: { color: Brand.colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Brand.colors.textMuted, fontSize: 14 },
  rowValue: { flexShrink: 1, fontSize: 14, textAlign: 'right' },
  body: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  reason: { alignSelf: 'stretch', backgroundColor: '#FDECEC', borderColor: '#F87171', borderRadius: 24, borderWidth: 1, gap: 4, padding: 18 },
  reasonLabel: { color: '#EF4444', fontSize: 12, letterSpacing: 0.6 },
  reasonText: { fontSize: 17 },
  reasonHint: { color: Brand.colors.textMuted, fontSize: 13, lineHeight: 19 },
  footer: { gap: 18, paddingBottom: 36, paddingHorizontal: Brand.sizes.screenPadding, alignItems: 'stretch' },
  signOut: { color: Brand.colors.primary, fontSize: 16, textAlign: 'center' },
});
