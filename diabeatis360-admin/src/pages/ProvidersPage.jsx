import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import DataTable from '../components/DataTable'
import { Button, Card, ConfirmDialog, Modal, Notice, PageHeader, PageTabs, SearchInput, SelectField, StatusBadge, StatusToggle, TextField } from '../components/ui'
import { feeProblem, MAX_CONSULTATION_FEE } from '../lib/fee'
import { formatDate, formatPeso } from '../lib/format'
import { useCollection } from '../lib/useCollection'
import {
  approveCredentials, notifyCredentialsDecision, notifyDoctorDecision, rejectCredentials, rejectDoctor, removeCredentials,
  setDoctorActive, subscribeToDoctors, subscribeToProfilePhoto, verifyDoctor,
} from '../services/doctors'
import { addProvider } from '../services/provisionDoctor'

// Doctors register their own PRC credentials in the mobile app; this page (Doctor Management, module 10)
// verifies or rejects them, activates/deactivates the account, and lets an admin add one directly
// (manuscript UT-A006 "Add Doctor Profile" — see services/provisionDoctor.js for how that works safely).
// It also reviews the credentials doctors ask to show after their name ("MD, FPCP", D55 part 1): the Credential
// Requests tab lists every doctor with one waiting, whether or not their account is verified yet.
const SPECIALIZATIONS = ['Endocrinologist', 'Diabetologist', 'Nutritionist', 'Internal Medicine', 'Family Medicine', 'General Practitioner']
const emptyForm = { fullName: '', email: '', specialty: SPECIALIZATIONS[0], prcLicenseNumber: '', city: '', consultationFee: '' }

