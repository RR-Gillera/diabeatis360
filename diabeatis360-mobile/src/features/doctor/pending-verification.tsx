import { ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand } from '@/constants/theme';

import type { DoctorProfile } from './types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText weight="medium" style={styles.rowLabel}>{label}</AppText>
      <AppText weight="bold" style={styles.rowValue}>{value || '—'}</AppText>
    </View>
  );
}

/**
 * Shown instead of the doctor screens while Providers.is_verified is false (DECISIONS.md D9).
 * The doctor layout listens to the Providers doc, so this switches to the dashboard on its own the moment an
 * admin verifies the credentials; no refresh is needed.
 */
export function PendingVerification({ profile, onSignOut }: { profile: DoctorProfile; onSignOut: () => void }) {
  const rejected = Boolean(profile.rejectionReason);
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.icon, rejected && styles.iconRejected]}>
        <SymbolView
          name={rejected
            ? { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }
            : { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' }}
          size={30}
          tintColor={rejected ? Brand.colors.danger : Brand.colors.warning}
        />
      </View>
      <AppText weight="extraBold" style={styles.title}>{rejected ? 'Changes needed' : 'Verification in progress'}</AppText>
      <AppText style={styles.body}>
        {rejected
          ? 'An admin reviewed your credentials and found an issue. Fix it in your profile, then an admin will review again.'
          : 'An admin is reviewing your PRC credentials. You will get full access to your dashboard, schedule and patients as soon as you are verified. This screen updates automatically.'}
      </AppText>

      {rejected ? (
        <Card style={[styles.card, styles.reasonCard]}>
          <AppText weight="bold" style={styles.cardTitle}>Admin&apos;s note</AppText>
          <AppText style={styles.reasonText}>{profile.rejectionReason}</AppText>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText weight="bold" style={styles.cardTitle}>Credentials you submitted</AppText>
        <Row label="Name" value={profile.fullName} />
        <Row label="Specialty" value={profile.specialty} />
        <Row label="PRC license no." value={profile.prcLicenseNumber} />
        <Row label="City" value={profile.city} />
      </Card>

      <PrimaryButton title="Sign out" variant="outline" onPress={onSignOut} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: Brand.colors.background, flexGrow: 1, justifyContent: 'center', padding: Brand.sizes.screenPadding },
  icon: { alignItems: 'center', backgroundColor: Brand.colors.warningTint, borderRadius: 24, height: 64, justifyContent: 'center', marginBottom: 16, width: 64 },
  iconRejected: { backgroundColor: Brand.colors.dangerTint },
  title: { fontSize: 24, textAlign: 'center' },
  body: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 24, marginTop: 8, textAlign: 'center' },
  card: { alignSelf: 'stretch', gap: 10 },
  reasonCard: { backgroundColor: Brand.colors.dangerTint, marginBottom: 16 },
  reasonText: { color: Brand.colors.danger, fontSize: 13, lineHeight: 19 },
  cardTitle: { fontSize: 14, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Brand.colors.textMuted, fontSize: 13 },
  rowValue: { flexShrink: 1, fontSize: 13, textAlign: 'right' },
  button: { alignSelf: 'stretch', marginTop: 24 },
});
