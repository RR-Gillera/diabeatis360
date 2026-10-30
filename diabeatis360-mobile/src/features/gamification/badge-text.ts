import { translate, type Language, type MessageKey } from '@/i18n/translate';

// A badge's words in the person's language (DECISIONS.md D33). The seven badges the app ships with
// (functions/scripts/data/plans-and-badges.js) have Filipino words; a badge an admin adds later is shown as it was
// typed. In English the stored text is always used, so an admin's edit shows up. badge-text.test.mjs keeps this list
// in step with the seed data.
export const SHIPPED_BADGES = ['first_log', 'five_logs', 'ten_logs', 'twenty_five_logs', 'streak_3', 'streak_7', 'streak_14'] as const;

type StoredBadge = { id: string; name: string; description: string; criteria: string };

export function badgeText(badge: StoredBadge, language: Language) {
  if (language === 'English' || !(SHIPPED_BADGES as readonly string[]).includes(badge.id)) {
    return { name: badge.name, description: badge.description, goal: badge.criteria };
  }
  const key = (part: 'name' | 'description' | 'goal') => `badge.${badge.id}.${part}` as MessageKey;
  return { name: translate(language, key('name')), description: translate(language, key('description')), goal: translate(language, key('goal')) };
}
