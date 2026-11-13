import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { authColors } from '@/features/auth/auth-ui';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

import { CONTACT_NAME_MAX, contactProblem, displayPhone, MAX_FAMILY_CONTACTS, normalizePhilippineMobile, RELATIONSHIP_MAX, type ContactProblem, type FamilyContact } from './phone';

// The family contacts form (DECISIONS.md D45), shared by the setup step and Profile > Family alerts so the two can never
// disagree. Two cards, each optional; the parent screen owns the rows and decides what Save does.

export type ContactRow = { name: string; relationship: string; phone: string };

/** Always two rows: the saved contacts first, then empty ones. Numbers are shown the way people write them. */
export function rowsFrom(contacts: FamilyContact[]): ContactRow[] {
  const rows = contacts.slice(0, MAX_FAMILY_CONTACTS).map((contact) => ({ ...contact, phone: displayPhone(contact.phone) }));
  while (rows.length < MAX_FAMILY_CONTACTS) rows.push({ name: '', relationship: '', phone: '' });
  return rows;
}

/** One problem (or null) per row; the second row may not repeat the first row's number. */
export function problemsOf(rows: ContactRow[]): ContactProblem[] {
  return rows.map((row, index) => {
    const other = rows[index === 0 ? 1 : 0];
    // Only the later row is told "already used", so the message appears once, under the repeat.
    return contactProblem(row, index > 0 && other ? normalizePhilippineMobile(other.phone) : null);
  });
}

const problemText: Record<Exclude<ContactProblem, null>, MessageKey> = {
  name: 'family.problem.name',
  phone: 'family.problem.phone',
  duplicate: 'family.problem.duplicate',
};

/** `showProblems` is turned on after the first Save, so nobody is told off while still typing. */
export function FamilyContactsFields({ rows, onChange, showProblems }: { rows: ContactRow[]; onChange: (rows: ContactRow[]) => void; showProblems: boolean }) {
  const { t } = useT();
  const problems = problemsOf(rows);
  const update = (index: number, field: keyof ContactRow, value: string) => {
    onChange(rows.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.note}>
        <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={14} tintColor={Brand.colors.primary} />
        <Text style={styles.noteText}>{t('family.private')}</Text>
      </View>
      {rows.map((row, index) => {
        const problem = showProblems ? problems[index] : null;
        return (
          <View key={index} style={[styles.card, problem && styles.cardProblem]}>
            <Text accessibilityRole="header" style={styles.cardTitle}>{t('family.contact', { number: index + 1 })}</Text>
            <TextInput
              value={row.name}
              onChangeText={(value) => update(index, 'name', value)}
              placeholder={t('family.name')}
              accessibilityLabel={`${t('family.contact', { number: index + 1 })}, ${t('family.name')}`}
              placeholderTextColor="#A7B8CD"
              maxLength={CONTACT_NAME_MAX}
              autoCapitalize="words"
              style={styles.input}
            />
            <TextInput
              value={row.relationship}
              onChangeText={(value) => update(index, 'relationship', value)}
              placeholder={t('family.relationship')}
              accessibilityLabel={`${t('family.contact', { number: index + 1 })}, ${t('family.relationship')}`}
              placeholderTextColor="#A7B8CD"
              maxLength={RELATIONSHIP_MAX}
              autoCapitalize="words"
              style={styles.input}
            />
            <TextInput
              value={row.phone}
              onChangeText={(value) => update(index, 'phone', value)}
              placeholder={t('family.phonePlaceholder')}
              accessibilityLabel={`${t('family.contact', { number: index + 1 })}, ${t('family.phone')}`}
              placeholderTextColor="#A7B8CD"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={20}
              style={styles.input}
            />
            {problem ? <Text accessibilityLiveRegion="polite" style={styles.problem}>{t(problemText[problem])}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 20 },
  note: { alignItems: 'center', backgroundColor: '#F0F7E7', borderRadius: 14, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  noteText: { color: authColors.navy, flex: 1, fontFamily: Brand.font.medium, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#EEF2F6', borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  cardProblem: { borderColor: '#F3B4BE' },
  cardTitle: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 15 },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontFamily: Brand.font.regular, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  problem: { color: '#D9364F', fontFamily: Brand.font.medium, fontSize: 13 },
});
