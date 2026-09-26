import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import DataTable, { Tabs } from '../components/DataTable'
import { Button, Notice, PageHeader, StatusBadge } from '../components/ui'
import { formatPeso } from '../lib/format'
import { setDoctorActive, subscribeToDoctors, verifyDoctor } from '../services/doctors'

// Doctor Management (module 10): verify a doctor's PRC credentials, then activate or deactivate the account.
// An unverified doctor only sees a "verification in progress" screen in the mobile app.
export default function DoctorsPage() {
  const { admin } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => subscribeToDoctors(setDoctors, (value) => setError(value.message)), [])

  const counts = useMemo(() => ({
    pending: doctors.filter((doctor) => !doctor.is_verified).length,
    verified: doctors.filter((doctor) => doctor.is_verified).length,
    all: doctors.length,
  }), [doctors])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return doctors
      .filter((doctor) => (tab === 'pending' ? !doctor.is_verified : tab === 'verified' ? doctor.is_verified : true))
      .filter((doctor) => !needle || [doctor.full_name, doctor.specialty, doctor.prc_license_number, doctor.city]
        .some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')))
  }, [doctors, tab, search])

  const run = async (doctor, action, failure) => {
    setBusyId(doctor.id)
    setError('')
    try {
      await action()
    } catch {
      setError(failure)
    } finally {
      setBusyId(null)
    }
  }

  const onVerify = (doctor) => run(doctor, () => verifyDoctor(doctor.id, admin.id), `Could not verify ${doctor.full_name || 'this doctor'}.`)

  const onToggleActive = (doctor) => {
    const deactivating = doctor.is_active !== false
    if (deactivating && !window.confirm(`Deactivate ${doctor.full_name || 'this doctor'}? They will be signed out and hidden from patients.`)) return
    run(doctor, () => setDoctorActive(doctor.id, !deactivating), `Could not update ${doctor.full_name || 'this doctor'}.`)
  }

  const columns = [
    { key: 'name', header: 'Doctor', render: (d) => (<div><p className="font-bold">{d.full_name || 'Unnamed'}</p><p className="text-xs text-muted">{d.email || d.id}</p></div>) },
    { key: 'specialty', header: 'Specialty', render: (d) => d.specialty || '—' },
    { key: 'prc', header: 'PRC license no.', render: (d) => d.prc_license_number || '—' },
    { key: 'city', header: 'City', render: (d) => d.city || '—' },
    { key: 'fee', header: 'Fee', render: (d) => formatPeso(d.consultation_fee) },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={d.is_verified ? 'success' : 'warning'}>{d.is_verified ? 'Verified' : 'Pending'}</StatusBadge>
          {d.is_active === false ? <StatusBadge tone="danger">Inactive</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-2">
          {!d.is_verified ? (
            <Button className="!px-4 !py-2" disabled={busyId === d.id} onClick={() => onVerify(d)}>Verify credentials</Button>
          ) : null}
          <Button
            variant={d.is_active === false ? 'outline' : 'ghost'}
            className="!px-4 !py-2"
            disabled={busyId === d.id}
            onClick={() => onToggleActive(d)}
          >
            {d.is_active === false ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Verify PRC credentials, then activate or deactivate doctor accounts."
        actions={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, license, city…" className="w-72 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand" />}
      />
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Pending verification', count: counts.pending },
          { value: 'verified', label: 'Verified', count: counts.verified },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />
      <DataTable columns={columns} rows={rows} empty={tab === 'pending' ? 'No doctors are waiting for verification.' : 'No doctors found.'} />
    </div>
  )
}
