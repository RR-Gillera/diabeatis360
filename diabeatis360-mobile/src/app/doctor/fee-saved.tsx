import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatFee } from '@/features/booking/booking-ui';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

// "Consultation Fee Set": shown after a successful save on Set Consultation Fee (app/doctor/fee.tsx).
// The amount is read from the doctor's Providers document, not passed in from the previous screen, so it always
// shows the fee that is actually stored, which is the fee patients' new bookings must carry (firestore.rules).
export default function ConsultationFeeSavedScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t } = useT();
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (profile) => setFee(profile ? profile.consultationFee : null), () => {});
  }, [uid]);

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Two soft rings around the check, as in the frame. */}
        <View style={styles.ringOuter}>
          <View style={styles.ringInner}>
            <View style={styles.check}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={44} tintColor="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.title}>{t('doctor.feeSaved.title')}</Text>
        <Text style={styles.body}>{t('doctor.feeSaved.text')}</Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <SymbolView name={{ ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' }} size={18} tintColor={homeColors.green} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={doctorStyles.label}>{t('doctor.feeSaved.standard')}</Text>
            <Text style={styles.cardValue}>{t('doctor.feeSaved.per')}</Text>
          </View>
          <Text style={styles.amount}>{fee === null ? '—' : formatFee(fee)}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" style={styles.primary} onPress={() => resetTo(router, '/doctor')}>
          <Text style={styles.primaryText}>{t('doctor.feeSaved.dashboard')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.replace('/doctor/fee' as never)}>
          <Text style={styles.link}>{t('doctor.feeSaved.change')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', gap: 16, padding: 24, paddingBottom: 180, paddingTop: 56 },
  // Large shapes with no text, so they use Figma's brighter green (DECISIONS D37).
  ringOuter: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.08)', borderRadius: 102, height: 204, justifyContent: 'center', width: 204 },
  ringInner: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.16)', borderRadius: 82, height: 164, justifyContent: 'center', width: 164 },
  check: { alignItems: 'center', backgroundColor: Brand.colors.primaryBright, borderRadius: 64, height: 128, justifyContent: 'center', width: 128 },
  title: { color: Brand.colors.text, fontFamily: Brand.font.extraBold, fontSize: 26, marginTop: 16, textAlign: 'center' },
  body: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 16, lineHeight: 26, textAlign: 'center' },
  card: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 16, padding: 20, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardIcon: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  cardCopy: { flex: 1, gap: 2 },
  cardValue: { color: Brand.colors.text, fontFamily: Brand.font.bold, fontSize: 15 },
  amount: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 20 },
  footer: { alignItems: 'center', bottom: 32, gap: 18, left: 24, position: 'absolute', right: 24 },
  primary: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: homeColors.green, borderRadius: 999, height: 56, justifyContent: 'center' },
  primaryText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
  link: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 13 },
});
