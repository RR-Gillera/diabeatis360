import { useState } from 'react'

import DataTable from '../../components/DataTable'
import { Button, Card, ConfirmDialog, Notice, TextField } from '../../components/ui'
import { formatPeso } from '../../lib/format'
import { createPlan, deletePlan, updatePlan } from '../../services/plans'

const emptyForm = { name: '', price: '', durationDays: '' }

// Manage Membership Plans (module 12, admin): add, edit and remove the plans patients see in the mobile app.
// DECISIONS.md D5: Free (price 0), Premium Monthly 99, 6-Month 499, Annual 899.
export default function PlansTab({ plans }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = [...plans].sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))

  const startEdit = (plan) => {
    setEditingId(plan.id)
    setForm({ name: plan.plan_name ?? '', price: String(plan.price ?? ''), durationDays: String(plan.duration_days ?? '') })
    setMessage(null)
  }

  const reset = () => { setEditingId(null); setForm(emptyForm) }

  const save = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || form.price === '' || form.durationDays === '') {
      setMessage({ tone: 'error', text: 'Please fill in all required fields.' })
      return
    }
    if (Number(form.price) < 0 || Number(form.durationDays) < 0 || Number.isNaN(Number(form.price)) || Number.isNaN(Number(form.durationDays))) {
      setMessage({ tone: 'error', text: 'Price and duration must be numbers that are zero or more.' })
      return
    }
    setBusy(true)
    try {
      if (editingId) await updatePlan(editingId, form)
      else await createPlan(form)
      setMessage({ tone: 'success', text: editingId ? 'Plan updated.' : 'Plan added.' })
      reset()
    } catch {
      setMessage({ tone: 'error', text: 'We could not save the plan. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deletePlan(deleting.id)
      if (editingId === deleting.id) reset()
      setMessage({ tone: 'success', text: 'Plan deleted.' })
      setDeleting(null)
    } catch {
      setMessage({ tone: 'error', text: 'We could not delete the plan.' })
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Plan', render: (p) => <span className="font-bold">{p.plan_name}</span> },
    { key: 'price', header: 'Price', render: (p) => (Number(p.price) === 0 ? 'Free' : formatPeso(p.price)) },
    { key: 'duration', header: 'Duration', render: (p) => (Number(p.duration_days) === 0 ? '—' : `${p.duration_days} days`) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="!px-4 !py-2" onClick={() => startEdit(p)}>Edit</Button>
          <Button variant="ghost" className="!px-4 !py-2" onClick={() => setDeleting(p)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={save} className="grid gap-4 md:grid-cols-4" noValidate>
          <TextField label="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Price (₱)" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <TextField label="Duration (days)" type="number" min="0" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy}>{editingId ? 'Save changes' : 'Add plan'}</Button>
            {editingId ? <Button variant="ghost" onClick={reset}>Cancel</Button> : null}
          </div>
        </form>
        {message ? <div className="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
      </Card>
      <DataTable columns={columns} rows={rows} empty="No plans yet. Add the Free, Monthly, 6-Month and Annual plans." />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete plan"
        message={`Delete "${deleting?.plan_name}"? Existing subscriptions to it keep working but will show an unknown plan.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}
