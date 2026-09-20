/**
 * Dashboard Page
 * 
 * Shows key metrics and impact statistics
 */

import { useEffect, useState } from 'react'
import { Card, StatCard, Table, Alert } from '../components'
import { getDashboardData } from '../services/reportService'

export default function DashboardPage({ organizationId }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [organizationId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getDashboardData(organizationId)
      setDashboard(data)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-secondary">Loading dashboard...</div>
  }

  if (error) {
    return (
      <Alert variant="error">
        Failed to load dashboard: {error}
      </Alert>
    )
  }

  if (!dashboard) {
    return (
      <Alert variant="warning">
        No data available yet. Start logging activities to see metrics.
      </Alert>
    )
  }

  const activityColumns = [
    { 
      key: 'date', 
      label: 'Date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    { key: 'activity_type', label: 'Type' },
    { key: 'location', label: 'Location' },
    { key: 'people_reached', label: 'People' },
    { key: 'pregnancies_identified', label: 'Pregnancies' },
    { key: 'contraceptives_distributed', label: 'Contraceptives' }
  ]

  return (
    <div className="space-y-8">
      <Alert variant="success">
        ✓ Welcome! Here's your impact for {dashboard.month}
      </Alert>

      <div className="grid grid-2 gap-6">
        <StatCard
          label="People Reached"
          value={dashboard.people_reached}
          icon="👥"
          unit="people"
          trend={{ value: 12, direction: 'up' }}
        />

        <StatCard
          label="Clinic Visits"
          value={dashboard.clinic_visits}
          icon="🏥"
          unit="visits"
        />

        <StatCard
          label="Contraceptives Distributed"
          value={dashboard.contraceptives_distributed}
          icon="📦"
          unit="items"
        />

        <StatCard
          label="Pregnancies Identified"
          value={dashboard.pregnancies_identified}
          icon="🤰"
          color="warning"
        />

        <StatCard
          label="Active Members"
          value={dashboard.active_members}
          icon="👤"
          unit="members"
        />

        <StatCard
          label="Events This Month"
          value={dashboard.events_count}
          icon="📅"
          unit="events"
        />
      </div>

      {Object.keys(dashboard.by_activity_type).length > 0 && (
        <Card>
          <h3>Activities by Type</h3>
          <div className="grid grid-2 gap-4 mt-4">
            {Object.entries(dashboard.by_activity_type).map(([type, stats]) => (
              <div key={type} className="p-4 bg-gray-50 rounded-md">
                <p className="text-sm text-secondary capitalize font-medium mb-2">
                  {type.replace('_', ' ')}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {stats.count}
                </p>
                <p className="text-xs text-tertiary">
                  {stats.people_reached} people reached
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dashboard.recent_activities.length > 0 && (
        <Card>
          <h3>Recent Activities</h3>
          <Table
            columns={activityColumns}
            data={dashboard.recent_activities}
            emptyMessage="No activities logged yet"
          />
        </Card>
      )}

      {dashboard.total_activities === 0 && (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">📝</div>
          <h3>No Activities Yet</h3>
          <p className="text-secondary mb-4">
            Start logging activities to see your impact metrics
          </p>
          <p className="text-sm text-tertiary">
            Go to Activities → Log Activity to record your work
          </p>
        </Card>
      )}
    </div>
  )
}
