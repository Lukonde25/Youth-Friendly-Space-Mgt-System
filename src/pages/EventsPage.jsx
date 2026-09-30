import { useEffect, useRef, useState } from 'react'
import { Button, Card, Modal, Alert, EventCard } from '../components'
import { useForm } from '../hooks/useForm'
import {
  fetchEvents,
  createEvent,
  deleteEvent,
  cancelEvent,
  inviteMembers,
  fetchEventInvitations,
  updateInvitationStatus,
  updateEvent
} from '../services/eventService'
import { getAvailableMembersForEvent } from '../services/memberService'
import { fetchEventFeedback } from '../services/eventFeedbackService'
import { createPost, deletePost, removeCoverImage, uploadCoverImage } from '../services/postService'
import { setEventPublic } from '../services/publicService'

export default function EventsPage({ organizationId, userId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showAttendance, setShowAttendance] = useState(false)

  useEffect(() => {
    loadData()
  }, [organizationId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const eventsData = await fetchEvents(organizationId)
      setEvents(eventsData || [])
      setSelectedEvent((current) => current ? eventsData.find((item) => item.id === current.id) || null : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return
    try {
      const event = events.find((item) => item.id === eventId)
      await deleteEvent(eventId, event?.cover_image_path)
      setSelectedEvent(null)
      await loadData()
    } catch (err) {
      setError(err.message)
      if (err.message.startsWith('The event was deleted,')) await loadData()
    }
  }

  const handleCancelEvent = async (event) => {
    if (!window.confirm(`Cancel "${event.name}"? Members will still be able to see that it was cancelled.`)) return
    try {
      await cancelEvent(event.id)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleTogglePublic = async (event) => {
    try {
      setError(null)
      await setEventPublic(event.id, !event.is_public)
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, is_public: !event.is_public } : item))
      setSelectedEvent((current) => current?.id === event.id ? { ...current, is_public: !event.is_public } : current)
    } catch (toggleError) {
      setError(toggleError.message)
    }
  }

  if (loading) return <div className="p-6 text-center text-secondary">Loading events...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      <div>
        <h2 className="text-2xl font-bold">Events</h2>
        <p className="text-secondary">Create an event announcement for your centre and manage upcoming events.</p>
      </div>

      <CreateEventForm organizationId={organizationId} userId={userId} onSuccess={loadData} />

      {events.length > 0 ? (
        <div className="grid grid-2 gap-6">
          {events.map(event => (
            <div key={event.id} className="admin-event-row">
              <EventCard
                event={event}
                onDelete={() => handleDeleteEvent(event.id)}
                onCancel={() => handleCancelEvent(event)}
                onSendReminders={() => { setSelectedEvent(event); setShowInviteForm(true) }}
                onViewMetrics={() => { setSelectedEvent(event); setShowAttendance(true) }}
                invitationActionLabel="Invite Members"
                showActions={true}
              />
              <div className="admin-post-public-control">
                <span>{event.is_public ? 'Visible in public discovery' : 'Members only'}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => handleTogglePublic(event)}>{event.is_public ? 'Make private' : 'Make public'}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">📅</div>
          <h3>No Events Yet</h3>
          <p className="text-secondary mb-4">Your events will appear here after you create one.</p>
        </Card>
      )}

      {selectedEvent && (
        <>
          <InviteMembersModal
            isOpen={showInviteForm}
            event={selectedEvent}
            organizationId={organizationId}
            onClose={() => { setShowInviteForm(false); setSelectedEvent(null) }}
            onSuccess={loadData}
          />
          <EventAttendanceModal
            isOpen={showAttendance}
            event={selectedEvent}
            organizationId={organizationId}
            userId={userId}
            onClose={() => { setShowAttendance(false); setSelectedEvent(null) }}
            onSaved={loadData}
          />
        </>
      )}
    </div>
  )
}

function CreateEventForm({ organizationId, userId, onSuccess }) {
  const [submitError, setSubmitError] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null)
  const coverInputRef = useRef(null)

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null)
      return undefined
    }
    const previewUrl = URL.createObjectURL(coverFile)
    setCoverPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [coverFile])

  const form = useForm(
    { name: '', event_type: 'health_talk', date: '', location: '', description: '', capacity: '', is_public: false },
    async (values) => {
      try {
        setSubmitError(null)
        await createEvent(organizationId, userId, {
          ...values,
          capacity: parseInt(values.capacity, 10) || null,
          coverFile
        })
        form.reset()
        setCoverFile(null)
        if (coverInputRef.current) coverInputRef.current.value = ''
        onSuccess()
      } catch (err) {
        setSubmitError(err.message)
      }
    }
  )

  return (
    <Card className="post-composer content-page-composer">
      <div className="post-composer-heading">
        <div>
          <h3>Create a new event</h3>
          <p className="text-secondary">Create an event announcement with the same cover-first layout as a post.</p>
        </div>
        <span className="post-composer-step">1 · Event details</span>
      </div>
      {submitError && <Alert variant="error" className="mb-4" onDismiss={() => setSubmitError(null)}>{submitError}</Alert>}
      <form onSubmit={form.handleSubmit} className="content-compose-form">
        <div className="content-compose-intro">
          <span className="content-compose-icon" aria-hidden="true">✦</span>
          <div>
            <h3>Design your event announcement</h3>
            <p className="text-secondary">Add a cover and details. Members see the title and a short description on the image.</p>
          </div>
        </div>
        <section className="content-compose-section">
          <div className="post-composer-heading">
            <div><h4>Event cover</h4><p className="text-secondary">The event name and description appear over this image.</p></div>
            <span className="post-composer-step">01 · Cover</span>
          </div>
          <label className="content-compose-field">
            <span>Event name</span>
            <input type="text" name="name" placeholder="Give your event a clear title" value={form.values.name} onChange={form.handleChange} required maxLength="160" />
          </label>
          <label className="public-visibility-toggle"><input type="checkbox" name="is_public" checked={form.values.is_public} onChange={form.handleChange} /><span><strong>List this activity publicly</strong><small>Public activities appear on your friendly space profile. Health outcome figures and member information are never shown here.</small></span></label>
          <label className="content-compose-field">
            <span>Description</span>
            <textarea name="description" placeholder="What should members know about this event?" value={form.values.description} onChange={form.handleChange} rows="3" maxLength="10000" />
          </label>
          <div className="content-compose-image-row">
            <label className="post-image-select">
              <input
                type="file"
                ref={coverInputRef}
                accept="image/*"
                aria-label="Choose event cover image"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  if (file && (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024)) {
                    setSubmitError(file.size > 12 * 1024 * 1024
                      ? 'Choose an image under 12 MB.'
                      : 'Choose an image file for the event cover.')
                    event.target.value = ''
                    return
                  }
                  setSubmitError(null)
                  setCoverFile(file)
                }}
              />
              <span aria-hidden="true">＋</span>
              <span>{coverFile ? 'Choose another image' : 'Choose cover image'}</span>
            </label>
            {coverFile && (
              <button
                type="button"
                className="content-compose-remove-image"
                onClick={() => {
                  setCoverFile(null)
                  if (coverInputRef.current) coverInputRef.current.value = ''
                }}
              >
                Remove image
              </button>
            )}
          </div>
          <div className={`post-compose-preview content-compose-preview${coverPreviewUrl ? ' has-image' : ''}`}>
            {coverPreviewUrl && <img src={coverPreviewUrl} alt="" />}
            <span className="organization-post-cover-shade" aria-hidden="true" />
            <div className="post-compose-preview-copy">
              <strong>{form.values.name || 'Your event title'}</strong>
              <p>{form.values.description || 'Your event description will appear here.'}</p>
            </div>
          </div>
        </section>
        <section className="content-compose-section">
          <div className="post-composer-heading">
            <div><h4>Event details</h4><p className="text-secondary">Help members plan to take part.</p></div>
            <span className="post-composer-step">02 · Details</span>
          </div>
          <div className="content-compose-fields-grid">
            <label className="content-compose-field">
              <span>Event type</span>
              <select name="event_type" value={form.values.event_type} onChange={form.handleChange} required>
                <option value="health_talk">Health talk</option>
                <option value="clinic_visit">Clinic visit</option>
                <option value="outreach">Outreach</option>
                <option value="training">Training</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="content-compose-field">
              <span>Date and time</span>
              <input type="datetime-local" name="date" value={form.values.date} onChange={form.handleChange} required />
            </label>
            <label className="content-compose-field">
              <span>Location</span>
              <input type="text" name="location" placeholder="Where is it happening?" value={form.values.location} onChange={form.handleChange} />
            </label>
            <label className="content-compose-field">
              <span>Expected attendees <small>Optional</small></span>
              <input type="number" name="capacity" placeholder="No limit" value={form.values.capacity} onChange={form.handleChange} min="1" />
            </label>
          </div>
        </section>
        <div className="content-compose-actions">
          <Button type="submit" loading={form.loading}>Create Event</Button>
        </div>
      </form>
    </Card>
  )
}

