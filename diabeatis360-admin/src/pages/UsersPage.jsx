import { useSearchParams } from 'react-router-dom'

import { PageHeader, PageTabs } from '../components/ui'
import { useFilteredCount } from '../lib/useCollection'
import GuardiansTab from './users/GuardiansTab'
import PatientsTab from './users/PatientsTab'
import PointsTab from './users/PointsTab'

const TABS = ['patients', 'guardians', 'points']

// "Users" (FIGMA/ADMIN User Management Page): patients list + details drawer (UT-A003-A005, UT-A011),
// plus Guardian Verification (D16) and Award Points (gamification module) as tabs — both are "about a
// patient" workflows, so they live under the same menu item instead of two more sidebar entries.
export default function UsersPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'patients'
  const pendingGuardians = useFilteredCount('Guardian_Verifications', 'verification_status', 'pending')

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage registered patients, guardian verifications, and wellness points." />
      <PageTabs
        value={tab}
        onChange={(value) => setParams(value === 'patients' ? {} : { tab: value })}
        options={[
          { value: 'patients', label: 'Patients' },
          { value: 'guardians', label: 'Guardian Verification', count: pendingGuardians },
          { value: 'points', label: 'Award Points' },
        ]}
      />
      {tab === 'patients' ? <PatientsTab /> : tab === 'guardians' ? <GuardiansTab /> : <PointsTab />}
    </div>
  )
}
