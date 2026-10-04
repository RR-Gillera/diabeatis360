import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { useAuth } from '../auth/AuthContext'
import { BellIcon, DownloadIcon, StethoscopeIcon, UsersIcon } from '../components/icons'
import { Button, Card, Notice, PageHeader, StatCard } from '../components/ui'
import { buildActivityFeed } from '../lib/activity'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatDateTime, formatPeso, timeAgo, toDate } from '../lib/format'
import { countPerWeekday, inRange, percentChange } from '../lib/periods'
import { revenueByPeriod, revenueEvents } from '../lib/revenue'
import { useCollection } from '../lib/useCollection'

const BRAND = '#629c2c'
const AXIS = { fontSize: 12, fill: '#6b7280' }
const DAY = 24 * 60 * 60 * 1000
const tagTones = {
  success: 'bg-brand-tint text-brand-dark',
  info: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  warning: 'bg-amber-50 text-amber-700',
}

// FIGMA/ADMIN "Overview Dashboard". A quick daily snapshot; the deeper charts, date ranges and reports live on Analytics.
// Full collections are read because the numbers are distinct counts and groupings (see the note on AnalyticsPage).
export default function OverviewPage() {
  const { admin } = useAuth()
  const users = useCollection('Users')
  const providers = useCollection('Providers')
  const bookings = useCollection('Bookings')
  const glucose = useCollection('Glucose_Logs')
  const subscriptions = useCollection('Subscriptions')
  const plans = useCollection('Subscription_Plans')
  const guardians = useCollection('Guardian_Verifications')
  const [showAll, setShowAll] = useState(false)

  const data = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const last30 = { start: new Date(startToday.getTime() - 29 * DAY), end: new Date(startToday.getTime() + DAY - 1) }

    const patients = users.data.filter((user) => user.role === 'patient') // D9
    const newIn30 = patients.filter((user) => inRange(user.created_at, last30)).length

    // Daily active users = distinct patients who logged a reading that day.
    const days = Array.from({ length: 30 }, (_, index) => {
      const start = new Date(startToday.getTime() - (29 - index) * DAY)
      return { label: start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), start, end: new Date(start.getTime() + DAY) }
    })
    const dailyActive = days.map((day) => ({
      label: day.label,
      count: new Set(glucose.data.filter((log) => {
        const when = toDate(log.logged_at)
        return when && when >= day.start && when < day.end
      }).map((log) => log.patient_id)).size,
    }))
    const dailyAverage = Math.round(dailyActive.reduce((sum, day) => sum + day.count, 0) / dailyActive.length)

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const bookingsThis = bookings.data.filter((b) => (toDate(b.scheduled_at) ?? 0) >= thisMonthStart).length
    const bookingsLast = bookings.data.filter((b) => {
      const when = toDate(b.scheduled_at)
      return when && when >= lastMonthStart && when < thisMonthStart
    }).length

    const events = revenueEvents(bookings.data, subscriptions.data, plans.data)
    return {
      totalPatients: patients.length,
      userGrowth: percentChange(patients.length, patients.length - newIn30),
      activeToday: dailyActive[dailyActive.length - 1].count,
      dailyAverage,
      dailyActive,
      pending: providers.data.filter((doctor) => !doctor.is_verified).length,
      consultations: bookings.data.length,
      consultationChange: percentChange(bookingsThis, bookingsLast),
      weekdays: countPerWeekday(bookings.data.map((b) => toDate(b.scheduled_at)).filter(Boolean)),
      revenue: revenueByPeriod(events, 'monthly'),
      feed: buildActivityFeed({ users: users.data, providers: providers.data, bookings: bookings.data, subscriptions: subscriptions.data, plans: plans.data, guardians: guardians.data }),
    }
  }, [users.data, providers.data, bookings.data, glucose.data, subscriptions.data, plans.data, guardians.data])

  const exportSnapshot = () => {
    const rows = [
      { metric: 'Total patients', value: data.totalPatients },
      { metric: 'Active today', value: data.activeToday },
      { metric: 'Pending doctor approvals', value: data.pending },
      { metric: 'Total consultations', value: data.consultations },
      ...data.feed.slice(0, 25).map((event) => ({ metric: `${event.tag}: ${event.name}${event.text}`, value: formatDateTime(event.at) })),
    ]
    downloadCsv(`diabeatis360-overview-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
      { header: 'Metric / event', value: (row) => row.metric },
      { header: 'Value / time', value: (row) => row.value },
    ], rows))
  }

  const loadError = users.error || providers.error || bookings.error || glucose.error || subscriptions.error || plans.error || guardians.error
  const firstName = (admin?.full_name || 'Admin').split(' ')[0]
  const feed = showAll ? data.feed.slice(0, 20) : data.feed.slice(0, 5)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's what's happening today"
        actions={<Button variant="outline" className="flex items-center gap-2 !border-gray-200 !text-ink" onClick={exportSnapshot}><DownloadIcon className="h-4 w-4" /> Export Data</Button>}
      />
      {loadError ? <div className="mb-4"><Notice>{loadError}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={data.totalPatients.toLocaleString()}
          hint={data.userGrowth == null ? undefined : `↑ ${data.userGrowth}%`}
          hintTone="success"
          icon={<UsersIcon className="h-5 w-5 text-brand" />}
        />
        <StatCard label="Active today" value={data.activeToday} hint={`Daily avg: ${data.dailyAverage}`} icon={<BellIcon className="h-5 w-5 text-brand" />} />
        <StatCard
          label="Pending doctor approvals"
          value={data.pending}
          hint={data.pending > 0 ? 'HIGH PRIORITY' : 'All clear'}
          hintTone={data.pending > 0 ? 'warning' : 'success'}
          icon={<StethoscopeIcon className="h-5 w-5 text-brand" />}
        />
        <StatCard
          label="Total consultations"
          value={data.consultations.toLocaleString()}
          hint={data.consultationChange == null ? undefined : `${data.consultationChange >= 0 ? '↑' : '↓'} ${Math.abs(data.consultationChange)}%`}
          hintTone={data.consultationChange != null && data.consultationChange < 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">User Activity Overview</h2>
              <span className="flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-brand" /> Daily Active Users (last 30 days)</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyActive} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f2" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval={4} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
                  <Tooltip formatter={(value) => [value, 'Active patients']} />
                  <Area type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2.5} fill={BRAND} fillOpacity={0.08} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-lg font-extrabold">Consultation Statistics</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekdays} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#eef0f2" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
                    <Tooltip formatter={(value) => [value, 'Consultations']} />
                    <Bar dataKey="count" fill="#ddf1a9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-extrabold">Revenue Overview</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#eef0f2" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval={1} />
                    <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(value) => `₱${value}`} width={64} />
                    <Tooltip formatter={(value) => [formatPeso(value), 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2.5} fill={BRAND} fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <Card className="!p-0 self-start">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-extrabold">Recent Activity Feed</h2>
            {data.feed.length > 5 ? (
              <button type="button" className="text-xs font-bold text-brand hover:underline" onClick={() => setShowAll((open) => !open)}>
                {showAll ? 'Show less' : 'View All Logs'}
              </button>
            ) : null}
          </div>
          {feed.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">Nothing has happened yet. New sign-ups, bookings and verifications show up here.</p>
          ) : feed.map((event) => (
            <div key={event.id} className="border-b border-gray-100 px-6 py-4 last:border-0">
              <p className="text-sm"><b>{event.name}</b>{event.text}</p>
              <p className="mt-1 text-xs text-muted">{timeAgo(event.at)}</p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tagTones[event.tone]}`}>{event.tag}</span>
            </div>
          ))}
          {data.pending > 0 ? (
            <Link to="/providers" className="block border-t border-gray-100 px-6 py-3 text-center text-sm font-bold text-brand hover:bg-gray-50">
              Review {data.pending} pending doctor {data.pending === 1 ? 'approval' : 'approvals'} →
            </Link>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
