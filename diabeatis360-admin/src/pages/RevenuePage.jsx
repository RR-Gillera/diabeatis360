import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, Notice, PageHeader, PageTabs, StatCard } from '../components/ui'
import { formatPeso } from '../lib/format'
import { revenueByPeriod, revenueEvents, revenueTotals } from '../lib/revenue'
import { useCollection } from '../lib/useCollection'
import PaymentsTab from './revenue/PaymentsTab'
import PlansTab from './revenue/PlansTab'
import SubscribersTab from './revenue/SubscribersTab'

const TABS = ['overview', 'payments', 'subscribers', 'plans']

// FIGMA/ADMIN "Revenue" + "Revenue-1" (payment details modal). The collections are read once here and passed
// down, so the stat cards, the chart and the tabs all agree and Firestore only keeps one listener per collection.
// Revenue needs every booking and subscription (a sum over a computed field), so this page reads the full
// collections instead of a Firestore aggregation query — fine at capstone scale.
// Layout (team review, 2026-11-22): tabs sit right under the header, the same pattern as Providers/Users/Settings,
// so the tables are reachable without scrolling past the chart. The Figma stat cards + growth chart moved into
// the first tab, "Overview". This differs from the Figma "Revenue" frame on purpose.
export default function RevenuePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'
  const [period, setPeriod] = useState('monthly')

  const bookings = useCollection('Bookings')
  const users = useCollection('Users')
  const providers = useCollection('Providers')
  const subscriptions = useCollection('Subscriptions')
  const plans = useCollection('Subscription_Plans')

  const events = useMemo(() => revenueEvents(bookings.data, subscriptions.data, plans.data), [bookings.data, subscriptions.data, plans.data])
  const totals = useMemo(() => revenueTotals(events, bookings.data), [events, bookings.data])
  const chart = useMemo(() => revenueByPeriod(events, period), [events, period])

  const loadError = bookings.error || users.error || providers.error || subscriptions.error || plans.error
  const change = totals.monthChange

  return (
    <div>
      <PageHeader
        title="Revenue Overview"
        subtitle="Track financial performance and transaction history."
        // The Monthly/Quarterly switch only changes the growth chart, so it is only shown on the Overview tab.
        actions={tab === 'overview' ? (
          <div className="flex rounded-2xl bg-gray-100 p-1 text-sm font-bold">
            {[['monthly', 'Monthly'], ['quarterly', 'Quarterly']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-xl px-4 py-2 transition ${period === value ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      />
      {loadError ? <div className="mb-4"><Notice>{loadError}</Notice></div> : null}
      {/* D26: online payments are simulated, so every amount here is a recorded demo amount, not money received.
          Shown above the tabs so it applies to every tab that shows an amount. */}
      <div className="mb-4"><Notice tone="warning">Demo payments: the amounts below are recorded by the app, but no real money was charged or received.</Notice></div>

      <PageTabs
        value={tab}
        onChange={(value) => setParams(value === 'overview' ? {} : { tab: value })}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'payments', label: 'Consultation Payments' },
          { value: 'subscribers', label: 'Premium Subscribers' },
          { value: 'plans', label: 'Membership Plans' },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total revenue" value={formatPeso(totals.total)} hint="Commission + plans" />
            <StatCard
              label="Revenue this month"
              value={formatPeso(totals.thisMonth)}
              hint={change == null ? 'No last month' : `${change >= 0 ? '+' : ''}${change}%`}
              hintTone={change == null ? 'neutral' : change >= 0 ? 'success' : 'danger'}
            />
            <StatCard label="Consultation revenue" value={formatPeso(totals.consultation)} hint={`${totals.consultationShare}% Share`} />
            <StatCard label="Pending payments" value={formatPeso(totals.pendingAmount)} hint={`${totals.pendingCount} ${totals.pendingCount === 1 ? 'item' : 'items'}`} hintTone="warning" />
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-extrabold">Revenue Growth Trends</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#629c2c" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#629c2c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef0f2" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `₱${value}`} width={70} />
                  <Tooltip formatter={(value) => [formatPeso(value), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#629c2c" strokeWidth={3} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}
      {tab === 'payments' ? <PaymentsTab bookings={bookings.data} users={users.data} providers={providers.data} /> : null}
      {tab === 'subscribers' ? <SubscribersTab subscriptions={subscriptions.data} users={users.data} plans={plans.data} /> : null}
      {tab === 'plans' ? <PlansTab plans={plans.data} /> : null}
    </div>
  )
}
