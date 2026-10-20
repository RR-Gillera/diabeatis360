import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenTopStyle } from '@/constants/screen-top';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { PendingVerification } from '@/features/doctor/pending-verification';
import type { DoctorProfile } from '@/features/doctor/types';
import { resetTo } from '@/lib/navigation';

/**
 * Guards every doctor screen. Until an admin verifies the doctor's credentials (Providers.is_verified), the
 * doctor only sees the "verification in progress" screen (DECISIONS.md D9). `undefined` = still loading.
 */
export default function DoctorLayout() {
  const router = useRouter();
  const { uid, signOut } = useAuth();
  const { top: statusBarHeight } = useSafeAreaInsets();
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
    return (
      <PendingVerification
        profile={profile}
        onSignOut={() => { signOut(); resetTo(router, '/login'); }}
        onResubmit={() => router.push({ pathname: '/onboarding/professional-info', params: { resubmit: '1' } } as never)}
      />
    );
  }

  // Each doctor screen starts below the status bar, like the patient screens (constants/screen-top.ts).
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: screenTopStyle(route.name, statusBarHeight, 'doctor'),
      })}
    />
  );
}
