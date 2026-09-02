import AsyncStorage from '@react-native-async-storage/async-storage';

export async function hasCompletedOnboarding(email: string) {
  return (await AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`)) === 'complete';
}

export async function completeOnboarding(email: string, profileType: 'patient' | 'doctor') {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`, 'complete');
  await AsyncStorage.setItem(`diabeatis360:profile:${email.trim().toLowerCase()}`, profileType);
}

export async function saveOnboardingValue(email: string, key: string, value: string) {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`, value);
}

export async function getOnboardingValue(email: string, key: string) {
  return AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`);
}
