import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { FamilyContactsFields, problemsOf, rowsFrom, type ContactRow } from '@/features/family/family-contacts-form';
import { saveFamilyContacts, subscribeToFamilyContacts } from '@/features/family/family-service';
import { contactsToSave } from '@/features/family/phone';
import { ProfileTop, profileColors } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Profile > Family alerts (DECISIONS.md D45): add, change or remove the two family members texted on a critical reading.
// Clearing both cards and saving turns the alerts off.
export default function FamilyContactsScreen() {
  const goBack = useSafeBack('/profile');
  const { uid } = useAuth();
  const { t } = useT();
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  // Seeded once from Firestore; after that the person's own typing wins over later snapshots (including their own save).
  useEffect(() => {
    if (!uid) return;
    return subscribeToFamilyContacts(
      uid,
      (contacts) => setRows((current) => current ?? rowsFrom(contacts)),
      () => setRows((current) => current ?? rowsFrom([])),
    );
  }, [uid]);

  const change = (next: ContactRow[]) => { setRows(next); setSaved(false); };

  const save = async () => {
    if (!uid || !rows || saving) return;
    if (problemsOf(rows).some(Boolean)) { setShowProblems(true); return; }
    setSaving(true); setSaved(false); setFailed(false);
    try {
      await saveFamilyContacts(uid, contactsToSave(rows));
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ProfileTop title={t('family.title')} subtitle={t('family.subtitle')} onBack={goBack} />
      {rows ? (
        <>
          <FamilyContactsFields rows={rows} onChange={change} showProblems={showProblems} />
          {failed ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t('family.saveFailed')}</Text> : null}
          <AuthButton title={saving ? t('common.saving') : saved ? t('family.saved') : t('family.save')} onPress={save} disabled={saving} />
        </>
      ) : <ActivityIndicator color={profileColors.green} style={styles.loading} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { gap: 20, padding: 24, paddingBottom: 48 },
  error: { color: '#D9364F', fontFamily: Brand.font.medium, fontSize: 13, textAlign: 'center' },
  loading: { marginTop: 40 },
});
