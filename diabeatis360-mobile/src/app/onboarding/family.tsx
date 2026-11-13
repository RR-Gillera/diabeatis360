import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupNote, SetupScreen } from '@/features/auth/setup-kit';
import { FamilyContactsFields, problemsOf, rowsFrom, type ContactRow } from '@/features/family/family-contacts-form';
import { saveFamilyContacts } from '@/features/family/family-service';
import { contactsToSave } from '@/features/family/phone';
import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

// Optional setup step: up to two family members to text when a reading is critical (DECISIONS.md D45). It sits before
// the diet step on purpose: the diet step is the one that completes setup, so skipping this (or the app closing here)
// can never leave setup half-finished. No Figma frame yet; it follows the other setup steps (setup-kit).
export default function FamilySetupScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t } = useT();
  const [rows, setRows] = useState<ContactRow[]>(() => rowsFrom([]));
  const [showProblems, setShowProblems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const next = () => router.push('/onboarding/dietary');

  const saveAndContinue = async () => {
    if (saving) return;
    const contacts = contactsToSave(rows);
    if (!contacts.length) { next(); return; } // nothing typed: the same as Skip
    if (problemsOf(rows).some(Boolean)) { setShowProblems(true); return; }
    if (!uid) return;
    setSaving(true); setFailed(false);
    try {
      await saveFamilyContacts(uid, contacts);
      next();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.family}
      title={t('family.setupTitle')}
      subtitle={t('family.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {failed ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t('family.saveFailed')}</Text> : null}
        <AuthButton title={saving ? t('common.saving') : t('family.continue')} onPress={saveAndContinue} disabled={saving} />
        <Pressable accessibilityRole="button" onPress={next} disabled={saving} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>{t('family.skip')}</Text>
        </Pressable>
      </>}
    >
      <SetupNote>{t('family.optional')}</SetupNote>
      <FamilyContactsFields rows={rows} onChange={setRows} showProblems={showProblems} />
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  error: { color: '#D9364F', fontFamily: Brand.font.medium, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  skip: { alignItems: 'center', marginTop: 16, paddingVertical: 6 },
  skipText: { color: authColors.muted, fontFamily: Brand.font.bold, fontSize: 15 },
});
