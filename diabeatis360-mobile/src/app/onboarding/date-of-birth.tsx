import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, authColors, authStyles } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, index) => currentYear - index); // most recent first

function daysInMonth(monthIndex: number, year: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export default function DateOfBirthScreen() {
  const router = useRouter();
  const { email } = useAuth();
  const [monthName, setMonthName] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const monthIndex = monthName !== null ? months.indexOf(monthName) : null;

  const dayOptions = useMemo(() => {
    const total = daysInMonth(monthIndex ?? 0, year ?? currentYear);
    return Array.from({ length: total }, (_, index) => index + 1);
  }, [monthIndex, year]);

  const isComplete = monthIndex !== null && day !== null && year !== null;
  const formatted = isComplete ? `${monthName} ${day}, ${year}` : null;

  const pickMonth = (name: string) => {
    setMonthName(name);
    const total = daysInMonth(months.indexOf(name), year ?? currentYear);
    if (day !== null && day > total) setDay(total);
  };

  const pickYear = (value: number) => {
    setYear(value);
    if (monthIndex !== null && day !== null) {
      const total = daysInMonth(monthIndex, value);
      if (day > total) setDay(total);
    }
  };

  const save = async () => {
    if (!email || !formatted) return;
    await saveOnboardingValue(email, 'dateOfBirth', formatted);
    router.push('/onboarding/condition');
  };

  return <View style={[authStyles.screen, styles.screen]}>
    <Progress />
    <Text style={styles.back} onPress={() => router.back()}>‹  Back</Text>
    <Text style={styles.title}>When were{`\n`}you born?</Text>
    <Text style={styles.subtitle}>This helps us calculate dosages and health benchmarks accurately.</Text>

    <View style={styles.columns}>
      <Column label="Month" items={months} selected={monthName} onSelect={pickMonth} renderLabel={(item) => item} />
      <Column label="Day" items={dayOptions} selected={day} onSelect={setDay} renderLabel={(item) => String(item)} />
      <Column label="Year" items={years} selected={year} onSelect={pickYear} renderLabel={(item) => String(item)} />
    </View>

    <View style={styles.datePill}>
      <Text style={styles.calendar}>▣</Text>
      <Text style={styles.dateText}>{formatted ?? 'Select your date of birth'}</Text>
    </View>

    <View style={styles.bottom}>
      <AuthButton title="Next  ›" onPress={save} disabled={!isComplete} />
      <Text style={styles.hint}>◈    Your age remains private to your health profile.</Text>
    </View>
  </View>;
}

function Column<T>({ label, items, selected, onSelect, renderLabel }: { label: string; items: T[]; selected: T | null; onSelect: (item: T) => void; renderLabel: (item: T) => string }) {
  return <View style={styles.column}>
    <Text style={styles.columnLabel}>{label}</Text>
    <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
      {items.map((item, index) => {
        const active = selected === item;
        return <Text key={index} onPress={() => onSelect(item)} style={[styles.wheelText, active && styles.active]}>{renderLabel(item)}</Text>;
      })}
    </ScrollView>
  </View>;
}

function Progress() { return <><View style={styles.progress}><Text style={styles.section}>PERSONAL DETAILS</Text><Text style={styles.step}>40% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View></>; }

const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 },
  fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '40%' },
  back: { color: '#91A4BF', fontSize: 15, marginTop: 44 },
  title: { color: authColors.navy, fontSize: 31, fontWeight: '900', lineHeight: 38, marginTop: 26 },
  subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 },
  columns: { flexDirection: 'row', gap: 10, marginTop: 32 },
  column: { flex: 1, gap: 8 },
  columnLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  columnScroll: { backgroundColor: '#F9FBFC', borderRadius: 12, height: 180 },
  wheelText: { color: '#A7B8CD', fontSize: 16, fontWeight: '700', paddingVertical: 10, textAlign: 'center' },
  active: { backgroundColor: '#F1F7EE', color: authColors.green, fontSize: 17 },
  datePill: { alignItems: 'center', alignSelf: 'center', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 24, paddingHorizontal: 20, paddingVertical: 12 },
  calendar: { color: authColors.green },
  dateText: { color: authColors.navy, fontSize: 15, fontWeight: '800' },
  bottom: { marginTop: 'auto', paddingTop: 28 },
  hint: { color: '#91A4BF', fontSize: 12, marginTop: 24, textAlign: 'center' },
});
