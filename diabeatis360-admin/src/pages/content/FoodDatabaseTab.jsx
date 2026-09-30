import { useMemo, useState } from 'react'

import { useAuth } from '../../auth/AuthContext'
import DataTable, { Tabs } from '../../components/DataTable'
import { Button, ConfirmDialog, Modal, Notice, SearchInput, SelectField, StatusBadge, TextField } from '../../components/ui'
import { useCollection } from '../../lib/useCollection'
import { createFood, deleteFood, foodCategories, setFoodStatus, updateFood } from '../../services/foodDatabase'

const emptyForm = { name: '', glycemicIndex: '', category: foodCategories[0], calories: '' }

// Food Database CRUD (manuscript UT-A008 add, UT-A009 edit, UT-A010 delete). Grounds the AI meal prompts —
// functions/lib/prompts.js reads this collection directly when generating meal suggestions.
export default function FoodDatabaseTab() {
  const { admin } = useAuth()
  const foods = useCollection('Food_Database')
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // food being edited, or null for "add new"
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return foods.data
      .filter((food) => status === 'all' || (food.status ?? 'active') === status)
      .filter((food) => !needle || [food.food_name, food.category].some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => String(a.food_name ?? '').localeCompare(String(b.food_name ?? '')))
  }, [foods.data, status, search])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true) }
  const openEdit = (food) => {
    setEditing(food)
    setForm({ name: food.food_name ?? '', glycemicIndex: String(food.glycemic_index ?? ''), category: food.category ?? foodCategories[0], calories: String(food.calories ?? '') })
    setError('')
    setModalOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    const gi = Number(form.glycemicIndex)
    const calories = Number(form.calories)
    if (!form.name.trim() || form.glycemicIndex === '' || form.calories === '') {
      setError('Please fill in all required fields.')
      return
    }
    if (Number.isNaN(gi) || gi < 0 || gi > 100) {
      setError('Glycemic index must be a number from 0 to 100.')
      return
    }
    if (Number.isNaN(calories) || calories < 0) {
      setError('Calories must be zero or more.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editing) await updateFood(editing.id, form)
      else await createFood(form, admin.id)
      setModalOpen(false)
    } catch (value) {
      setError(value.message || 'We could not save this food. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggleHidden = async (food) => {
    try { await setFoodStatus(food.id, food.status === 'hidden' ? 'active' : 'hidden') } catch (value) { setError(value.message) }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteFood(confirmDelete.id)
      setConfirmDelete(null)
    } catch (value) {
      setError(value.message || 'We could not delete this food.')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Food', render: (f) => <span className="font-bold">{f.food_name}</span> },
    { key: 'category', header: 'Category', render: (f) => f.category || '—' },
    { key: 'gi', header: 'Glycemic index', align: 'right', render: (f) => f.glycemic_index ?? '—' },
    { key: 'calories', header: 'Calories', align: 'right', render: (f) => f.calories ?? '—' },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge tone={f.status === 'hidden' ? 'neutral' : 'success'}>{f.status === 'hidden' ? 'Hidden' : 'Active'}</StatusBadge> },
    {
      key: 'actions', header: '', align: 'right',
      render: (f) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="!px-3 !py-2 !text-xs" onClick={() => toggleHidden(f)}>{f.status === 'hidden' ? 'Unhide' : 'Hide'}</Button>
          <Button variant="outline" className="!px-3 !py-2 !text-xs" onClick={() => openEdit(f)}>Edit</Button>
          <Button variant="dangerOutline" className="!px-3 !py-2 !text-xs" onClick={() => setConfirmDelete(f)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {foods.error || error ? <div className="mb-4"><Notice>{foods.error || error}</Notice></div> : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput className="max-w-sm flex-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search food name or category…" />
        <Button onClick={openAdd}>+ Add Food</Button>
      </div>
      <Tabs value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'hidden', label: 'Hidden' }, { value: 'all', label: 'All' }]} />
      <DataTable columns={columns} rows={rows} pageSize={10} empty="No foods yet. Add the Filipino dishes the AI should recommend." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Food' : 'Add Food'} maxWidth="max-w-md">
        <form onSubmit={save} className="space-y-4" noValidate>
          <TextField label="Food name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {foodCategories.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Glycemic index (0-100)" type="number" min="0" max="100" value={form.glycemicIndex} onChange={(e) => setForm({ ...form, glycemicIndex: e.target.value })} />
            <TextField label="Calories" type="number" min="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
          </div>
          {error ? <Notice>{error}</Notice> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Food'}</Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete food"
        message={`Delete "${confirmDelete?.food_name}"? The AI will no longer suggest it.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  )
}