function EventAttendanceModal({ isOpen, event, organizationId, userId, onClose, onSaved }) {
  const [invitations, setInvitations] = useState([])
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [outcomePhoto, setOutcomePhoto] = useState(null)
  const [outcomePhotoPreview, setOutcomePhotoPreview] = useState(null)

  const loadInvitations = async () => {
    try {
      setLoading(true)
      setError(null)
      const [invitationData, feedbackData] = await Promise.all([
        fetchEventInvitations(event.id),
        fetchEventFeedback(event.id)
      ])
      setInvitations(invitationData || [])
      setFeedback(feedbackData || [])
      setOutcome({
        people_reached: event.people_reached || 0,
        contraceptives_distributed: event.contraceptives_distributed || 0,
        pregnancies_identified: event.pregnancies_identified || 0,
        health_screenings: event.health_screenings || 0,
        health_talks_held: event.health_talks_held || 0,
        notes: event.notes || ''
      })
      setOutcomePhoto(null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) loadInvitations()
  }, [event.id, isOpen])

  useEffect(() => {
    if (!outcomePhoto) {
      setOutcomePhotoPreview(null)
      return undefined
    }
    const previewUrl = URL.createObjectURL(outcomePhoto)
    setOutcomePhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [outcomePhoto])

  const setAttendance = async (invitation, status) => {
    try {
      setUpdatingId(invitation.id)
      setError(null)
      await updateInvitationStatus(invitation.id, status)
      await loadInvitations()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const confirmed = invitations.filter((invitation) => invitation.status === 'confirmed').length
  const attended = invitations.filter((invitation) => invitation.status === 'attended').length
  const attendanceRate = invitations.length ? Math.round(attended / invitations.length * 100) : 0
  const averageRating = feedback.length
    ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1)
    : '—'

  const saveOutcomes = async (formEvent) => {
    formEvent.preventDefault()
    try {
      setUpdatingId('outcomes')
      setError(null)
      if (outcomePhoto && (!outcomePhoto.type.startsWith('image/') || outcomePhoto.size > 5 * 1024 * 1024)) {
        throw new Error('Choose an image under 5 MB.')
      }
      const photoPath = outcomePhoto
        ? await uploadCoverImage(organizationId, userId, outcomePhoto)
        : event.photo_url || null
      try {
        await updateEvent(event.id, { ...outcome, photo_url: photoPath })
      } catch (saveError) {
        if (outcomePhoto && photoPath) {
          try {
            await removeCoverImage(photoPath)
          } catch (cleanupError) {
            throw new Error(`Event outcomes could not be saved: ${saveError.message}. Photo cleanup also failed: ${cleanupError.message}`)
          }
        }
        throw saveError
      }
      if (outcomePhoto && event.photo_url && event.photo_url !== photoPath) {
        try {
          await removeCoverImage(event.photo_url)
        } catch (cleanupError) {
          throw new Error(`Event outcomes were saved, but the previous photo could not be removed: ${cleanupError.message}`)
        }
      }
      const savedOutcome = Object.fromEntries(
        Object.entries(outcome).map(([key, value]) => (
          key === 'notes' ? [key, value] : [key, Number(value) || 0]
        ))
      )
      setOutcome(savedOutcome)
      setOutcomePhoto(null)
      await onSaved()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const publishOutcomes = async () => {
    try {
      setUpdatingId('post')
      setError(null)
      const savedOutcome = Object.fromEntries(
        Object.entries(outcome).map(([key, value]) => (
          key === 'notes' ? [key, value] : [key, Number(value) || 0]
        ))
      )
      const photoPath = outcomePhoto
        ? await uploadCoverImage(organizationId, userId, outcomePhoto)
        : event.photo_url || null
      await updateEvent(event.id, { ...savedOutcome, photo_url: photoPath })
      const post = await createPost(organizationId, userId, {
        title: `Event outcomes: ${event.name}`,
        body: [
          savedOutcome.notes,
          `People reached: ${savedOutcome.people_reached}`,
          `Contraceptives distributed: ${savedOutcome.contraceptives_distributed}`,
          `Pregnancies identified: ${savedOutcome.pregnancies_identified}`,
          `Health screenings: ${savedOutcome.health_screenings}`,
          `Health talks held: ${savedOutcome.health_talks_held}`
        ].filter(Boolean).join('\n\n'),
        coverFile: outcomePhoto
      })
      try {
        await updateEvent(event.id, { is_posted_to_community: true, post_id: post.id })
      } catch (linkError) {
        try {
          await deletePost(post.id, post.cover_image_path)
        } catch (cleanupError) {
          throw new Error(
            `The event outcomes were posted, but the Event could not be linked: ${linkError.message}. `
            + `Automatic cleanup also failed: ${cleanupError.message}`
          )
        }
        throw new Error(`The community post could not be linked to the Event: ${linkError.message}`)
      }
      if (outcomePhoto && event.photo_url && event.photo_url !== photoPath) {
        try {
          await removeCoverImage(event.photo_url)
        } catch (cleanupError) {
          throw new Error(`The event outcomes were shared, but the previous photo could not be removed: ${cleanupError.message}`)
        }
      }
      setOutcome(savedOutcome)
      setOutcomePhoto(null)
      await onSaved()
    } catch (publishError) {
      setError(publishError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} title={`Attendance: ${event.name}`} onClose={onClose} size="lg" dialogClassName="event-outcomes-modal">
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <div className="grid grid-3 gap-3 mb-6">
        <Card className="text-center"><strong>{invitations.length}</strong><p className="text-sm text-secondary">Invited</p></Card>
        <Card className="text-center"><strong>{confirmed}</strong><p className="text-sm text-secondary">Confirmed</p></Card>
        <Card className="text-center"><strong>{attendanceRate}%</strong><p className="text-sm text-secondary">Attendance</p></Card>
      </div>
      <Card>
        <h3>Feedback · {averageRating}{averageRating !== '—' ? '/5' : ''}</h3>
        {feedback.length ? feedback.map((item) => (
          <div key={item.id} className="border-t py-3">
            <p className="font-medium">{item.members?.name || 'Member'} · {item.rating}/5</p>
            <p className="text-sm text-secondary">{item.feedback}</p>
          </div>
        )) : <p className="text-secondary">No feedback submitted yet.</p>}
      </Card>
      <Card>
        <h3>Event outcomes</h3>
        <p className="text-secondary">Record the results and documentation for this event.</p>
        {outcome && (
          <form className="space-y-4" onSubmit={saveOutcomes}>
            <div className="content-compose-fields-grid">
              {[
                ['people_reached', 'People reached'],
                ['contraceptives_distributed', 'Contraceptives distributed'],
                ['pregnancies_identified', 'Pregnancies identified'],
                ['health_screenings', 'Health screenings'],
                ['health_talks_held', 'Health talks held']
              ].map(([field, label]) => (
                <label key={field} className="block">
                  <span className="block mb-2 font-medium text-sm">{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={outcome[field]}
                    onChange={(event) => setOutcome((current) => ({ ...current, [field]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="block mb-2 font-medium text-sm">Notes</span>
              <textarea rows="4" maxLength="10000" value={outcome.notes} onChange={(event) => setOutcome((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <label className="block">
              <span className="block mb-2 font-medium text-sm">Event photo <small>Optional, up to 5 MB</small></span>
              <input type="file" accept="image/*" onChange={(event) => setOutcomePhoto(event.target.files?.[0] || null)} />
            </label>
            {(outcomePhotoPreview || event.outcome_photo_url) && (
              <img className="meeting-photo-preview" src={outcomePhotoPreview || event.outcome_photo_url} alt={`Documentation for ${event.name}`} />
            )}
            <div className="flex gap-3 flex-wrap">
              <Button type="submit" loading={updatingId === 'outcomes'}>Save event outcomes</Button>
              {!event.is_posted_to_community && (
                <Button type="button" variant="secondary" loading={updatingId === 'post'} onClick={publishOutcomes}>
                  Share outcomes with members
                </Button>
              )}
              {event.is_posted_to_community && <span className="text-secondary">Outcomes shared with members.</span>}
            </div>
          </form>
        )}
      </Card>
      {loading ? <p className="text-secondary">Loading invitations...</p> : invitations.length ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex-between gap-3 border rounded p-3">
              <div>
                <p className="font-medium">{invitation.members?.name || 'Member'}</p>
                <p className="text-sm text-secondary">{invitation.status}</p>
              </div>
              <Button
                size="sm"
                variant={invitation.status === 'attended' ? 'success' : 'secondary'}
                loading={updatingId === invitation.id}
                disabled={invitation.status === 'attended'}
                onClick={() => setAttendance(invitation, 'attended')}
              >
                {invitation.status === 'attended' ? 'Attended' : 'Mark attended'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-secondary">No members have been invited to this event yet.</p>
      )}
      <div className="mt-6">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}

function InviteMembersModal({ isOpen, event, organizationId, onClose, onSuccess }) {
  const [members, setMembers] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    let isMounted = true
    const loadAvailableMembers = async () => {
      try {
        setLoadingMembers(true)
        setError(null)
        setSelectedMembers([])
        const availableMembers = await getAvailableMembersForEvent(organizationId, event.id)
        if (isMounted) setMembers(availableMembers)
      } catch (loadError) {
        if (isMounted) setError(loadError.message)
      } finally {
        if (isMounted) setLoadingMembers(false)
      }
    }

    loadAvailableMembers()
    return () => {
      isMounted = false
    }
  }, [event.id, isOpen, organizationId])

  const handleInvite = async () => {
    if (selectedMembers.length === 0) {
      setError('Select at least one member who has not already been invited.')
      return
    }
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
    <Modal isOpen={isOpen} title={`Invite Participants · ${event.name}`} onClose={onClose} size="lg">
      {error && <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Alert>}
      <div className="invite-participants-description">
        <p>Select active members who have not already been invited to this event.</p>
        {!loadingMembers && members.length > 0 && (
          <span>{selectedMembers.length} selected · {members.length} available</span>
        )}
      </div>
      {loadingMembers ? (
        <p className="text-secondary">Loading available members...</p>
      ) : members.length ? (
        <div className="invite-participants-list">
          {members.map((member) => (
            <label key={member.id} className="invite-participant-option">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={(event) => {
                  setSelectedMembers((current) => (
                    event.target.checked
                      ? [...current, member.id]
                      : current.filter((id) => id !== member.id)
                  ))
                }}
              />
              <span className="invite-participant-copy">
                <strong>{member.name}</strong>
                {member.phone && <small>{member.phone}</small>}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="invite-participants-empty">There are no active members available to invite for this event.</p>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleInvite} loading={inviting} disabled={loadingMembers || members.length === 0 || selectedMembers.length === 0}>
          Send Invitations ({selectedMembers.length})
        </Button>
      </div>
    </Modal>
  )
}
