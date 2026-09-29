/**
 * Dashboard Page
 * 
 * Shows key metrics and impact statistics
 */

import { useEffect, useState } from 'react'
import { Button, Card, StatCard, Table, Alert, EventCard } from '../components'
import MeetingStatusBadge from '../components/MeetingStatusBadge'
import { getDashboardData } from '../services/reportService'

export default function DashboardPage({ organizationId, onOpenMeetings }) {
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
        No data available yet. Record event outcomes to see impact metrics.
      </Alert>
    )
  }

  const eventColumns = [
    { 
      key: 'date', 
      label: 'Date',
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    { key: 'name', label: 'Event' },
    { key: 'event_type', label: 'Type' },
    { key: 'location', label: 'Location' },
    { key: 'people_reached', label: 'People' },
    { key: 'pregnancies_identified', label: 'Pregnancies' },
    { key: 'contraceptives_distributed', label: 'Contraceptives' },
    { key: 'health_screenings', label: 'Screenings' },
    { key: 'health_talks_held', label: 'Health Talks' }
  ]

  return (
    <div className="space-y-8">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <span className="dashboard-hero-eyebrow">Monthly impact · {dashboard.month}</span>
          <h2>Your community is making a difference</h2>
          <p>Here’s the impact your friendly space has made this month.</p>
        </div>
        <div className="dashboard-hero-stat">
          <strong>{dashboard.people_reached}</strong>
          <span>people reached</span>
        </div>
      </section>

      <div className="grid grid-2 gap-6 dashboard-stat-grid">
        <StatCard
          label="People Reached"
          value={dashboard.people_reached}
          unit="people"
        />

        <StatCard
        label="Health Screenings"
        value={dashboard.health_screenings}
        unit="screenings"
        />

        <StatCard
        label="Contraceptives Distributed"
        value={dashboard.contraceptives_distributed}
        unit="items"
        />

        <StatCard
        label="Pregnancies Identified"
        value={dashboard.pregnancies_identified}
        color="warning"
        />

        <StatCard
        label="Health Talks Held"
        value={dashboard.health_talks_held}
        unit="talks"
        />

        <StatCard
        label="Active Members"
        value={dashboard.active_members}
        unit="members"
        />

        <StatCard
        label="Events This Month"
        value={dashboard.events_count}
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

      <section className="space-y-4 dashboard-events">
        <div className="flex-between">
          <h3>Upcoming Meetings</h3>
          {onOpenMeetings && <Button size="sm" variant="secondary" onClick={onOpenMeetings}>View meetings</Button>}
        </div>
        {dashboard.upcoming_meetings.length ? (
          <div className="grid grid-2 gap-4">
            {dashboard.upcoming_meetings.map((meeting) => (
              <Card key={meeting.id} className="dashboard-meeting-preview">
                <div className="flex-between gap-3">
                  <h4>{meeting.title}</h4>
                  <MeetingStatusBadge status={meeting.status} />
                </div>
                <p>{new Date(meeting.scheduled_at).toLocaleString()}</p>
                <p className="text-secondary">{meeting.location}</p>
                <p className="text-secondary">{meeting.facilitators.length} facilitators · {meeting.attendees_count} attending</p>
              </Card>
            ))}
          </div>
        ) : <Card><p className="text-secondary">No upcoming meetings are scheduled.</p></Card>}
      </section>

      <Card>
        <h3>Monthly Event Trends</h3>
        <div className="event-trend-chart" role="list" aria-label="Events recorded during the last six months">
          {dashboard.monthly_event_trend.map((month) => {
            const peak = Math.max(1, ...dashboard.monthly_event_trend.map((item) => item.count))
            return (
              <div className="event-trend-column" key={month.month} role="listitem">
                <span className="event-trend-count">{month.count}</span>
                <div className="event-trend-track">
                  <div
                    className="event-trend-bar"
                    style={{ height: `${Math.max(5, month.count / peak * 100)}%` }}
                    title={`${month.count} events, ${month.people_reached} people reached`}
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
              <span className="text-secondary">{item.people_reached} reached · {item.events} events</span>
            </div>
          )) : <p className="text-secondary">No location data recorded this month.</p>}
        </Card>
      </div>

      {Object.keys(dashboard.by_event_type).length > 0 && (
        <Card>
          <h3>Events by Type</h3>
          <div className="grid grid-2 gap-4 mt-4">
            {Object.entries(dashboard.by_event_type).map(([type, stats]) => (
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

      {dashboard.recent_events.length > 0 && (
        <Card>
          <h3>Recent Events</h3>
          <Table
            columns={eventColumns}
            data={dashboard.recent_events}
            emptyMessage="No event outcomes recorded yet"
            className="dashboard-event-table"
          />
        </Card>
      )}

      {dashboard.events_count === 0 && (
        <Card className="text-center py-12">
          <h3>No event outcomes yet</h3>
          <p className="text-secondary mb-4">Record outcomes from completed Events to see your impact metrics.</p>
        </Card>
      )}
    </div>
  )
}
