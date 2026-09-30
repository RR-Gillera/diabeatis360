import { useMemo, useState } from 'react'

import DataTable, { Tabs } from '../../components/DataTable'
import { Card, StatusBadge } from '../../components/ui'
import { formatDate, toDate } from '../../lib/format'
import { effectiveStatus } from '../../lib/subscriptions'

const tones = { active: 'success', cancelled: 'danger', expired: 'warning', trial: 'neutral' }

// View Premium Subscribers (module 12, admin). effectiveStatus() also treats a lapsed subscription as expired.
export default function SubscribersTab({ subscriptions, users, plans }) {
  const [tab, setTab] = useState('active')

  const rows = useMemo(() => {
    const userById = Object.fromEntries(users.map((user) => [user.id, user]))
    const planById = Object.fromEntries(plans.map((plan) => [plan.id, plan]))
    return subscriptions
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
  }, [subscriptions, users, plans, tab])

  const activeCount = subscriptions.filter((item) => effectiveStatus(item) === 'active').length

  const columns = [
    { key: 'name', header: 'Subscriber', render: (r) => (<div><p className="font-bold">{r.name}</p><p className="text-xs text-muted">{r.email}</p></div>) },
    { key: 'plan', header: 'Plan', render: (r) => r.plan },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge tone={tones[r.status] ?? 'neutral'}>{r.status[0].toUpperCase() + r.status.slice(1)}</StatusBadge> },
    { key: 'started', header: 'Started', render: (r) => formatDate(r.started) },
    { key: 'expires', header: 'Renews / ends', render: (r) => formatDate(r.expires) },
  ]

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card><p className="text-xs font-bold uppercase text-muted">Active premium subscribers</p><p className="mt-1 text-3xl font-extrabold text-brand">{activeCount}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">All subscriptions ever</p><p className="mt-1 text-3xl font-extrabold">{subscriptions.length}</p></Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[{ value: 'active', label: 'Active', count: activeCount }, { value: 'all', label: 'All', count: subscriptions.length }]}
      />
      <DataTable columns={columns} rows={rows} pageSize={10} empty="No subscribers yet." />
    </div>
  )
}
