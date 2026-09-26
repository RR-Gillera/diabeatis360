import { useMemo, useState } from 'react'

import DataTable, { Tabs } from '../components/DataTable'
import { Card, Notice, PageHeader, StatusBadge } from '../components/ui'
import { formatDate, toDate } from '../lib/format'
import { effectiveStatus } from '../lib/subscriptions'
import { useCollection } from '../lib/useCollection'

const tones = { active: 'success', cancelled: 'danger', expired: 'warning', trial: 'neutral' }

// View Premium Subscribers (module 12, admin).
export default function SubscribersPage() {
  const subscriptions = useCollection('Subscriptions')
  const users = useCollection('Users')
  const plans = useCollection('Subscription_Plans')
  const [tab, setTab] = useState('active')

  const rows = useMemo(() => {
    const userById = Object.fromEntries(users.data.map((user) => [user.id, user]))
    const planById = Object.fromEntries(plans.data.map((plan) => [plan.id, plan]))
    return subscriptions.data
      .map((item) => ({
        id: item.id,
        name: userById[item.user_id]?.full_name || 'Unknown user',
        email: userById[item.user_id]?.email || '',
        plan: planById[item.plan_id]?.plan_name || 'Unknown plan',
        status: effectiveStatus(item),
        started: item.started_at,
        expires: item.expires_at,
      }))
      .filter((row) => tab === 'all' || row.status === 'active')
      .sort((a, b) => (toDate(b.started)?.getTime() ?? 0) - (toDate(a.started)?.getTime() ?? 0))
  }, [subscriptions.data, users.data, plans.data, tab])

  const activeCount = subscriptions.data.filter((item) => effectiveStatus(item) === 'active').length

  const columns = [
    { key: 'name', header: 'Subscriber', render: (r) => (<div><p className="font-bold">{r.name}</p><p className="text-xs text-muted">{r.email}</p></div>) },
    { key: 'plan', header: 'Plan', render: (r) => r.plan },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge tone={tones[r.status] ?? 'neutral'}>{r.status[0].toUpperCase() + r.status.slice(1)}</StatusBadge> },
    { key: 'started', header: 'Started', render: (r) => formatDate(r.started) },
    { key: 'expires', header: 'Renews / ends', render: (r) => formatDate(r.expires) },
  ]

  const error = subscriptions.error || users.error || plans.error

  return (
    <div>
      <PageHeader title="Premium Subscribers" subtitle="Patients with an active premium subscription." />
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card><p className="text-xs font-bold uppercase text-muted">Active premium subscribers</p><p className="mt-1 text-3xl font-extrabold text-brand">{activeCount}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">All subscriptions ever</p><p className="mt-1 text-3xl font-extrabold">{subscriptions.data.length}</p></Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[{ value: 'active', label: 'Active', count: activeCount }, { value: 'all', label: 'All', count: subscriptions.data.length }]}
      />
      <DataTable columns={columns} rows={rows} empty="No subscribers yet." />
    </div>
  )
}
