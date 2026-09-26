import { useAuth } from '../auth/AuthContext'
import { Card, PageHeader } from '../components/ui'

// Home page. The analytics cards and charts are added by the Reports & Analytics module.
export default function DashboardPage() {
  const { admin } = useAuth()
  return (
    <div>
      <PageHeader title={`Welcome, ${admin?.full_name || 'Admin'}`} subtitle="Manage doctors, users, appointments and the platform." />
      <Card>
        <p className="text-sm text-muted">Use the menu on the left. Analytics and reports appear here once those modules are built.</p>
      </Card>
    </div>
  )
}
