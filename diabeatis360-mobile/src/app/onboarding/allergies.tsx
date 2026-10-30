import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { allergyText, COMMON_ALLERGIES, NO_ALLERGIES, toggleAllergy } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupScreen } from '@/features/auth/setup-kit';
import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// Figma "Profile Setup Step 7" (Any allergies or ingredients to avoid?).
// An explicit answer is required (DECISIONS.md D25): either allergies, or "None". Skipping is not allowed, because
// meal suggestions and the scanner use this list to keep the person safe. Typing a name that is not a chip adds it.
export default function AllergiesScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const typed = search.trim();
  const chipLabel = (item: string) => t(`allergy.${item}` as MessageKey);
  const visible = COMMON_ALLERGIES.filter((item) => [item, chipLabel(item)].some((name) => name.toLowerCase().includes(typed.toLowerCase())));
  const custom = selected.filter((item) => !COMMON_ALLERGIES.includes(item) && item !== NO_ALLERGIES);
  const canAddTyped = typed.length > 0 && !visible.some((item) => [item, chipLabel(item)].some((name) => name.toLowerCase() === typed.toLowerCase()))
    && !selected.some((item) => item.toLowerCase() === typed.toLowerCase());

  const tap = (item: string) => setSelected((current) => toggleAllergy(current, item));
  const addTyped = () => { if (canAddTyped) { tap(typed); setSearch(''); } };

  const next = async () => {
    if (!selected.length) return;
    if (email) await saveOnboardingValue(email, 'allergy', allergyText(selected), uid);
    router.push('/onboarding/activity');
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.allergies}
      title={t('setup.allergies.title')}
      subtitle={t('setup.allergies.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {!selected.length ? <Text style={styles.needAnswer}>{t('setup.allergies.needAnswer')}</Text> : null}
        <AuthButton title={t('common.next')} icon="next" onPress={next} disabled={!selected.length} />
      </>}
    >
      <View style={styles.search}>
        <View style={styles.searchIcon}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="#64748B" />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={addTyped}
          placeholder={t('setup.allergies.search')}
          placeholderTextColor="#94A3B8"
          accessibilityLabel={t('setup.allergies.search')}
          returnKeyType="done"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.grid}>
        {visible.map((item) => <Chip key={item} label={chipLabel(item)} selected={selected.includes(item)} onPress={() => tap(item)} />)}
        {custom.map((item) => <Chip key={item} label={item} selected removable onPress={() => tap(item)} />)}
        {canAddTyped ? <Chip label={t('setup.allergies.addTyped', { name: typed })} selected={false} onPress={addTyped} /> : null}
        <Chip label={t('allergy.None')} selected={selected.includes(NO_ALLERGIES)} onPress={() => tap(NO_ALLERGIES)} />
      </View>
    </SetupScreen>
  );
}

function Chip({ label, selected, removable, onPress }: { label: string; selected: boolean; removable?: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={removable ? t('common.tapToRemove', { label }) : label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {removable ? <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={authColors.green} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 30, flexDirection: 'row', gap: 12, marginTop: 28, padding: 8,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  searchIcon: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  searchInput: { color: authColors.navy, flex: 1, fontFamily: Brand.font.medium, fontSize: 16, minHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  chip: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', borderRadius: 28, borderWidth: 1.5, flexDirection: 'row', gap: 8,
    justifyContent: 'center', minHeight: 54, minWidth: '46%', paddingHorizontal: 18,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.07, shadowRadius: 8,
  },
  chipSelected: { borderColor: authColors.green },
  chipText: { color: authColors.navy, fontFamily: Brand.font.bold, fontSize: 16 },
  chipTextSelected: { color: authColors.green },
  pressed: { opacity: 0.85 },
  needAnswer: { color: authColors.muted, fontFamily: Brand.font.medium, fontSize: 13, textAlign: 'center' },
});
