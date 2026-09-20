import { useEffect, useState } from 'react'
import { Button, Card, Modal, Alert, EventCard } from '../components'
import { useForm } from '../hooks/useForm'
import { fetchEvents, createEvent, deleteEvent, inviteMembers } from '../services/eventService'
import { fetchMembers } from '../services/memberService'

export default function EventsPage({ organizationId }) {
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showInviteForm, setShowInviteForm] = useState(false)

  useEffect(() => {
    loadData()
  }, [organizationId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [eventsData, membersData] = await Promise.all([
        fetchEvents(organizationId),
        fetchMembers(organizationId)
      ])
      setEvents(eventsData || [])
      setMembers(membersData || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return
    try {
      await deleteEvent(eventId)
      setSelectedEvent(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="p-6 text-center text-secondary">Loading events...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      <div className="flex-between">
        <h2 className="text-2xl font-bold">Events</h2>
        <Button onClick={() => setShowCreateForm(true)}>+ Create Event</Button>
      </div>

      {events.length > 0 ? (
        <div className="grid grid-2 gap-6">
          {events.map(event => (
            <EventCard key={event.id} event={event} onDelete={() => handleDeleteEvent(event.id)} onSendReminders={() => { setSelectedEvent(event); setShowInviteForm(true) }} showActions={true} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">📅</div>
          <h3>No Events Yet</h3>
          <p className="text-secondary mb-4">Create your first event to coordinate activities</p>
          <Button onClick={() => setShowCreateForm(true)}>Create First Event</Button>
        </Card>
      )}

      <CreateEventModal isOpen={showCreateForm} organizationId={organizationId} onClose={() => setShowCreateForm(false)} onSuccess={loadData} />

      {selectedEvent && (
        <InviteMembersModal isOpen={showInviteForm} event={selectedEvent} members={members} onClose={() => { setShowInviteForm(false); setSelectedEvent(null) }} onSuccess={loadData} />
      )}
    </div>
  )
}

function CreateEventModal({ isOpen, organizationId, onClose, onSuccess }) {
  const [submitError, setSubmitError] = useState(null)

  const form = useForm(
    { name: '', date: '', location: '', description: '', capacity: '' },
    async (values) => {
      try {
        setSubmitError(null)
        await createEvent(organizationId, { ...values, capacity: parseInt(values.capacity) || null })
        form.reset()
        onClose()
        onSuccess()
      } catch (err) {
        setSubmitError(err.message)
      }
    }
  )

  return (
    <Modal isOpen={isOpen} title="Create New Event" onClose={onClose} size="lg">
      {submitError && <Alert variant="error" className="mb-4" onDismiss={() => setSubmitError(null)}>{submitError}</Alert>}
      <form onSubmit={form.handleSubmit} className="space-y-4">
        <input type="text" name="name" placeholder="Event Name" value={form.values.name} onChange={form.handleChange} required className="w-full p-3 border rounded" />
        <input type="datetime-local" name="date" value={form.values.date} onChange={form.handleChange} required className="w-full p-3 border rounded" />
        <input type="text" name="location" placeholder="Location" value={form.values.location} onChange={form.handleChange} className="w-full p-3 border rounded" />
        <input type="number" name="capacity" placeholder="Expected Attendees (optional)" value={form.values.capacity} onChange={form.handleChange} className="w-full p-3 border rounded" />
        <textarea name="description" placeholder="Event Description" value={form.values.description} onChange={form.handleChange} rows="3" className="w-full p-3 border rounded" />
        <div className="flex gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.loading}>Create Event</Button>
        </div>
      </form>
    </Modal>
  )
}

function InviteMembersModal({ isOpen, event, members, onClose, onSuccess }) {
  const [selectedMembers, setSelectedMembers] = useState([])
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState(null)

  const handleInvite = async () => {
    if (selectedMembers.length === 0) return
    try {
      setInviting(true)
      setError(null)
      await inviteMembers(event.id, selectedMembers)
      setSelectedMembers([])
      onClose()
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title={`Invite Members to ${event.name}`} onClose={onClose} size="lg">
      {error && <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Alert>}
      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {members.map(member => (
          <label key={member.id} className="flex items-center p-3 border rounded hover:bg-gray-50">
            <input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={(e) => { if (e.target.checked) { setSelectedMembers([...selectedMembers, member.id]) } else { setSelectedMembers(selectedMembers.filter(id => id !== member.id)) } }} className="mr-3" />
            <div className="flex-1">
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-secondary">{member.phone}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleInvite} loading={inviting} disabled={selectedMembers.length === 0}>Send Invitations ({selectedMembers.length})</Button>
      </div>
    </Modal>
  )
}
