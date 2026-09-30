import { useSearchParams } from 'react-router-dom'

import { PageHeader, PageTabs } from '../components/ui'
import AccountTab from './settings/AccountTab'
import AnnouncementsTab from './settings/AnnouncementsTab'

const TABS = ['announcements', 'account']

// FIGMA/ADMIN "Settings". The Figma "Reminders" tab is left out (decided 2026-09-29): reminders are scheduled
// on each patient's phone, so the web panel has nothing to configure for them. "My Account" is added because
// the admin still needs Update Account + Reset Password (Table 24, module 1).
export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'announcements'

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage system announcements and your admin account." />
      <PageTabs
        value={tab}
        onChange={(value) => setParams(value === 'announcements' ? {} : { tab: value })}
        options={[
          { value: 'announcements', label: 'Announcements' },
          { value: 'account', label: 'My Account' },
        ]}
      />
      {tab === 'announcements' ? <AnnouncementsTab /> : <AccountTab />}
    </div>
  )
}
