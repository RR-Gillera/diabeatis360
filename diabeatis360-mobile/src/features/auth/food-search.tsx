import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { FOODS, foodKey, foodLabel, searchFoods } from '@/constants/food-words';
import { useT } from '@/i18n/language-context';

import { authColors } from './auth-ui';

/**
 * A search box for foods (DECISIONS.md D40). Nothing is listed until the person types; then the matching choices appear
 * under the box, in their language with the other language's name beside it ("hip" shows Shrimp · Hipon), and anything
 * not on the list can be added as typed. What is chosen shows as chips with an × to remove.
 * Used for allergies (setup Step 7, Health Profile) and the ingredients someone does not eat (Step 9, Dietary
 * Preference). `selected` holds the stored names: English for a listed food, as typed otherwise.
 */
export function FoodSearch({ choices, selected, onAdd, onRemove, placeholder }: {
  choices: readonly string[];
  selected: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  placeholder: string;
}) {
  const { t, language } = useT();
  const [query, setQuery] = useState('');

  const typed = query.trim();
  const isChosen = (name: string) => selected.some((item) => item.toLowerCase() === name.toLowerCase() || (foodKey(item) !== '' && foodKey(item) === foodKey(name)));
  const matches = searchFoods(typed, choices, language).filter((name) => !isChosen(name));
  // What was typed can be added as it is, unless it is one of the matches already shown or is already chosen.
  const canAddTyped = typed.length > 0 && !isChosen(typed)
    && !matches.some((name) => [name, FOODS[name].fil].some((label) => label.toLowerCase() === typed.toLowerCase()));

  const add = (name: string) => { onAdd(name); setQuery(''); };
  const addBest = () => { if (matches.length) add(matches[0]); else if (canAddTyped) add(typed); };

  return (
    <View>
      <View style={styles.search}>
        <View style={styles.searchIcon}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="#64748B" />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={addBest}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          accessibilityLabel={placeholder}
          autoCorrect={false}
          returnKeyType="done"
          style={styles.searchInput}
        />
      </View>

      {typed ? (
        <View style={styles.results}>
          {matches.map((name) => {
            const title = foodLabel(name, language);
            const other = language === 'Filipino' ? name : FOODS[name].fil;
            return (
              <ResultRow key={name} title={title} detail={other.toLowerCase() === title.toLowerCase() ? '' : other} label={t('search.add', { name: title })} onPress={() => add(name)} />
            );
          })}
          {canAddTyped ? <ResultRow title={t('setup.allergies.addTyped', { name: typed })} detail="" label={t('search.add', { name: typed })} onPress={() => add(typed)} /> : null}
        </View>
      ) : null}

      {selected.length ? (
        <View style={styles.chips}>
          {selected.map((item) => {
            const label = foodLabel(item, language);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={t('common.tapToRemove', { label })}
                onPress={() => onRemove(item)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText}>{label}</Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={authColors.green} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * "I don't have food allergies", under the allergy search. Allergies need an explicit answer (D25), and with no chips to
 * pick from (D40) this is how someone says they have none; it is stored as "None", and choosing an allergy clears it.
 */
export function NoAllergiesButton({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.noAllergies, selected && styles.noAllergiesSelected, pressed && styles.pressed]}
    >
      <SymbolView
        name={selected ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
        size={22}
        tintColor={selected ? authColors.green : '#94A3B8'}
      />
      <Text style={[styles.noAllergiesText, selected && styles.noAllergiesTextSelected]}>{t('setup.allergies.none')}</Text>
    </Pressable>
  );
}

function ResultRow({ title, detail, label, onPress }: { title: string; detail: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={20} tintColor={authColors.green} />
      <Text style={styles.resultTitle}>{title}</Text>
      {detail ? <Text style={styles.resultDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 30, flexDirection: 'row', gap: 12, padding: 8,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  searchIcon: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  searchInput: { color: authColors.navy, flex: 1, fontFamily: Brand.font.medium, fontSize: 16, minHeight: 44 },
  results: {
    backgroundColor: '#FFFFFF', borderRadius: 20, marginTop: 8, overflow: 'hidden', paddingVertical: 4,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  result: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 16 },
  resultTitle: { color: authColors.navy, flexShrink: 1, fontFamily: Brand.font.bold, fontSize: 15 },
  resultDetail: { color: authColors.muted, flexShrink: 1, fontFamily: Brand.font.medium, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  chip: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: authColors.green, borderRadius: 24, borderWidth: 1.5, flexDirection: 'row',
    gap: 8, minHeight: 44, paddingHorizontal: 16,
  },
  chipText: { color: authColors.green, fontFamily: Brand.font.bold, fontSize: 15 },
  noAllergies: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, flexDirection: 'row', gap: 12,
    marginTop: 20, minHeight: 56, paddingHorizontal: 16,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.07, shadowRadius: 8,
  },
  noAllergiesSelected: { borderColor: authColors.green },
  noAllergiesText: { color: authColors.navy, flexShrink: 1, fontFamily: Brand.font.bold, fontSize: 15 },
  noAllergiesTextSelected: { color: authColors.green },
  pressed: { opacity: 0.85 },
});
