import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, bookingColors, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToProviders } from '@/features/booking/booking-service';
import { useBooking } from '@/features/booking/booking-context';
import type { Provider } from '@/features/booking/types';

const filters = ['All', 'Endocrinologist', 'Diabetologist', 'Nutritionist'];

export default function FindDoctorScreen() {
  const router = useRouter();
  const { selectProvider } = useBooking();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => subscribeToProviders(setProviders, (value) => setError(value.message)), []);

  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const matchesSearch = `${provider.fullName} ${provider.specialty} ${provider.city}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'All' || provider.specialty.toLowerCase() === filter.toLowerCase());
  }), [filter, providers, search]);

  const choose = (provider: Provider) => {
    selectProvider(provider);
    router.push('/booking/select-date-time');
  };

  return (
    <View style={ui.screen}>
      <BookingHeader title="Find a Doctor" subtitle="Consult with diabetes experts" />
      <View style={ui.content}>
        <View style={styles.searchBox}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} tintColor={bookingColors.navy} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search for a medical professional..." placeholderTextColor="#8796AD" style={styles.searchInput} />
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={filters} keyExtractor={(item) => item} contentContainerStyle={styles.filters} renderItem={({ item }) => (
          <Pressable onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}>
            <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
          </Pressable>
        )} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && visibleProviders.length === 0 ? <Text style={styles.empty}>No providers match your search.</Text> : null}
        {visibleProviders.map((provider) => (
          <View key={provider.id} style={ui.card}>
            <View style={styles.doctorTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{provider.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</Text></View>
              <View style={styles.doctorCopy}>
                <Text style={styles.doctorName}>{provider.fullName}</Text>
                <Text style={styles.specialty}>{provider.specialty} <Text style={styles.experience}>• Experienced specialist</Text></Text>
                {provider.isVerified ? <View style={styles.verified}><Text style={styles.verifiedText}>✓ PRC LICENSE VERIFIED</Text></View> : null}
              </View>
            </View>
            <View style={styles.detailsRow}>
              <View><Text style={styles.label}>LOCATION</Text><Text style={styles.value}>📍 {provider.city}</Text></View>
              <View><Text style={styles.label}>FEE</Text><Text style={styles.value}>{formatFee(provider.consultationFee)}</Text></View>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => choose(provider)}><Text style={styles.secondaryText}>View Profile</Text></Pressable>
              <View style={styles.actionPrimary}><PrimaryButton title="Consult" onPress={() => choose(provider)} /></View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { alignItems: 'center', backgroundColor: '#E8EFE4', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 16, minHeight: 48 },
  searchInput: { color: bookingColors.navy, flex: 1, fontSize: 15 },
  filters: { gap: 8, paddingVertical: 2 },
  filter: { borderColor: bookingColors.border, borderRadius: 22, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: '#FFF' },
  activeFilter: { backgroundColor: bookingColors.green, borderColor: bookingColors.green },
  filterText: { color: bookingColors.muted, fontSize: 14, fontWeight: '600' },
  activeFilterText: { color: '#FFF' },
  error: { color: '#D9364F', fontSize: 14 },
  empty: { color: bookingColors.muted, paddingVertical: 20, textAlign: 'center' },
  doctorTop: { flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: '#DFF2E8', borderRadius: 14, height: 64, justifyContent: 'center', width: 64 },
  avatarText: { color: bookingColors.green, fontSize: 20, fontWeight: '800' },
  doctorCopy: { flex: 1, gap: 4 },
  doctorName: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' },
  specialty: { color: bookingColors.green, fontSize: 13, fontWeight: '700' },
  experience: { color: bookingColors.muted, fontWeight: '500' },
  verified: { alignSelf: 'flex-start', backgroundColor: '#E6F6EF', borderRadius: 4, marginTop: 3, paddingHorizontal: 7, paddingVertical: 4 },
  verifiedText: { color: bookingColors.green, fontSize: 10, fontWeight: '800' },
  detailsRow: { borderBottomColor: bookingColors.border, borderBottomWidth: 1, borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingVertical: 14 },
  label: { color: '#8C9DB6', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  value: { color: bookingColors.navy, fontSize: 14, fontWeight: '700', marginTop: 5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryButton: { alignItems: 'center', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  secondaryText: { color: bookingColors.muted, fontSize: 14, fontWeight: '800' },
  actionPrimary: { flex: 1 },
});
