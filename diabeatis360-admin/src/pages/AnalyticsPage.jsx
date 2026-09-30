import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { Button, Card, Notice, PageHeader, StatCard } from '../components/ui'
import { formatPeso, toDate } from '../lib/format'
import { bucketsFor, changeHint, countPerBucket, countPerWeekday, inRange, percentChange, periodOptions, previousRange, rangeFor } from '../lib/periods'
import { revenueByPeriod, revenueEvents } from '../lib/revenue'
import { useCollection } from '../lib/useCollection'
import ReportModal from './analytics/ReportModal'

const BRAND = '#629c2c'
const AXIS = { fontSize: 12, fill: '#6b7280' }

function ChartCard({ title, children }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <div className="h-64">{children}</div>
    </Card>
  )
}

// FIGMA/ADMIN "Analytics Page" + "Analytics Page-1" (Generate Custom Report modal); manuscript UT-A012 (health trend reports).
// Everything is computed in the browser from live collections. The registration line, weekday bars and the
// active/inactive split need every user, booking and reading (they are grouped by date or by patient), which a
// Firestore count()/sum() aggregation cannot do, so this page reads the full collections. That is fine at
// capstone scale; a larger deployment would pre-compute daily totals in a Cloud Function.
export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [reportOpen, setReportOpen] = useState(false)

  const users = useCollection('Users')
  const providers = useCollection('Providers')
  const bookings = useCollection('Bookings')
  const glucose = useCollection('Glucose_Logs')
  const subscriptions = useCollection('Subscriptions')
  const plans = useCollection('Subscription_Plans')

  const range = useMemo(() => rangeFor(period, custom), [period, custom])

  const stats = useMemo(() => {
    const previous = previousRange(range)
    const patients = users.data.filter((user) => user.role === 'patient') // D9: Users holds both roles
    const newPatients = patients.filter((user) => inRange(user.created_at, range))

    const activeIds = new Set(glucose.data.filter((log) => inRange(log.logged_at, range)).map((log) => log.patient_id))
    const patientIds = new Set(patients.map((user) => user.id))
    const activePatients = [...activeIds].filter((id) => patientIds.has(id)).length

    const consultations = bookings.data.filter((booking) => inRange(booking.scheduled_at, range))
    const consultationsBefore = bookings.data.filter((booking) => inRange(booking.scheduled_at, previous)).length

    const events = revenueEvents(bookings.data, subscriptions.data, plans.data)
    const sum = (list) => Math.round(list.reduce((total, event) => total + event.amount, 0) * 100) / 100
    const revenue = sum(events.filter((event) => event.date >= range.start && event.date <= range.end))
    const revenueBefore = sum(events.filter((event) => event.date >= previous.start && event.date <= previous.end))

    const verified = providers.data.filter((doctor) => doctor.is_verified && doctor.is_active !== false)
    const newIds = new Set(newPatients.map((user) => user.id))
    const active = [...activeIds].filter((id) => patientIds.has(id) && !newIds.has(id)).length

    return {
      totalPatients: patients.length,
      newPatients: newPatients.length,
      activePatients,
      activeShare: patients.length ? Math.round((activePatients / patients.length) * 100) : 0,
      doctors: verified.length,
      pendingDoctors: providers.data.filter((doctor) => !doctor.is_verified).length,
      consultations,
      consultationChange: percentChange(consultations.length, consultationsBefore),
      revenue,
      revenueChange: percentChange(revenue, revenueBefore),
      events,
      distribution: [
        { name: 'Active', value: active, color: BRAND },
        { name: 'Inactive', value: Math.max(0, patients.length - active - newPatients.length), color: '#e2e0d9' },
        { name: 'New', value: newPatients.length, color: '#111827' },
      ],
    }
  }, [users.data, providers.data, bookings.data, glucose.data, subscriptions.data, plans.data, range])

  const registrations = useMemo(() => {
    const dates = users.data.map((user) => toDate(user.created_at)).filter(Boolean)
    return countPerBucket(dates, bucketsFor(range))
  }, [users.data, range])

  const weekdays = useMemo(() => countPerWeekday(stats.consultations.map((booking) => toDate(booking.scheduled_at)).filter(Boolean)), [stats.consultations])
  const monthlyRevenue = useMemo(() => revenueByPeriod(stats.events, 'monthly'), [stats.events])

  const loadError = users.error || providers.error || bookings.error || glucose.error || subscriptions.error || plans.error
  const customIncomplete = period === 'custom' && !(custom.from && custom.to)

  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="Real-time platform insights and health system performance tracking." />
      {loadError ? <div className="mb-4"><Notice>{loadError}</Notice></div> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-2xl bg-gray-200/60 p-1 text-sm font-bold">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-xl px-4 py-2 transition ${period === option.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="flex items-center gap-2 text-sm">
              <input aria-label="From date" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2" />
              <span className="text-muted">to</span>
              <input aria-label="To date" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2" />
            </div>
          ) : null}
        </div>
        <Button onClick={() => setReportOpen(true)}>Generate Report</Button>
      </div>
      {customIncomplete ? <div className="mb-4"><Notice tone="info">Pick both dates to use a custom range. Showing this month until then.</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total users" value={stats.totalPatients} hint={`+${stats.newPatients} new`} hintTone="success" />
        <StatCard label="Active users" value={stats.activePatients} hint={`${stats.activeShare}% of patients`} />
        <StatCard label="Total doctors" value={stats.doctors} hint={stats.pendingDoctors ? `${stats.pendingDoctors} pending` : 'Verified'} hintTone={stats.pendingDoctors ? 'warning' : 'success'} />
        <StatCard
          label="Consultations"
          value={stats.consultations.length}
          hint={changeHint(stats.consultationChange, 'in period')}
          hintTone={stats.consultationChange != null && stats.consultationChange < 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Revenue"
          value={formatPeso(stats.revenue)}
          hint={changeHint(stats.revenueChange, 'in period')}
          hintTone={stats.revenueChange != null && stats.revenueChange < 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="User Registration Trends">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={registrations} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f2" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
              <Tooltip formatter={(value) => [value, 'New accounts']} />
              <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={3} dot={{ r: 3, fill: BRAND }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="User Activity Distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.distribution} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="90%" startAngle={90} endAngle={-270} stroke="none">
                {stats.distribution.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Consultation Volume">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdays} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f2" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
              <Tooltip formatter={(value) => [value, 'Consultations']} />
              <Bar dataKey="count" fill="#ddf1a9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Revenue">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f2" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(value) => `₱${value}`} width={70} />
              <Tooltip formatter={(value) => [formatPeso(value), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2.5} fill={BRAND} fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        initialRange={range}
        data={{ users: users.data, providers: providers.data, bookings: bookings.data, glucose: glucose.data }}
      />
    </div>
  )
}
