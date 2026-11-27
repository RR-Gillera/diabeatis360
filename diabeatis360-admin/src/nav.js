import {
  ChartIcon, ContentIcon, FlagIcon, HomeIcon, RevenueIcon, SettingsIcon, StethoscopeIcon, UsersIcon,
} from './components/icons'

// Sidebar menu, matching the 7-item structure in FIGMA/ADMIN (Overview, Users, Providers, Content,
// Analytics, Revenue, Settings). `badge` names a key from useAdminBadges() (see Layout.jsx) — omit it
// for items with no pending-count badge.
export const navItems = [
  { to: '/', label: 'Overview', icon: HomeIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, badge: 'guardians' },
  { to: '/providers', label: 'Providers', icon: StethoscopeIcon, badge: 'providers' },
  { to: '/content', label: 'Content', icon: ContentIcon },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/revenue', label: 'Revenue', icon: RevenueIcon },
  // Not one of the 7 Figma items: Reported Issues was added by DECISIONS.md D51 (Table 31 #6).
  { to: '/issues', label: 'Reported Issues', icon: FlagIcon, badge: 'reports' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]
