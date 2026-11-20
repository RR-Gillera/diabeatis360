import { useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import DataTable, { Tabs } from '../components/DataTable'
import { Button, ConfirmDialog, Drawer, Notice, PageHeader, StatusBadge, TextArea } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { issueRows, REPLY_MAX } from '../lib/reportedIssues'
import { useCollection } from '../lib/useCollection'
import { setDoctorActive } from '../services/doctors'
import { reopenReport, resolveReport } from '../services/reportedIssues'
import { setUserActive } from '../services/users'

// Reported Issues (DECISIONS.md D51; manuscript Table 31 #6 "Admin can handle reported issues or flagged accounts").
// Patients and doctors send reports from the mobile app (Profile > Report a problem, or "Report this doctor / patient"
// in a consultation). The admin reads each one, can switch the flagged account off, replies and marks it resolved;
// the reporter sees the reply in the app and gets a notification. No Figma frame exists; it follows the Users page.
export default function IssuesPage() {
  const { admin } = useAuth()
  const reports = useCollection('Reports')
  const users = useCollection('Users')
  const providers = useCollection('Providers')
  const [tab, setTab] = useState('open')
  const [openId, setOpenId] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]))
    return issueRows(reports.data, byId(users.data), byId(providers.data))
  }, [reports.data, users.data, providers.data])

  const counts = {
    open: rows.filter((row) => row.status === 'open').length,
    resolved: rows.filter((row) => row.status === 'resolved').length,
    all: rows.length,
  }
  const shown = tab === 'all' ? rows : rows.filter((row) => row.status === tab)
  const current = rows.find((row) => row.id === openId) ?? null

  const openReport = (row) => { setOpenId(row.id); setReply(row.adminReply); setError('') }
  const close = () => { setOpenId(null); setReply(''); setError('') }

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (value) {
      setError(value.message)
    } finally {
      setBusy(false)
    }
  }

  const resolve = () => run(async () => { await resolveReport(current, admin.id, reply); close() })
  const reopen = () => run(() => reopenReport(current.id))
  // Same switches as the Providers and Users pages, so a deactivated account is blocked the same way everywhere.
  const switchAccount = () => run(async () => {
    const { flagged } = current
    await (flagged.kind === 'doctor' ? setDoctorActive(flagged.id, !flagged.active) : setUserActive(flagged.id, !flagged.active))
    setConfirmSwitch(false)
  })

  const statusBadge = (status) => (status === 'resolved'
    ? <StatusBadge tone="success">Resolved</StatusBadge>
    : <StatusBadge tone="warning">Open</StatusBadge>)

  const columns = [
    { key: 'when', header: 'Sent', render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span> },
    { key: 'from', header: 'From', render: (row) => (<div><p className="font-bold">{row.reporterName}</p><p className="text-xs text-muted">{row.reporterRole}</p></div>) },
    { key: 'category', header: 'About', render: (row) => (<div><p className="font-bold">{row.categoryLabel}</p>{row.flagged ? <p className="text-xs text-muted">{row.flagged.name}</p> : null}</div>) },
    { key: 'message', header: 'Message', render: (row) => <p className="max-w-sm truncate text-muted">{row.message}</p> },
    { key: 'status', header: 'Status', render: (row) => statusBadge(row.status) },
    { key: 'actions', header: '', align: 'right', render: (row) => <Button variant="outline" className="!px-4 !py-2" onClick={() => openReport(row)}>Review</Button> },
  ]

  const loadError = reports.error || users.error || providers.error
  const emptyMessages = {
    open: 'No open reports. New reports from the mobile app appear here.',
    resolved: 'No resolved reports yet.',
    all: 'No reports yet. Patients and doctors send them from Profile > Report a problem.',
  }

  return (
    <div>
      <PageHeader title="Reported Issues" subtitle="Problems and flagged accounts reported by patients and doctors." />
      {loadError ? <div className="mb-4"><Notice>{loadError}</Notice></div> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Open', count: counts.open },
          { value: 'resolved', label: 'Resolved', count: counts.resolved },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />
      <DataTable columns={columns} rows={shown} pageSize={10} empty={emptyMessages[tab]} />

      <Drawer
        open={Boolean(current)}
        onClose={close}
        title="Report details"
        footer={current ? (
          <div className="flex justify-end gap-3">
            {current.status === 'resolved'
              ? <Button variant="outline" disabled={busy} onClick={reopen}>Reopen</Button>
              : null}
            <Button disabled={busy} onClick={resolve}>{current.status === 'resolved' ? 'Update reply' : 'Resolve and notify'}</Button>
          </div>
        ) : null}
      >
        {current ? (
          <div className="flex flex-col gap-5 text-sm">
            {error ? <Notice>{error}</Notice> : null}
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold">{current.categoryLabel}</p>
              {statusBadge(current.status)}
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
              <dt className="text-muted">From</dt><dd className="col-span-2 font-bold">{current.reporterName} ({current.reporterRole})</dd>
              <dt className="text-muted">Sent</dt><dd className="col-span-2">{formatDateTime(current.createdAt)}</dd>
              {current.bookingId ? (<><dt className="text-muted">Booking</dt><dd className="col-span-2 break-all">{current.bookingId}</dd></>) : null}
              {current.resolvedAt ? (<><dt className="text-muted">Resolved</dt><dd className="col-span-2">{formatDateTime(current.resolvedAt)}</dd></>) : null}
            </dl>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">What they wrote</p>
              <p className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-4">{current.message}</p>
            </div>

            {current.flagged ? (
              <div className="rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Flagged {current.flagged.kind}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{current.flagged.name}</p>
                    <p className="text-xs text-muted">{current.flagged.active ? 'Account active' : 'Account deactivated'}</p>
                  </div>
                  <Button
                    variant={current.flagged.active ? 'dangerOutline' : 'outline'}
                    className="!px-4 !py-2"
                    disabled={busy}
                    onClick={() => setConfirmSwitch(true)}
                  >
                    {current.flagged.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <TextArea
                label="Reply to the reporter (optional)"
                rows={4}
                maxLength={REPLY_MAX}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="What you did about it. The reporter sees this in the app."
              />
              <p className="mt-1 text-right text-xs text-muted">{reply.trim().length} / {REPLY_MAX}</p>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmSwitch && Boolean(current?.flagged)}
        title={current?.flagged?.active ? 'Deactivate account' : 'Reactivate account'}
        message={current?.flagged?.active
          ? `Deactivate ${current?.flagged?.name}? They are signed out of the app${current?.flagged?.kind === 'doctor' ? ' and hidden from Find a Doctor' : ''}. Their records are kept.`
          : `Reactivate ${current?.flagged?.name}? They can sign in again.`}
        confirmLabel={current?.flagged?.active ? 'Deactivate' : 'Reactivate'}
        danger={Boolean(current?.flagged?.active)}
        busy={busy}
        onCancel={() => setConfirmSwitch(false)}
        onConfirm={switchAccount}
      />
    </div>
  )
}
