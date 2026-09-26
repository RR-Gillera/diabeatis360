import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { useAuth } from '../auth/AuthContext'
import { Card, Notice, PageHeader } from '../components/ui'
import { bookingsByStatus, glucoseByDay, glucoseSummary, lastWeeks, revenueByWeek, signupsByWeek } from '../lib/analytics'
import { formatPeso } from '../lib/format'
import { commissionOf } from '../lib/labels'
import { countActive } from '../lib/subscriptions'
import { useCollection } from '../lib/useCollection'

const BRAND = '#629C2C'
const STATUS_COLORS = { pending: '#F59E0B', confirmed: '#629C2C', completed: '#475569', declined: '#D9364F', cancelled: '#9CA3AF' }

function Stat({ label, value, hint, accent }) {
  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${accent ? 'text-brand' : ''}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}

function ChartCard({ title, children }) {
  return (
    <Card>
      <h2 className="mb-4 text-base font-extrabold">{title}</h2>
      <div className="h-64">{children}</div>
    </Card>
  )
}

// View System Analytics (module 9, admin). All numbers are computed in the browser from live Firestore data.
export default function DashboardPage() {
  const { admin } = useAuth()
  const users = useCollection('Users')
  const doctors = useCollection('Providers')
  const bookings = useCollection('Bookings')
  const glucose = useCollection('Glucose_Logs')
  const subscriptions = useCollection('Subscriptions')

  const stats = useMemo(() => {
    const completed = bookings.data.filter((booking) => booking.status === 'completed')
    const activePremium = countActive(subscriptions.data)
    return {
      patients: users.data.filter((user) => user.role !== 'doctor').length,
      doctorsVerified: doctors.data.filter((doctor) => doctor.is_verified).length,
      doctorsPending: doctors.data.filter((doctor) => !doctor.is_verified).length,
      bookings: bookings.data.length,
      completed: completed.length,
      revenue: completed.reduce((sum, booking) => sum + commissionOf(booking), 0),
      activePremium,
      glucose: glucoseSummary(glucose.data),
    }
  }, [users.data, doctors.data, bookings.data, subscriptions.data, glucose.data])

  const charts = useMemo(() => {
    const weeks = lastWeeks(8)
    return {
      signups: signupsByWeek(users.data, weeks),
      revenue: revenueByWeek(bookings.data, weeks),
      status: bookingsByStatus(bookings.data),
      glucose: glucoseByDay(glucose.data, 14),
    }
  }, [users.data, bookings.data, glucose.data])

  const error = users.error || doctors.error || bookings.error || glucose.error || subscriptions.error

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome, ${admin?.full_name || 'Admin'}. Live numbers from the whole platform.`} />
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Patients" value={stats.patients} />
        <Stat label="Doctors" value={stats.doctorsVerified} hint={`${stats.doctorsPending} waiting for verification`} />
        <Stat label="Appointments" value={stats.bookings} hint={`${stats.completed} completed`} />
        <Stat label="Platform revenue (15%)" value={formatPeso(stats.revenue)} accent />
        <Stat label="Premium subscribers" value={stats.activePremium} />
        <Stat label="Glucose readings logged" value={stats.glucose.count} />
        <Stat label="Average glucose" value={stats.glucose.average === null ? '—' : `${stats.glucose.average} mg/dL`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="New accounts per week">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.signups}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="patients" name="Patients" fill={BRAND} radius={[6, 6, 0, 0]} />
              <Bar dataKey="doctors" name="Doctors" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Appointments by status">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={charts.status.filter((item) => item.count > 0)} dataKey="count" nameKey="label" outerRadius={90} label>
                {charts.status.filter((item) => item.count > 0).map((item) => <Cell key={item.status} fill={STATUS_COLORS[item.status]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Platform revenue per week (₱)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.revenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatPeso(value)} />
              <Bar dataKey="revenue" name="Commission" fill={BRAND} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average blood sugar, last 14 days (mg/dL)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.glucose}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="average" name="Average" stroke={BRAND} strokeWidth={3} dot connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
