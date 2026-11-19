import { useSearchParams } from 'react-router-dom'

import { PageHeader, PageTabs } from '../components/ui'
import { useFilteredCount } from '../lib/useCollection'
import FoodDatabaseTab from './content/FoodDatabaseTab'
import ScannedProductsTab from './content/ScannedProductsTab'

// "Content" (menu item only, no Figma frame — docs/FIGMA_MAP.md): Food Database CRUD (manuscript
// UT-A008-UT-A010) and the Scanned Products review queue (D12, added scope).
export default function ContentPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'products' ? 'products' : 'food'
  const pendingProducts = useFilteredCount('Products', 'verified', false)

  return (
    <div>
      <PageHeader title="Content" subtitle="The Filipino food list that grounds AI suggestions, and products patients share from the scanner." />
      <PageTabs
        value={tab}
        onChange={(value) => setParams(value === 'food' ? {} : { tab: value })}
        options={[
          { value: 'food', label: 'Food Database' },
          { value: 'products', label: 'Scanned Products', count: pendingProducts },
        ]}
      />
      {tab === 'food' ? <FoodDatabaseTab /> : <ScannedProductsTab />}
    </div>
  )
}