export default function ProvidersPage() {
  const { admin } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [loadError, setLoadError] = useState('')
  const bookings = useCollection('Bookings')

  const [tab, setTab] = useState('verified')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null) // the doctor shown in the credential modal
  const [confirmReject, setConfirmReject] = useState(false)
  const [credentialAction, setCredentialAction] = useState(null) // 'reject' | 'remove' while its reason dialog is open
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => subscribeToDoctors(setDoctors, (value) => setLoadError(value.message)), [])

  const consultsByDoctor = useMemo(() => {
    const counts = {}
    bookings.data.forEach((booking) => { counts[booking.provider_id] = (counts[booking.provider_id] ?? 0) + 1 })
    return counts
  }, [bookings.data])

  // Three kinds: verified; pending (waiting for an admin); rejected (waiting for the doctor to correct and resubmit).
  const kindOf = (doctor) => (doctor.is_verified ? 'verified' : doctor.rejection_reason ? 'rejected' : 'pending')
  const counts = useMemo(() => ({
    verified: doctors.filter((doctor) => kindOf(doctor) === 'verified').length,
    pending: doctors.filter((doctor) => kindOf(doctor) === 'pending').length,
    rejected: doctors.filter((doctor) => kindOf(doctor) === 'rejected').length,
    credentials: doctors.filter(wantsCredentialReview).length,
  }), [doctors])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return doctors
      .filter((doctor) => (tab === 'credentials' ? wantsCredentialReview(doctor) : kindOf(doctor) === tab))
      .filter((doctor) => !needle || [doctor.full_name, doctor.credentials, doctor.credentials_requested, doctor.specialty, doctor.prc_license_number, doctor.city]
        .some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')))
  }, [doctors, tab, search])

  const runAction = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (value) {
      setError(value.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const onVerify = (doctorRow) => runAction(async () => {
    await verifyDoctor(doctorRow.id, admin.id)
    await notifyDoctorDecision(doctorRow.id, true, '')
    setSelected(null)
  })

  const onReject = (reason) => runAction(async () => {
    await rejectDoctor(selected.id, admin.id, reason)
    await notifyDoctorDecision(selected.id, false, reason)
    setConfirmReject(false)
    setSelected(null)
  })

  // Credentials after the name (D55). The modal keeps showing the doctor, updated with what was just written.
  const onApproveCredentials = () => runAction(async () => {
    const requested = selected.credentials_requested
    await approveCredentials(selected.id, requested)
    await notifyCredentialsDecision(selected.id, 'approved', requested, '')
    setSelected((current) => ({ ...current, credentials: requested, credentials_requested: '', credentials_rejection_reason: '' }))
  })

  const onCredentialReason = (reason) => runAction(async () => {
    if (credentialAction === 'reject') {
      await rejectCredentials(selected.id, reason)
      await notifyCredentialsDecision(selected.id, 'rejected', selected.credentials_requested, reason)
      setSelected((current) => ({ ...current, credentials_rejection_reason: reason.trim() }))
    } else {
      await removeCredentials(selected.id)
      await notifyCredentialsDecision(selected.id, 'removed', selected.credentials, reason)
      setSelected((current) => ({ ...current, credentials: '' }))
    }
    setCredentialAction(null)
  })

  const onToggleActive = (active) => runAction(async () => {
    await setDoctorActive(selected.id, active)
    setSelected((current) => ({ ...current, is_active: active }))
  })

  const onAddProvider = async (event) => {
    event.preventDefault()
    if (!form.fullName.trim() || !form.email.trim() || !form.prcLicenseNumber.trim() || !form.city.trim() || !String(form.consultationFee).trim()) {
      setError('Please fill in all required fields.')
      return
    }
    // QA ADM-005: -100 used to pass (`!Number(fee)` only refused 0 and blank). Checked before anything is created.
    const feeError = feeProblem(form.consultationFee)
    if (feeError) {
      setError(feeError)
      return
    }
    await runAction(async () => {
      await addProvider(form, admin.id)
      setAddOpen(false)
      setForm(emptyForm)
    })
  }

  const columns = [
    { key: 'name', header: 'Provider', render: (d) => (<div><p className="font-bold">{withCredentials(d.full_name || 'Unnamed', d.credentials)}</p><p className="text-xs text-muted">{d.email || d.id}</p></div>) },
    { key: 'specialty', header: 'Specialty', render: (d) => d.specialty || '—' },
    { key: 'prc', header: 'PRC license', render: (d) => d.prc_license_number || '—' },
    { key: 'city', header: 'City', render: (d) => d.city || '—' },
    { key: 'consults', header: 'Consults', align: 'right', render: (d) => consultsByDoctor[d.id] ?? 0 },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={d.is_verified ? 'success' : d.rejection_reason ? 'danger' : 'warning'}>{d.is_verified ? 'Verified' : d.rejection_reason ? 'Rejected' : 'Pending'}</StatusBadge>
          {d.is_active === false ? <StatusBadge tone="danger">Inactive</StatusBadge> : null}
          {wantsCredentialReview(d) ? <StatusBadge tone="warning">Credentials to review</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (d) => <Button variant="outline" className="!px-4 !py-2" onClick={() => setSelected(d)}>View Profile</Button>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Providers"
        subtitle="Manage healthcare professionals and pending applications."
        actions={<Button onClick={() => { setForm(emptyForm); setError(''); setAddOpen(true) }}>+ Add Provider</Button>}
      />
      {loadError || (error && !selected && !addOpen) ? <div className="mb-4"><Notice>{loadError || error}</Notice></div> : null}
      <PageTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'verified', label: 'Verified' },
          { value: 'pending', label: 'Pending Approval', count: counts.pending },
          { value: 'rejected', label: 'Rejected', count: counts.rejected },
          { value: 'credentials', label: 'Credential Requests', count: counts.credentials },
        ]}
      />
      <SearchInput className="mb-4 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search providers by name, specialty, or license…" />
      <DataTable columns={columns} rows={rows} pageSize={10} empty={tab === 'pending' ? 'No providers are waiting for approval.' : tab === 'rejected' ? 'No rejected providers are waiting to resubmit.' : tab === 'credentials' ? 'No credentials are waiting for review.' : 'No verified providers yet.'} />

      {/* FIGMA/ADMIN "Doctor Credential Verification" modal */}
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Doctor Credential Verification" maxWidth="max-w-2xl">
        {selected ? (
          <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
            <div>
              <DoctorPhoto uid={selected.id} name={selected.full_name} />
              <p className="mt-3 text-lg font-extrabold">{withCredentials(selected.full_name || 'Unnamed', selected.credentials)}</p>
              <p className="text-xs text-muted">#{selected.id.slice(0, 8).toUpperCase()}</p>
              <div className="mt-2"><StatusBadge tone={selected.is_verified ? 'success' : 'warning'}>{selected.is_verified ? 'Verified' : 'Awaiting verification'}</StatusBadge></div>
              <div className="mt-4 space-y-3 text-sm">
                <div><p className="text-xs font-bold uppercase text-muted">Specialty</p><p>{selected.specialty || '—'}</p></div>
                <div><p className="text-xs font-bold uppercase text-muted">Email</p><p className="break-words">{selected.email || '—'}</p></div>
                <div><p className="text-xs font-bold uppercase text-muted">City</p><p>{selected.city || '—'}</p></div>
                <div><p className="text-xs font-bold uppercase text-muted">Fee</p><p>{formatPeso(selected.consultation_fee)}</p></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Professional credentials</p>
              <div className="mt-2 rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-bold uppercase text-muted">PRC license number</p>
                <p className="mt-1 font-mono text-sm">{selected.prc_license_number || '—'}</p>
                <p className="mt-3 text-xs font-bold uppercase text-muted">License expiry</p>
                <p className="mt-1 text-sm">{selected.license_expiry ? formatDate(selected.license_expiry) : '—'}</p>
                {selected.created_by_admin ? <p className="mt-3 text-xs text-muted">Profile created by an admin.</p> : null}
                {selected.rejection_reason ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">Last rejection note: {selected.rejection_reason}</p> : null}
              </div>

              <CredentialsReview
                doctor={selected}
                busy={busy}
                onApprove={onApproveCredentials}
                onReject={() => setCredentialAction('reject')}
                onRemove={() => setCredentialAction('remove')}
              />

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">Set account status</p>
              <div className="mt-2"><StatusToggle value={selected.is_active !== false} onChange={onToggleActive} disabled={busy} /></div>

              {error ? <div className="mt-4"><Notice>{error}</Notice></div> : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button disabled={busy || selected.is_verified} onClick={() => onVerify(selected)}>Verify Credentials</Button>
                <Button variant="dangerOutline" disabled={busy} onClick={() => setConfirmReject(true)}>Reject Credentials</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmReject}
        title="Reject credentials"
        message={`${selected?.full_name || 'This doctor'} will see this reason on their pending-verification screen and can resubmit.`}
        confirmLabel="Reject Credentials"
        danger
        requireReason
        reasonLabel="Reason for rejecting"
        busy={busy}
        onCancel={() => setConfirmReject(false)}
        onConfirm={onReject}
      />

      <ConfirmDialog
        open={Boolean(credentialAction)}
        title={credentialAction === 'reject' ? 'Reject credentials' : 'Remove credentials'}
        message={credentialAction === 'reject'
          ? `${selected?.full_name || 'This doctor'} will see this reason in Edit Profile and can change their credentials and ask again.`
          : `Patients will stop seeing "${selected?.credentials ?? ''}" after the name of ${selected?.full_name || 'this doctor'}. The doctor is told why.`}
        confirmLabel={credentialAction === 'reject' ? 'Reject Credentials' : 'Remove Credentials'}
        danger
        requireReason
        reasonLabel={credentialAction === 'reject' ? 'Reason for rejecting' : 'Reason for removing'}
        busy={busy}
        onCancel={() => setCredentialAction(null)}
        onConfirm={onCredentialReason}
      />

      {/* "+ Add Provider" (UT-A006) */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Provider" maxWidth="max-w-lg">
        <form onSubmit={onAddProvider} className="space-y-4" noValidate>
          <TextField label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <TextField label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <SelectField label="Specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
            {SPECIALIZATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <TextField label="PRC license number" value={form.prcLicenseNumber} onChange={(e) => setForm({ ...form, prcLicenseNumber: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField label="Consultation fee (₱)" type="number" min="1" max={MAX_CONSULTATION_FEE} step="0.01" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} />
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <Card className="!bg-gray-50 !p-4 !shadow-none">
            <p className="text-xs text-muted">
              A doctor login is created with a random password nobody sees. They will get a password-reset
              email at this address to set their own, and their profile is verified immediately since you are
              adding it yourself.
            </p>
          </Card>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Add Provider'}</Button>
        </form>
      </Modal>
    </div>
  )
}

/** Credentials the doctor asked for that no admin has answered yet (a rejected request waits for the doctor instead). */
function wantsCredentialReview(doctor) {
  return Boolean(doctor.credentials_requested) && !doctor.credentials_rejection_reason
}

/** "Dr. Juan Dela Cruz" + "MD, FPCP" -> "Dr. Juan Dela Cruz, MD, FPCP", the way patients see an approved suffix. */
function withCredentials(name, credentials) {
  return credentials ? `${name}, ${credentials}` : name
}

// The credentials after the doctor's name (D55 part 1): what patients see now, and a request waiting for this admin.
// Approving shows exactly what the doctor typed; the admin cannot edit it (firestore.rules), only approve or reject.
function CredentialsReview({ doctor, busy, onApprove, onReject, onRemove }) {
  const requested = doctor.credentials_requested || ''
  const refused = doctor.credentials_rejection_reason || ''
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Credentials after the name</p>
      <div className="mt-2 rounded-2xl border border-gray-100 p-4 text-sm">
        <p className="text-xs font-bold uppercase text-muted">Patients see</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className={doctor.credentials ? 'font-mono' : 'text-muted'}>{doctor.credentials || 'No credentials approved'}</p>
          {doctor.credentials ? <Button variant="dangerOutline" className="!px-3 !py-1.5 !text-xs" disabled={busy} onClick={onRemove}>Remove</Button> : null}
        </div>
        {requested ? (
          <div className={`mt-3 rounded-xl p-3 ${refused ? 'bg-red-50' : 'bg-amber-50'}`}>
            <p className="text-xs font-bold uppercase text-muted">Requested by the doctor</p>
            <p className="mt-1 font-mono">{requested}</p>
            {refused ? (
              <p className="mt-2 text-xs text-red-700">Not approved: {refused}. Waiting for the doctor to change it.</p>
            ) : (
              <>
                <p className="mt-2 text-xs text-muted">
                  Check each title (degree, fellowship, board) before approving. Patients will see{' '}
                  <span className="font-bold">{withCredentials(doctor.full_name || 'the doctor', requested)}</span>.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button disabled={busy} onClick={onApprove}>Approve Credentials</Button>
                  <Button variant="dangerOutline" disabled={busy} onClick={onReject}>Reject</Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// The doctor's profile photo (D54), so the admin can check it is a real, clear photo of a face before verifying.
// Patients see it on Find a Doctor; a doctor without one is not listed there.
function DoctorPhoto({ uid, name }) {
  const [photo, setPhoto] = useState({ uid: null, value: null })
  useEffect(() => subscribeToProfilePhoto(uid, (value) => setPhoto({ uid, value })), [uid])
  const value = photo.uid === uid ? photo.value : null
  if (!value) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gray-100 p-3 text-center text-xs text-muted">
        No profile photo yet. Patients can&apos;t find this doctor until one is added.
      </div>
    )
  }
  return <img src={value} alt={`Profile photo of ${name || 'this doctor'}`} className="h-28 w-28 rounded-3xl object-cover" />
}
