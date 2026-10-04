import { useMemo, useState } from 'react'

import DataTable from '../../components/DataTable'
import { Card, Notice, SearchInput } from '../../components/ui'
import { formatDate, toDate } from '../../lib/format'
import { useCollection } from '../../lib/useCollection'

// View Award Points (gamification module, admin): every patient's wellness streak, points and badges,
// highest points first. The mobile app keeps Gamification/{uid} up to date when the patient opens Rewards.
export default function PointsTab() {
  const gamification = useCollection('Gamification')
  const users = useCollection('Users')
  const earned = useCollection('User_Badges')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const byUser = Object.fromEntries(users.data.map((user) => [user.id, user]))
    const badgeCounts = {}
    earned.data.forEach((item) => { badgeCounts[item.user_id] = (badgeCounts[item.user_id] ?? 0) + 1 })
    const needle = search.trim().toLowerCase()
    return gamification.data
      .map((entry) => {
        const user = byUser[entry.user_id ?? entry.id]
        return {
          id: entry.id,
          name: user?.full_name || 'Unknown user',
          email: user?.email || '',
          streak: Number(entry.streak_count ?? 0),
          points: Number(entry.total_points ?? 0),
          badges: badgeCounts[entry.user_id ?? entry.id] ?? 0,
          updated: entry.updated_at,
        }
      })
      .filter((row) => !needle || `${row.name} ${row.email}`.toLowerCase().includes(needle))
      .sort((a, b) => b.points - a.points)
  }, [gamification.data, users.data, earned.data, search])

  const totalPoints = rows.reduce((sum, row) => sum + row.points, 0)
  const bestStreak = rows.reduce((best, row) => Math.max(best, row.streak), 0)

  const columns = [
    { key: 'rank', header: '#', render: (row) => rows.indexOf(row) + 1 },
    { key: 'name', header: 'Patient', render: (row) => (<div><p className="font-bold">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div>) },
    { key: 'points', header: 'Award points', align: 'right', render: (row) => <span className="font-extrabold text-brand">{row.points}</span> },
    { key: 'streak', header: 'Current streak', align: 'right', render: (row) => `${row.streak} day${row.streak === 1 ? '' : 's'}` },
    { key: 'badges', header: 'Badges earned', align: 'right', render: (row) => row.badges },
    { key: 'updated', header: 'Last updated', render: (row) => (toDate(row.updated) ? formatDate(row.updated) : '—') },
  ]

  const error = gamification.error || users.error || earned.error

  return (
    <div>
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-bold uppercase text-muted">Patients with points</p><p className="mt-1 text-3xl font-extrabold">{rows.length}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">Total points awarded</p><p className="mt-1 text-3xl font-extrabold text-brand">{totalPoints}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">Longest current streak</p><p className="mt-1 text-3xl font-extrabold">{bestStreak} days</p></Card>
      </div>
      <SearchInput className="mb-4 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" />
      <DataTable columns={columns} rows={rows} pageSize={10} empty="No award points yet. Points appear after patients log readings." />
    </div>
  )
}
