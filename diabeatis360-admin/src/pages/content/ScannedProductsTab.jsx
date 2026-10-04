import { useMemo, useState } from 'react'

import { useAuth } from '../../auth/AuthContext'
import DataTable, { Tabs } from '../../components/DataTable'
import { Button, Notice, StatusBadge } from '../../components/ui'
import { formatDate, toDate } from '../../lib/format'
import { useCollection } from '../../lib/useCollection'
import { verifyProduct } from '../../services/products'

// Scanned Products (added scope, DECISIONS.md D12): products patients shared from the nutrition scanner.
// They start unverified and are shown to other patients with a "not yet verified" label until an admin
// checks the values against the real label and verifies them here.
export default function ScannedProductsTab() {
  const { admin } = useAuth()
  const products = useCollection('Products')
  const users = useCollection('Users')
  const [tab, setTab] = useState('unverified')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const names = Object.fromEntries(users.data.map((user) => [user.id, user.full_name]))
    return products.data
      .map((product) => ({ ...product, sharedBy: names[product.created_by] || 'Unknown user' }))
      .sort((a, b) => (toDate(b.created_at)?.getTime() ?? 0) - (toDate(a.created_at)?.getTime() ?? 0))
  }, [products.data, users.data])

  const shown = rows.filter((row) => (tab === 'unverified' ? !row.verified : tab === 'verified' ? row.verified : true))

  const verify = async (row) => {
    setBusyId(row.id)
    setError('')
    try {
      await verifyProduct(row.id, admin.id)
    } catch (value) {
      setError(value.message)
    } finally {
      setBusyId(null)
    }
  }

  const columns = [
    { key: 'product', header: 'Product', render: (row) => (<div><p className="font-bold">{row.product_name}</p><p className="text-xs text-muted">{row.brand || 'No brand'} · {row.id}</p></div>) },
    { key: 'nutrients', header: 'Per serving', render: (row) => (<p className="text-xs">{row.serving_size || '—'} · {row.nutrients?.calories ?? 0} kcal · sugar {row.nutrients?.sugar_g ?? 0} g · carbs {row.nutrients?.carbs_g ?? 0} g · sodium {row.nutrients?.sodium_mg ?? 0} mg</p>) },
    { key: 'ingredients', header: 'Ingredients', render: (row) => <p className="max-w-xs text-xs text-muted">{row.ingredients_text || '—'}</p> },
    { key: 'by', header: 'Shared by', render: (row) => (<div><p>{row.sharedBy}</p><p className="text-xs text-muted">{toDate(row.created_at) ? formatDate(row.created_at) : '—'}</p></div>) },
    { key: 'status', header: 'Status', render: (row) => (row.verified ? <StatusBadge tone="success">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>) },
    { key: 'action', header: '', align: 'right', render: (row) => (row.verified ? null : <Button className="!px-4 !py-2" disabled={busyId === row.id} onClick={() => verify(row)}>Verify</Button>) },
  ]

  const loadError = products.error || users.error

  return (
    <div>
      {loadError || error ? <div className="mb-4"><Notice>{loadError || error}</Notice></div> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'unverified', label: 'Not verified', count: rows.filter((row) => !row.verified).length },
          { value: 'verified', label: 'Verified', count: rows.filter((row) => row.verified).length },
          { value: 'all', label: 'All', count: rows.length },
        ]}
      />
      <DataTable columns={columns} rows={shown} pageSize={10} empty="No shared products yet. They appear when patients scan a new barcode and share it." />
    </div>
  )
}
