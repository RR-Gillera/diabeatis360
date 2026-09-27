import { useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import DataTable, { Tabs } from '../components/DataTable'
import { Button, Notice, PageHeader, StatusBadge } from '../components/ui'
import { ageFrom, formatDate, toDate } from '../lib/format'
import { guardianRelationshipLabels } from '../lib/labels'
import { useCollection } from '../lib/useCollection'
import { approveGuardian, notifyGuardianDecision, rejectGuardian } from '../services/guardians'

// Guardian Verification (DECISIONS.md D16; manuscript Scope & Limitations, UT-005). A pediatric account
// cannot book a consultation until its guardian's ID here is approved (firestore.rules enforces the same rule).
export default function GuardiansPage() {
  const { admin } = useAuth()
  const verifications = useCollection('Guardian_Verifications')
  const users = useCollection('Users')
  const [tab, setTab] = useState('pending')
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const byUser = Object.fromEntries(users.data.map((user) => [user.id, user]))
    return verifications.data
      .map((entry) => {
        const child = byUser[entry.id]
        return {
          id: entry.id,
          childName: child?.full_name || 'Unknown patient',
          childAge: ageFrom(child?.birthdate),
          guardianName: entry.guardian_full_name || 'Unnamed guardian',
          relationship: guardianRelationshipLabels[entry.relationship_to_minor] || entry.relationship_to_minor || '—',
          photoUrl: entry.guardian_id_photo_url || '',
          status: entry.verification_status || 'pending',
          rejectionReason: entry.rejection_reason || '',
          submittedAt: entry.submitted_at,
        }
      })
      .sort((a, b) => (toDate(b.submittedAt)?.getTime() ?? 0) - (toDate(a.submittedAt)?.getTime() ?? 0))
  }, [verifications.data, users.data])

  const counts = useMemo(() => ({
    pending: rows.filter((row) => row.status === 'pending').length,
    approved: rows.filter((row) => row.status === 'approved').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    all: rows.length,
  }), [rows])

  const shown = tab === 'all' ? rows : rows.filter((row) => row.status === tab)

  const approve = async (row) => {
    setBusyId(row.id)
    setError('')
    try {
      await approveGuardian(row.id, admin.id)
      await notifyGuardianDecision(row.id, true, '')
    } catch (value) {
      setError(value.message)
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (row) => {
    if (!reason.trim()) return
    setBusyId(row.id)
    setError('')
    try {
      await rejectGuardian(row.id, admin.id, reason)
      await notifyGuardianDecision(row.id, false, reason)
      setRejectingId(null)
      setReason('')
    } catch (value) {
      setError(value.message)
    } finally {
      setBusyId(null)
    }
  }

  const statusTone = { pending: 'warning', approved: 'success', rejected: 'danger' }

  const columns = [
    { key: 'child', header: 'Child', render: (row) => (<div><p className="font-bold">{row.childName}</p><p className="text-xs text-muted">{row.childAge != null ? `${row.childAge} years old` : 'Age unknown'}</p></div>) },
    { key: 'guardian', header: 'Guardian', render: (row) => (<div><p className="font-bold">{row.guardianName}</p><p className="text-xs text-muted">{row.relationship}</p></div>) },
    { key: 'id', header: 'ID photo', render: (row) => (row.photoUrl ? <a href={row.photoUrl} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">View ID →</a> : '—') },
    { key: 'submitted', header: 'Submitted', render: (row) => formatDate(row.submittedAt) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge tone={statusTone[row.status]}>{row.status[0].toUpperCase() + row.status.slice(1)}</StatusBadge>
          {row.status === 'rejected' && row.rejectionReason ? <p className="mt-1 max-w-xs text-xs text-muted">{row.rejectionReason}</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        if (row.status !== 'pending') return null
        if (rejectingId === row.id) {
          return (
            <div className="flex flex-col items-end gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for rejecting…"
                className="w-56 rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-3 !py-2 !text-xs" onClick={() => { setRejectingId(null); setReason('') }}>Cancel</Button>
                <Button variant="danger" className="!px-3 !py-2 !text-xs" disabled={busyId === row.id || !reason.trim()} onClick={() => reject(row)}>Confirm Reject</Button>
              </div>
            </div>
          )
        }
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="!px-4 !py-2" disabled={busyId === row.id} onClick={() => setRejectingId(row.id)}>Reject</Button>
            <Button className="!px-4 !py-2" disabled={busyId === row.id} onClick={() => approve(row)}>Approve</Button>
          </div>
        )
      },
    },
  ]

  const loadError = verifications.error || users.error

  return (
    <div>
      <PageHeader title="Guardian Verification" subtitle="Pediatric accounts (DECISIONS.md D16) cannot book a consultation until the guardian's ID here is approved." />
      {loadError || error ? <div className="mb-4"><Notice>{loadError || error}</Notice></div> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Pending', count: counts.pending },
          { value: 'approved', label: 'Approved', count: counts.approved },
          { value: 'rejected', label: 'Rejected', count: counts.rejected },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />
      <DataTable columns={columns} rows={shown} empty="No guardian verifications yet. They appear when a patient sets up a pediatric account." />
    </div>
  )
}
