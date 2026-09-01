import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authColors, authStyles } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';

export default function DoctorHomeScreen() { const router = useRouter(); const { signOut } = useAuth(); return <View style={[authStyles.screen, styles.screen]}><Text style={styles.role}>DOCTOR</Text><Pressable onPress={() => { signOut(); router.replace('/'); }}><Text style={styles.logout}>Log out</Text></Pressable></View>; }
const styles = StyleSheet.create({ screen: { alignItems: 'center', justifyContent: 'center' }, role: { color: authColors.navy, fontSize: 64, fontWeight: '900' }, logout: { color: authColors.green, fontSize: 16, fontWeight: '800', marginTop: 28 } });
