import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Modal } from './index'
import MeetingStatusBadge from './MeetingStatusBadge'
import {
  addMeetingFacilitator,
  clearMeetingAttendance,
  fetchAvailableMeetingFacilitators,
  fetchMeetingRegister,
  removeMeetingFacilitator,
  saveMeetingAttendance,
  setMeetingFacilitatorStatus,
  shareMeetingAsPost,
  updateMeetingDetails,
  updateMeetingSchedule,
  updateMeetingStatus
} from '../services/meetingService'
import { removeCoverImage, uploadCoverImage } from '../services/postService'
import { supabase } from '../services/supabaseClient'

const makeLocalDateTime = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

export default function MeetingDetailModal({ isOpen, meeting, organizationId, userId, onClose, onUpdated, onOpenCommunityPost }) {
  const meetingId = meeting?.id
  const [members, setMembers] = useState([])
  const [facilitators, setFacilitators] = useState([])
  const [availableFacilitators, setAvailableFacilitators] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [topic, setTopic] = useState('')
  const [announcements, setAnnouncements] = useState('')
  const [notes, setNotes] = useState('')
  const [schedule, setSchedule] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false)
  const [newFacilitatorId, setNewFacilitatorId] = useState('')

  useEffect(() => {
    if (!isOpen || !meetingId) return undefined
    let isMounted = true
    setLoading(true)
    setError(null)
    setTopic(meeting.topic || '')
    setAnnouncements(meeting.announcements || '')
    setNotes(meeting.notes || '')
    setSchedule(makeLocalDateTime(new Date(meeting.scheduled_at)))
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemoveExistingPhoto(false)
    Promise.all([
      fetchMeetingRegister(meetingId, organizationId),
      fetchAvailableMeetingFacilitators(organizationId)
    ]).then(([register, members]) => {
      if (isMounted) {
        setMembers(register.members)
        setFacilitators(register.facilitators)
        setAvailableFacilitators(members)
      }
    }).catch((loadError) => {
      if (isMounted) setError(loadError.message)
    }).finally(() => {
      if (isMounted) setLoading(false)
    })
    return () => { isMounted = false }
  }, [isOpen, meetingId, organizationId])

  useEffect(() => {
    if (!isOpen || !meetingId || !supabase) return undefined
    const channel = supabase
      .channel(`meeting-attendance-${meetingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meeting_attendance',
        filter: `meeting_id=eq.${meetingId}`
      }, () => {
        fetchMeetingRegister(meetingId, organizationId)
          .then((register) => {
            setMembers(register.members)
            setFacilitators(register.facilitators)
          })
          .catch((loadError) => setError(loadError.message))
      })
      .subscribe((status, subscriptionError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(`Live attendance updates are unavailable: ${subscriptionError?.message || status}`)
        }
      })
    return () => {
      supabase.removeChannel(channel).catch((removeError) => {
        console.error('Could not close meeting attendance subscription:', removeError)
      })
    }
  }, [isOpen, meetingId, organizationId])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? members.filter((member) => (
      member.name?.toLowerCase().includes(query) || member.phone?.toLowerCase().includes(query)
    )) : members
  }, [members, search])
  const presentCount = members.filter((member) => member.attended).length
  const attendanceRate = members.length ? Math.round((presentCount / members.length) * 100) : 0
  const currentFacilitatorIds = new Set(facilitators.map((facilitator) => facilitator.user_id))
  const eligibleFacilitators = availableFacilitators.filter((member) => !currentFacilitatorIds.has(member.id))
  const meetingCreator = availableFacilitators.find((member) => member.id === meeting?.created_by)
  const photoUrl = removeExistingPhoto ? null : photoPreview || meeting?.photo_url

  const runAction = async (action) => {
    try {
      setBusy(true)
      setError(null)
      await action()
      await onUpdated()
      if (meeting) {
        const register = await fetchMeetingRegister(meeting.id, organizationId)
        setMembers(register.members)
        setFacilitators(register.facilitators)
      }
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  const markGroup = async (attended) => runAction(async () => {
    await saveMeetingAttendance(meeting.id, members.map((member) => member.id), attended, userId)
  })

  const saveDocumentation = async (event) => {
    event.preventDefault()
    if (topic.length > 500 || announcements.length > 1000 || notes.length > 2000) {
      setError('Keep the topic under 500, announcements under 1,000, and notes under 2,000 characters.')
      return
    }
    if (photoFile && (!['image/jpeg', 'image/png'].includes(photoFile.type) || photoFile.size > 5 * 1024 * 1024)) {
      setError('Choose a JPG or PNG image under 5 MB.')
      return
    }
    await runAction(async () => {
      const uploadedPath = photoFile
        ? await uploadCoverImage(organizationId, userId, photoFile)
        : removeExistingPhoto ? null : meeting.photo_path
      await updateMeetingDetails(meeting.id, {
        topic,
        announcements,
        notes,
        photo_path: uploadedPath
      })
      if (meeting.photo_path && meeting.photo_path !== uploadedPath) {
        try {
          await removeCoverImage(meeting.photo_path)
        } catch (removeError) {
          throw new Error(`Meeting details were saved, but the previous photo could not be removed: ${removeError.message}`)
        }
      }
      setPhotoFile(null)
      setRemoveExistingPhoto(false)
    })
  }

  const publish = () => runAction(async () => {
    if (topic.length > 500 || announcements.length > 1000 || notes.length > 2000) {
      throw new Error('Keep the topic under 500, announcements under 1,000, and notes under 2,000 characters.')
    }
    if (photoFile && (!['image/jpeg', 'image/png'].includes(photoFile.type) || photoFile.size > 5 * 1024 * 1024)) {
      throw new Error('Choose a JPG or PNG image under 5 MB.')
    }
    const photoPath = photoFile
      ? await uploadCoverImage(organizationId, userId, photoFile)
      : removeExistingPhoto ? null : meeting.photo_path
    try {
      await updateMeetingDetails(meeting.id, { topic, announcements, notes, photo_path: photoPath })
    } catch (saveError) {
      if (photoFile && photoPath) {
        try {
          await removeCoverImage(photoPath)
        } catch (cleanupError) {
          throw new Error(`Meeting documentation could not be saved: ${saveError.message}. Photo cleanup also failed: ${cleanupError.message}`)
        }
      }
      throw saveError
    }
    if (meeting.photo_path && meeting.photo_path !== photoPath) {
      await removeCoverImage(meeting.photo_path)
    }
    await shareMeetingAsPost({
      ...meeting,
      topic,
      announcements,
      notes,
      photo_path: photoPath
    }, userId, photoFile)
    setPhotoFile(null)
    setRemoveExistingPhoto(false)
  })

  const reschedule = (event) => {
    event.preventDefault()
    const date = new Date(schedule)
    if (date <= new Date()) {
      setError('Choose a future date and time to reschedule.')
      return
    }
    runAction(() => updateMeetingSchedule(meeting.id, date.toISOString()))
  }

  return (
    <Modal isOpen={isOpen} title={meeting?.title || 'Meeting details'} onClose={onClose} size="xl" dialogClassName="meeting-modal">
      {error && <Alert variant="error">{error}</Alert>}
      {loading ? <p className="text-secondary">Loading meeting details...</p> : meeting && (
        <div className="meeting-details-content">
          <div className="meeting-detail-summary">
            <MeetingStatusBadge status={meeting.status} />
            <p><strong>Date:</strong> {new Date(meeting.scheduled_at).toLocaleString()}</p>
            <p><strong>Location:</strong> {meeting.location}</p>
            <p><strong>Created by:</strong> {meetingCreator?.full_name || meetingCreator?.email || 'Centre administrator'}</p>
            {meeting.description && <p>{meeting.description}</p>}
            {meeting.capacity && <p><strong>Capacity:</strong> {meeting.capacity}</p>}
          </div>

          <Card>
            <div className="flex-between gap-3">
              <h3>Facilitators</h3>
              <span>{facilitators.filter((item) => item.confirmed_at).length} confirmed · {facilitators.filter((item) => item.attended).length} attended</span>
            </div>
            <div className="space-y-2">
              {facilitators.map((facilitator) => (
                <div className="meeting-facilitator-row" key={facilitator.user_id}>
                  <span>{facilitator.name || facilitator.full_name || facilitator.email || 'Member'}</span>
                  <span>{facilitator.confirmed_at ? 'Confirmed' : 'Awaiting confirmation'} · {facilitator.attended ? 'Attended' : 'Not attended'}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(() => setMeetingFacilitatorStatus(meeting.id, facilitator.user_id, { confirmed_at: facilitator.confirmed_at ? null : new Date().toISOString() }))}>
                      {facilitator.confirmed_at ? 'Unconfirm' : 'Confirm'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(() => setMeetingFacilitatorStatus(meeting.id, facilitator.user_id, { attended: !facilitator.attended }))}>
                      {facilitator.attended ? 'Mark absent' : 'Mark attended'}
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => {
                      if (window.confirm(`Remove ${facilitator.name || facilitator.full_name || 'this facilitator'} from the meeting?`)) {
                        runAction(() => removeMeetingFacilitator(meeting.id, facilitator.user_id))
                      }
                    }}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            {eligibleFacilitators.length > 0 && (
              <div className="meeting-add-facilitator">
                <select aria-label="Add facilitator" value={newFacilitatorId} onChange={(event) => setNewFacilitatorId(event.target.value)}>
                  <option value="">Choose an administrator</option>
                  {eligibleFacilitators.map((member) => <option key={member.id} value={member.id}>{member.name || member.full_name || member.email}</option>)}
                </select>
                <Button size="sm" disabled={!newFacilitatorId || busy} onClick={() => runAction(async () => {
                  await addMeetingFacilitator(meeting.id, newFacilitatorId, userId)
                  setNewFacilitatorId('')
                })}>Add facilitator</Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex-between gap-3">
              <div><h3>Attendance register</h3><p className="text-secondary">{presentCount} present · {members.length - presentCount} absent · {attendanceRate}% attendance</p></div>
              <div className="flex gap-2 meeting-bulk-actions">
                <Button size="sm" variant="secondary" disabled={busy || !members.length} onClick={() => markGroup(true)}>Mark all present</Button>
                <Button size="sm" variant="secondary" disabled={busy || !members.length} onClick={() => markGroup(false)}>Mark all absent</Button>
                <Button size="sm" variant="secondary" disabled={busy || !members.length} onClick={() => runAction(() => clearMeetingAttendance(meeting.id))}>Clear register</Button>
              </div>
            </div>
            <input className="meeting-register-search" type="search" placeholder="Search members" value={search} onChange={(event) => setSearch(event.target.value)} />
            {filteredMembers.length ? (
              <div className="meeting-attendance-list">
                {filteredMembers.map((member) => (
                  <label key={member.id} className="meeting-attendance-member">
                    <span><strong>{member.name}</strong>{member.phone && <small>{member.phone}</small>}</span>
                    <input
                      type="checkbox"
                      checked={member.attended}
                      disabled={busy}
                      onChange={async (event) => {
                        const attended = event.target.checked
                        await runAction(async () => {
                          await saveMeetingAttendance(meeting.id, [member.id], attended, userId)
                        })
                      }}
                    />
                    <span>{member.attended ? 'Present' : 'Absent'}</span>
                  </label>
                ))}
              </div>
            ) : <p className="text-secondary">No members match this search.</p>}
          </Card>

          <Card>
            <h3>Meeting documentation</h3>
            <form className="space-y-4" onSubmit={saveDocumentation}>
              <label className="block"><span className="block mb-2 font-medium text-sm">Topic</span><input maxLength="500" value={topic} onChange={(event) => setTopic(event.target.value)} /><small>{topic.length}/500 characters</small></label>
              <label className="block"><span className="block mb-2 font-medium text-sm">Announcements</span><textarea rows="3" maxLength="1000" value={announcements} onChange={(event) => setAnnouncements(event.target.value)} /><small>{announcements.length}/1000 characters</small></label>
              <label className="block"><span className="block mb-2 font-medium text-sm">Notes</span><textarea rows="4" maxLength="2000" value={notes} onChange={(event) => setNotes(event.target.value)} /><small>{notes.length}/2000 characters</small></label>
                <label className="block"><span className="block mb-2 font-medium text-sm">Meeting photo <small>Optional, up to 5 MB</small></span><input type="file" accept="image/jpeg,image/png" onChange={(event) => { setPhotoFile(event.target.files?.[0] || null); setRemoveExistingPhoto(false) }} /></label>
                {photoUrl && <img className="meeting-photo-preview" src={photoUrl} alt="Meeting documentation" />}
                {(photoPreview || (meeting.photo_url && !removeExistingPhoto)) && (
                  <Button type="button" size="sm" variant="danger" onClick={() => {
                    if (photoFile) setPhotoFile(null)
                    else setRemoveExistingPhoto(true)
                  }}>Remove photo</Button>
                )}
              <Button type="submit" loading={busy}>Save documentation</Button>
            </form>
          </Card>

          <Card>
            <h3>Meeting status and schedule</h3>
            <div className="meeting-status-actions">
              {meeting.status === 'scheduled' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(() => updateMeetingStatus(meeting.id, 'ongoing'))}>Start meeting</Button>}
              {meeting.status !== 'completed' && meeting.status !== 'cancelled' && <Button size="sm" disabled={busy} onClick={() => runAction(() => updateMeetingStatus(meeting.id, 'completed'))}>Mark completed</Button>}
              {meeting.status !== 'cancelled' && meeting.status !== 'completed' && <Button size="sm" variant="danger" disabled={busy} onClick={() => {
                if (window.confirm('Cancel this meeting? Facilitators and members may already have been notified.')) {
                  runAction(() => updateMeetingStatus(meeting.id, 'cancelled'))
                }
              }}>Cancel meeting</Button>}
            </div>
            {meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
              <form className="meeting-reschedule-form" onSubmit={reschedule}>
                <label><span className="block mb-2 font-medium text-sm">Reschedule to</span><input required type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label>
                <Button type="submit" size="sm" variant="secondary" loading={busy}>Save new date</Button>
              </form>
            )}
          </Card>

          <Card>
            <h3>Share with members</h3>
            <p className="text-secondary">{meeting.post_id ? 'This meeting has been shared in Centre News.' : 'Publish the meeting notes and announcements as a community post.'}</p>
            {meeting.post_id
              ? <Button variant="secondary" onClick={onOpenCommunityPost}>View Centre News</Button>
              : <Button disabled={busy || meeting.status === 'cancelled'} loading={busy} onClick={publish}>Share as community post</Button>}
          </Card>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      )}
    </Modal>
  )
}
