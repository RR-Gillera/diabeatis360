import { useEffect, useMemo, useState } from 'react'

import DataTable, { Tabs } from '../components/DataTable'
import { Button, Notice, PageHeader, StatusBadge } from '../components/ui'
import { formatDate } from '../lib/format'
import { setUserActive, subscribeToUsers } from '../services/users'

// User management: list every account (patients and doctors) and activate or deactivate it.
// A deactivated user is signed out of the mobile app at their next login or app start.
export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => subscribeToUsers(setUsers, (value) => setError(value.message)), [])

  const counts = useMemo(() => ({
    all: users.length,
    patient: users.filter((user) => user.role !== 'doctor').length,
    doctor: users.filter((user) => user.role === 'doctor').length,
  }), [users])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users
      .filter((user) => tab === 'all' || (tab === 'doctor' ? user.role === 'doctor' : user.role !== 'doctor'))
      .filter((user) => !needle || [user.full_name, user.email].some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')))
  }, [users, tab, search])

  const onToggle = async (user) => {
    const deactivating = user.is_active !== false
    if (deactivating && !window.confirm(`Deactivate ${user.full_name || 'this user'}? They will be signed out of the app.`)) return
    setBusyId(user.id)
    setError('')
    try {
      await setUserActive(user.id, !deactivating)
    } catch {
      setError(`Could not update ${user.full_name || 'this user'}.`)
    } finally {
      setBusyId(null)
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (u) => (<div><p className="font-bold">{u.full_name || 'Unnamed'}</p><p className="text-xs text-muted">{u.email || u.id}</p></div>) },
    { key: 'role', header: 'Role', render: (u) => <StatusBadge tone={u.role === 'doctor' ? 'warning' : 'neutral'}>{u.role === 'doctor' ? 'Doctor' : 'Patient'}</StatusBadge> },
    { key: 'type', header: 'Diabetes type', render: (u) => u.diabetes_type || '—' },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.created_at) },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge tone={u.is_active === false ? 'danger' : 'success'}>{u.is_active === false ? 'Inactive' : 'Active'}</StatusBadge> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => (
        <Button variant={u.is_active === false ? 'outline' : 'ghost'} className="!px-4 !py-2" disabled={busyId === u.id} onClick={() => onToggle(u)}>
          {u.is_active === false ? 'Activate' : 'Deactivate'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="All patient and doctor accounts."
        actions={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="w-72 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand" />}
      />
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'patient', label: 'Patients', count: counts.patient },
          { value: 'doctor', label: 'Doctors', count: counts.doctor },
        ]}
      />
      <DataTable columns={columns} rows={rows} empty="No users found." />
    </div>
  )
}
