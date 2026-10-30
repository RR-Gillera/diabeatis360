'use strict'
// The app's fixed catalogue: the 4 membership plans (DECISIONS.md D5, manuscript prices) and the 7 wellness badges.
// One copy, used by seed-demo.cjs (adds or updates them) and scripts/live-cleanup.js (puts them back after a wipe).

// Free is stored as data (price 0) so the app can show the Free vs Premium comparison.
const plans = [
  { id: 'free', plan_name: 'Free', price: 0, duration_days: 0 },
  { id: 'premium_monthly', plan_name: 'Premium Monthly', price: 99, duration_days: 30 },
  { id: 'premium_6_months', plan_name: 'Premium 6-Month', price: 499, duration_days: 180 },
  { id: 'premium_annual', plan_name: 'Premium Annual', price: 899, duration_days: 365 },
]

// criteria text is parsed by features/gamification/gamification-service.ts:
// "N ... log/entry/reading" -> number of logs; "N day ... streak" -> streak days.
const badges = [
  { id: 'first_log', badge_name: 'First Log', badge_description: 'Logged your first glucose reading', criteria: '1 glucose log entry' },
  { id: 'five_logs', badge_name: 'Getting Started', badge_description: 'Logged 5 glucose readings', criteria: '5 glucose log entries' },
  { id: 'ten_logs', badge_name: 'Consistent Logger', badge_description: 'Logged 10 glucose readings', criteria: '10 glucose log entries' },
  { id: 'twenty_five_logs', badge_name: 'Dedicated Tracker', badge_description: 'Logged 25 glucose readings', criteria: '25 glucose log entries' },
  { id: 'streak_3', badge_name: '3-Day Streak', badge_description: 'Logged on 3 days in a row', criteria: '3 day streak' },
  { id: 'streak_7', badge_name: '7-Day Streak', badge_description: 'Logged on 7 days in a row', criteria: '7 day streak' },
  { id: 'streak_14', badge_name: '14-Day Streak', badge_description: 'Logged on 14 days in a row', criteria: '14 day streak' },
]

module.exports = { plans, badges }
