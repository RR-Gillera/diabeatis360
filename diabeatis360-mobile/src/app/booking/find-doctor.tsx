import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { BookingMoreMenu, bookingColors, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { AppointmentHistoryList } from '@/features/booking/booking-history';
import { subscribeToBookableProviders } from '@/features/booking/booking-service';
import { useBooking } from '@/features/booking/booking-context';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useT } from '@/i18n/language-context';
import type { Provider } from '@/features/booking/types';

// The filter values match the specialty the doctor saved (English); only the chip text is translated.
const filters = ['All', 'Endocrinologist', 'Diabetologist', 'Nutritionist'] as const;

export default function FindDoctorScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { selectProvider } = useBooking();
  const { t } = useT();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => subscribeToBookableProviders(setProviders, () => setLoadFailed(true)), []);

  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const matchesSearch = `${provider.fullName} ${provider.specialty} ${provider.city}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'All' || provider.specialty.toLowerCase() === filter.toLowerCase());
  }), [filter, providers, search]);

  const choose = (provider: Provider) => {
    selectProvider(provider);
    router.push('/booking/select-date-time');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>{t('doctors.title')}</Text>
          <Text style={styles.subtitle}>{t('doctors.subtitle')}</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell style={styles.headerButton} />
          <BookingMoreMenu style={styles.headerButton} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.searchBox}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} tintColor={bookingColors.navy} />
          <TextInput value={search} onChangeText={setSearch} accessibilityLabel={t('doctors.search')} placeholder={t('doctors.search')} placeholderTextColor="#8796AD" style={styles.searchInput} />
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={filters} keyExtractor={(item) => item} contentContainerStyle={styles.filters} renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}>
            <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{t(`doctors.filter.${item}`)}</Text>
          </Pressable>
        )} />
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>{t('doctors.yourAppointments')}</Text>
          <AppointmentHistoryList patientId={uid} />
        </View>

        <Text style={styles.sectionTitle}>{t('doctors.all')}</Text>
        {loadFailed ? <Text style={styles.error}>{t('doctors.loadFailed')}</Text> : null}
        {!loadFailed && visibleProviders.length === 0 ? <Text style={styles.empty}>{t('doctors.none')}</Text> : null}
        {visibleProviders.map((provider) => (
          <View key={provider.id} style={ui.card}>
            <View style={styles.doctorTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(provider.fullName)}</Text></View>
              <View style={styles.doctorCopy}>
                <Text style={styles.doctorName}>{provider.fullName}</Text>
                <Text style={styles.specialty}>{provider.specialty}</Text>
                {provider.isVerified ? <View style={styles.verified}><Text style={styles.verifiedText}>{t('doctors.verified')}</Text></View> : null}
              </View>
            </View>
            <View style={styles.detailsRow}>
              <View><Text style={styles.label}>{t('doctors.location')}</Text><View style={styles.cityRow}><SymbolView name={{ ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }} size={14} tintColor={bookingColors.green} /><Text style={[styles.value, styles.valueInline]}>{provider.city}</Text></View></View>
              <View><Text style={styles.label}>{t('doctors.fee')}</Text><Text style={styles.value}>{formatFee(provider.consultationFee)}</Text></View>
            </View>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => choose(provider)}><Text style={styles.secondaryText}>{t('doctors.viewProfile')}</Text></Pressable>
              <View style={styles.actionPrimary}><PrimaryButton title={t('doctors.consult')} onPress={() => choose(provider)} /></View>
            </View>
          </View>
        ))}
      </ScrollView>
      <BottomNav active="doctors" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  scrollContent: { padding: 24, paddingBottom: 150, gap: 16 },
  searchBox: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderColor: '#E2E8F0', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 16, minHeight: 48 },
  searchInput: { color: bookingColors.navy, flex: 1, fontSize: 15 },
  filters: { gap: 8, paddingVertical: 2 },
  filter: { borderColor: '#E2E8F0', borderRadius: 22, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: '#FFF' },
  activeFilter: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  filterText: { color: bookingColors.muted, fontSize: 14, fontWeight: '600' },
  activeFilterText: { color: '#FFF' },
  error: { color: '#D9364F', fontSize: 14 },
  empty: { color: bookingColors.muted, paddingVertical: 20, textAlign: 'center' },
  historySection: { gap: 12 },
  sectionTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  doctorTop: { flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: '#DFF2E8', borderRadius: 14, height: 64, justifyContent: 'center', width: 64 },
  avatarText: { color: bookingColors.green, fontSize: 20, fontWeight: '800' },
  doctorCopy: { flex: 1, gap: 4 },
  doctorName: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' },
  specialty: { color: bookingColors.green, fontSize: 13, fontWeight: '700' },
  verified: { alignSelf: 'flex-start', backgroundColor: '#E6F6EF', borderRadius: 4, marginTop: 3, paddingHorizontal: 7, paddingVertical: 4 },
  verifiedText: { color: bookingColors.green, fontSize: 10, fontWeight: '800' },
  detailsRow: { borderBottomColor: bookingColors.border, borderBottomWidth: 1, borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingVertical: 14 },
  label: { color: '#8C9DB6', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  value: { color: bookingColors.navy, fontSize: 14, fontWeight: '700', marginTop: 5 },
  cityRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 5 },
  valueInline: { marginTop: 0 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryButton: { alignItems: 'center', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  secondaryText: { color: bookingColors.muted, fontSize: 14, fontWeight: '800' },
  actionPrimary: { flex: 1 },
});
