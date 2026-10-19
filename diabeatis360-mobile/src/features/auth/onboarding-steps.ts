// Which onboarding screen a person should see next (DECISIONS.md D25). Kept free of Firebase so it can be
// unit-tested with plain Node (npm test).
//
// Why this exists: signing in again during onboarding used to restart at Language, and an account that stopped at
// the Allergies step was treated as finished, so its allergies were never asked. Now onboarding resumes at the first
// question that has no answer, and the allergy question always needs one ("None" counts).
import { allergiesDeclared } from './health-profile';

export type OnboardingAnswers = {
  language?: string;
  profileType?: string;
  accountType?: string;
  guardianSubmitted?: boolean;
  dateOfBirth?: string;
  condition?: string;
  allergy?: string;
  activity?: string;
  diet?: string;
};

const answered = (value: unknown) => typeof value === 'string' ? value.trim().length > 0 : Boolean(value);

/** The path of the first onboarding screen without an answer, in the order the screens appear. */
export function firstUnansweredStep(answers: OnboardingAnswers): string {
  if (!answered(answers.language)) return '/onboarding/language';
  if (!answered(answers.profileType)) return '/onboarding/profile-type';
  if (answers.profileType === 'doctor') return '/onboarding/professional-info';
  if (!answered(answers.accountType)) return '/onboarding/account-for';
  if (answers.accountType === 'minor' && !answers.guardianSubmitted) return '/onboarding/guardian';
  if (!answered(answers.dateOfBirth)) return '/onboarding/date-of-birth';
  if (!answered(answers.condition)) return '/onboarding/condition';
  if (!allergiesDeclared(answers.allergy)) return '/onboarding/allergies';
  if (!answered(answers.activity)) return '/onboarding/activity';
  if (!answered(answers.diet)) return '/onboarding/dietary';
  return '/onboarding/notifications';
}
