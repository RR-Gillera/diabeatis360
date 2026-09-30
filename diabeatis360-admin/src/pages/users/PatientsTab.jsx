import { useMemo, useState } from 'react'

import DataTable from '../../components/DataTable'
import { Button, ConfirmDialog, Drawer, Notice, SearchInput, StatusBadge, StatusToggle } from '../../components/ui'
import { formatDate, formatDateTime, toDate } from '../../lib/format'
import { effectiveStatus } from '../../lib/subscriptions'
import { useCollection, useFilteredCollection } from '../../lib/useCollection'
import { setUserActive } from '../../services/users'

/** Read-only mini table of one patient's readings, inside the drawer (manuscript UT-A011). */
function GlucoseLogs({ patientId }) {
  const logs = useFilteredCollection('Glucose_Logs', 'patient_id', patientId)
  const rows = [...logs.data].sort((a, b) => (toDate(b.logged_at)?.getTime() ?? 0) - (toDate(a.logged_at)?.getTime() ?? 0)).slice(0, 15)
  const tone = { critical: 'danger', high: 'warning', low: 'warning', normal: 'success' }

  if (logs.loading) return <p className="text-sm text-muted">Loading readings…</p>
  if (rows.length === 0) return <p className="text-sm text-muted">No blood sugar readings logged yet.</p>
  return (
    <div className="space-y-2">
      {rows.map((log) => (
        <div key={log.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
          <div>
            <p className="font-bold">{log.reading_mgdl ?? '—'} mg/dL</p>
            <p className="text-xs text-muted">{formatDateTime(log.logged_at)} · {log.context === 'after_meal' ? 'After meal' : 'Before meal'}</p>
          </div>
          <StatusBadge tone={tone[log.interpretation] ?? 'neutral'}>{log.interpretation ?? '—'}</StatusBadge>
        </div>
      ))}
    </div>
  )
}

// FIGMA/ADMIN "User Management Page" + "-1" (details drawer). Users holds both roles (D9), so every
// count/list here filters role == 'patient' — doctors have their own page (Providers).
export default function PatientsTab() {
  const users = useCollection('Users')
  const subscriptions = useCollection('Subscriptions')
  const plans = useCollection('Subscription_Plans')
  const gamification = useCollection('Gamification')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [pendingActive, setPendingActive] = useState(null) // true/false while confirming
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const planById = useMemo(() => Object.fromEntries(plans.data.map((plan) => [plan.id, plan.plan_name])), [plans.data])
  const subByUser = useMemo(() => {
    const map = {}
    subscriptions.data.forEach((sub) => {
      if (effectiveStatus(sub) === 'active') map[sub.user_id] = planById[sub.plan_id] ?? 'Premium'
    })
    return map
  }, [subscriptions.data, planById])
  const gamificationByUser = useMemo(() => Object.fromEntries(gamification.data.map((g) => [g.user_id ?? g.id, g])), [gamification.data])

  const patients = useMemo(() => users.data.filter((user) => user.role === 'patient'), [users.data]) // D9

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return patients
      .filter((user) => !needle || [user.full_name, user.email].some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')))
  }, [patients, search])

  const applyStatus = async (active) => {
    setBusy(true)
    setError('')
    try {
      await setUserActive(selected.id, active)
      setSelected((current) => ({ ...current, is_active: active }))
      setPendingActive(null)
    } catch (value) {
      setError(value.message || 'Could not update this patient.')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'name', header: 'User', render: (u) => (<div><p className="font-bold">{u.full_name || 'Unnamed'}</p><p className="text-xs text-muted">{u.email || u.id}</p></div>) },
    { key: 'plan', header: 'Plan', render: (u) => <StatusBadge tone={subByUser[u.id] ? 'success' : 'neutral'}>{subByUser[u.id] ?? 'Free'}</StatusBadge> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge tone={u.is_active === false ? 'danger' : 'success'}>{u.is_active === false ? 'Inactive' : 'Active'}</StatusBadge> },
    { key: 'joined', header: 'Joined date', render: (u) => formatDate(u.created_at) },
    { key: 'actions', header: '', align: 'right', render: (u) => <Button variant="outline" className="!px-4 !py-2" onClick={() => setSelected(u)}>View</Button> },
  ]

  const stats = selected ? gamificationByUser[selected.id] : null

  return (
    <div>
      {users.error || (error && !selected) ? <div className="mb-4"><Notice>{users.error || error}</Notice></div> : null}
      <SearchInput className="mb-4 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or ID…" />
      <DataTable columns={columns} rows={rows} pageSize={10} empty="No patients found." />

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="User Details">
        {selected ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-xl font-extrabold text-brand-dark">
                {(selected.full_name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <p className="mt-3 text-lg font-extrabold">{selected.full_name || 'Unnamed'}</p>
              <p className="text-xs text-muted">#{selected.id.slice(0, 8).toUpperCase()}</p>
              <div className="mt-2 flex justify-center"><StatusBadge tone={selected.is_active === false ? 'danger' : 'success'}>{selected.is_active === false ? 'Inactive user' : 'Active user'}</StatusBadge></div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Contact information</p>
              <div className="space-y-2 rounded-2xl border border-gray-100 p-4 text-sm">
                <p><span className="text-muted">Email address</span><br /><span className="font-bold">{selected.email || '—'}</span></p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Account information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Registration date</p><p className="font-bold">{formatDate(selected.created_at)}</p></div>
                <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Plan</p><p className="font-bold">{subByUser[selected.id] ?? 'Free'}</p></div>
                <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Diabetes type</p><p className="font-bold">{selected.diabetes_type || '—'}</p></div>
                <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Allergies</p><p className="font-bold">{selected.allergies || 'None'}</p></div>
              </div>
            </div>

            {stats ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Wellness</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Award points</p><p className="font-extrabold text-brand">{stats.total_points ?? 0}</p></div>
                  <div className="rounded-2xl border border-gray-100 p-3 text-sm"><p className="text-xs text-muted">Current streak</p><p className="font-extrabold">{stats.streak_count ?? 0} days</p></div>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Blood sugar logs (UT-A011)</p>
              <GlucoseLogs patientId={selected.id} />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Set status</p>
              <StatusToggle
                value={selected.is_active !== false}
                disabled={busy}
                onChange={(next) => { if (!next) setPendingActive(false); else applyStatus(true) }}
              />
            </div>

            {error ? <Notice>{error}</Notice> : null}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={pendingActive === false}
        title="Deactivate account"
        message={`Deactivate ${selected?.full_name || 'this user'}? They will be signed out of the app immediately.`}
        confirmLabel="Deactivate"
        danger
        busy={busy}
        onCancel={() => setPendingActive(null)}
        onConfirm={() => applyStatus(false)}
      />
    </div>
  )
}
