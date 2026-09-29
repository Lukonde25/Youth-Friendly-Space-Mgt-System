import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card } from '../components'
import MeetingCreationModal from '../components/MeetingCreationModal'
import MeetingDetailModal from '../components/MeetingDetailModal'
import MeetingStatusBadge from '../components/MeetingStatusBadge'
import { fetchMeetings } from '../services/meetingService'

export default function MeetingsPage({ organizationId, userId, appRole = 'center_admin', onOpenCommunityPost }) {
  const [meetings, setMeetings] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadMeetings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMeetings(organizationId)
      setMeetings(data)
      setSelectedMeeting((current) => current ? data.find((item) => item.id === current.id) || null : null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadMeetings()
  }, [organizationId])

  const filteredMeetings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return meetings.filter((meeting) => (
      (statusFilter === 'all' || meeting.status === statusFilter)
      && (!normalizedQuery
        || meeting.title.toLowerCase().includes(normalizedQuery)
        || meeting.location.toLowerCase().includes(normalizedQuery)
        || (meeting.description || '').toLowerCase().includes(normalizedQuery))
    ))
  }, [meetings, query, statusFilter])

  if (appRole !== 'center_admin') {
    return <Alert variant="error">You do not have permission to manage meetings.</Alert>
  }

  return (
    <div className="meeting-page space-y-6">
      {error && <div><Alert variant="error">{error}</Alert><Button size="sm" variant="secondary" onClick={loadMeetings}>Try again</Button></div>}
      <div className="meeting-page-heading">
        <div><h2 className="text-2xl font-bold">Meetings</h2><p className="text-secondary">Plan meetings, coordinate facilitators, record attendance and document outcomes.</p></div>
        <Button onClick={() => setCreating(true)}>Create meeting</Button>
      </div>
      <div className="meeting-filters">
        <input type="search" placeholder="Search meetings" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter meetings by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading ? <p className="text-secondary">Loading meetings...</p> : filteredMeetings.length ? (
        <div className="meeting-card-grid">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id} className="meeting-card">
              <div className="meeting-card-header"><h3>{meeting.title}</h3><MeetingStatusBadge status={meeting.status} /></div>
              <p><strong>Date:</strong> {new Date(meeting.scheduled_at).toLocaleString()}</p>
              <p><strong>Location:</strong> {meeting.location}</p>
              {meeting.description && <p className="text-secondary">{meeting.description}</p>}
              <p><strong>Facilitators:</strong> {meeting.facilitators.length}</p>
              <p><strong>Attendance:</strong> {meeting.attendees_count}{meeting.capacity ? ` / ${meeting.capacity}` : ''}</p>
              <Button variant="secondary" onClick={() => setSelectedMeeting(meeting)}>Manage meeting</Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12"><h3>{meetings.length ? 'No meetings match your filters' : 'No meetings yet'}</h3><p className="text-secondary">Create a meeting to get started.</p></Card>
      )}
      <MeetingCreationModal
        isOpen={creating}
        organizationId={organizationId}
        userId={userId}
        onClose={() => setCreating(false)}
        onCreated={loadMeetings}
      />
      <MeetingDetailModal
        isOpen={Boolean(selectedMeeting)}
        meeting={selectedMeeting}
        organizationId={organizationId}
        userId={userId}
        onOpenCommunityPost={onOpenCommunityPost}
        onClose={() => setSelectedMeeting(null)}
        onUpdated={loadMeetings}
      />
    </div>
  )
}
