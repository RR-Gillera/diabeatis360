import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { PendingVerification } from '@/features/doctor/pending-verification';
import type { DoctorProfile } from '@/features/doctor/types';

/**
 * Guards every doctor screen. Until an admin verifies the doctor's credentials (Providers.is_verified), the
 * doctor only sees the "verification in progress" screen (DECISIONS.md D9). `undefined` = still loading.
 */
export default function DoctorLayout() {
  const router = useRouter();
  const { uid, signOut } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, setProfile, () => setProfile(null));
  }, [uid]);

  if (profile === undefined) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: Brand.colors.background, flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={Brand.colors.primary} />
      </View>
    );
  }

  if (profile && !profile.isVerified) {
    return <PendingVerification profile={profile} onSignOut={() => { signOut(); router.replace('/login'); }} />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
