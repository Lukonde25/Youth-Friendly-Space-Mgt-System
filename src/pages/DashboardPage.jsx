/**
 * Dashboard Page
 * 
 * Shows key metrics and impact statistics
 */

import { useEffect, useState } from 'react'
import { Card, StatCard, Table, Alert, EventCard } from '../components'
import { getDashboardData } from '../services/reportService'

export default function DashboardPage({ organizationId, onNavigate }) {
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
    { key: 'contraceptives_distributed', label: 'Contraceptives' },
    { key: 'screenings_done', label: 'Screenings' },
    { key: 'health_talks_given', label: 'Health Talks' }
  ]

  return (
    <div className="space-y-8">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-hero-eyebrow">Monthly impact · {dashboard.month}</span>
          <h2>Your community is making a difference</h2>
          <p>Here’s the impact your friendly space has made this month.</p>
        </div>
        <div className="dashboard-hero-stat">
          <strong>{dashboard.people_reached}</strong>
          <span>people reached</span>
        </div>
      </section>

      <nav className="dashboard-shortcuts" aria-label="Explore centre sections">
        {[
          { label: 'Members', icon: '👥', page: 'members' },
          { label: 'Events', icon: '📅', page: 'events' },
          { label: 'Activities', icon: '📝', page: 'activities' },
          { label: 'Join requests', icon: '🙋', page: 'requests' }
        ].map((item) => (
          <button key={item.page} type="button" onClick={() => onNavigate?.(item.page)}>
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="grid grid-2 gap-6 dashboard-stat-grid">
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
          label="Screenings Done"
          value={dashboard.screenings_done}
          icon="🩺"
          unit="screenings"
        />

        <StatCard
          label="Health Talks Given"
          value={dashboard.health_talks_given}
          icon="💬"
          unit="talks"
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

      {dashboard.upcoming_events.length > 0 && (
        <section className="space-y-4 dashboard-events">
          <div className="flex-between">
            <h3>Upcoming Events</h3>
            <span className="text-sm text-secondary">{dashboard.upcoming_events.length} scheduled</span>
          </div>
          <div className="grid grid-2 gap-4 dashboard-event-grid">
            {dashboard.upcoming_events.map((event) => (
              <EventCard key={event.id} event={event} showActions={false} showInvitationStats={false} />
            ))}
          </div>
        </section>
      )}

      <Card>
        <h3>Monthly Activity Trends</h3>
        <div className="activity-trend-chart" role="list" aria-label="Activities logged during the last six months">
          {dashboard.monthly_activity_trend.map((month) => {
            const peak = Math.max(1, ...dashboard.monthly_activity_trend.map((item) => item.count))
            return (
              <div className="activity-trend-column" key={month.month} role="listitem">
                <span className="activity-trend-count">{month.count}</span>
                <div className="activity-trend-track">
                  <div
                    className="activity-trend-bar"
                    style={{ height: `${Math.max(5, month.count / peak * 100)}%` }}
                    title={`${month.count} activities, ${month.people_reached} people reached`}
                  />
                </div>
                <span className="text-sm text-secondary">{month.month}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-2 gap-6">
        <Card>
          <h3>Geographic Reach</h3>
          {dashboard.location_reach.length ? dashboard.location_reach.map((item) => (
            <div key={item.location} className="flex-between border-t py-3">
              <span>{item.location}</span>
              <span className="text-secondary">{item.people_reached} reached</span>
            </div>
          )) : <p className="text-secondary">No location data recorded this month.</p>}
        </Card>
        <Card>
          <h3>Top Coordinators This Month</h3>
          {dashboard.top_staff.length ? dashboard.top_staff.map((staff) => (
            <div key={staff.user_id} className="flex-between border-t py-3">
              <span>{staff.name}</span>
              <span className="text-secondary">{staff.people_reached} reached · {staff.activities} activities</span>
            </div>
          )) : <p className="text-secondary">No coordinator activity recorded this month.</p>}
        </Card>
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
