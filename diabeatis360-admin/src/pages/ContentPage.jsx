import { PageHeader } from '../components/ui'
import FoodDatabaseTab from './content/FoodDatabaseTab'

// "Content" (menu item only, no Figma frame — docs/FIGMA_MAP.md): Food Database CRUD (manuscript
// UT-A008-UT-A010). The Scanned Products tab was removed with barcode scanning (DECISIONS.md D12).
export default function ContentPage() {
  return (
    <div>
      <PageHeader title="Content" subtitle="The Filipino food list that grounds AI suggestions." />
      <FoodDatabaseTab />
    </div>
  )
}
