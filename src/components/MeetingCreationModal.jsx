import { useEffect, useState } from 'react'
import { Alert, Button, Modal } from './index'
import { createMeeting, fetchAvailableMeetingFacilitators } from '../services/meetingService'

const toLocalDateTimeValue = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

export default function MeetingCreationModal({ isOpen, organizationId, userId, onClose, onCreated }) {
  const [facilitators, setFacilitators] = useState([])
  const [meetingDateTime, setMeetingDateTime] = useState('')
  const [facilitatorIds, setFacilitatorIds] = useState([])
  const [loadingFacilitators, setLoadingFacilitators] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined
    let isMounted = true
    setLoadingFacilitators(true)
    setError(null)
    fetchAvailableMeetingFacilitators(organizationId)
      .then((data) => {
        if (isMounted) {
          setFacilitators(data)
          setFacilitatorIds((current) => current.filter((id) => data.some((facilitator) => facilitator.id === id)))
        }
      })
      .catch((loadError) => {
        if (isMounted) setError(loadError.message)
      })
      .finally(() => {
        if (isMounted) setLoadingFacilitators(false)
      })
    return () => { isMounted = false }
  }, [isOpen, organizationId])

  const minimumDateTime = toLocalDateTimeValue(new Date(Date.now() + 60_000))
  const isValid = meetingDateTime && new Date(meetingDateTime) > new Date() && facilitatorIds.length > 0

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (!meetingDateTime || new Date(meetingDateTime) <= new Date()) {
      setError('Choose a future date and time for the meeting.')
      return
    }
    if (!facilitatorIds.length) {
      setError('Select at least one facilitator.')
      return
    }
    try {
      setSaving(true)
      await createMeeting(organizationId, userId, {
        scheduled_at: new Date(meetingDateTime).toISOString()
      }, facilitatorIds)
      setMeetingDateTime('')
      setFacilitatorIds([])
      await onCreated?.()
      onClose()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="Create meeting" onClose={onClose} size="lg" dialogClassName="meeting-modal">
      {error && <Alert variant="error">{error}</Alert>}
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="block mb-2 font-medium text-sm">Meeting date and time</span>
          <input required type="datetime-local" min={minimumDateTime} value={meetingDateTime} onChange={(event) => setMeetingDateTime(event.target.value)} />
        </label>
        <fieldset className="meeting-facilitator-picker">
          <legend className="font-medium text-sm mb-2">Facilitators (select one or more members)</legend>
          {loadingFacilitators ? <p className="text-secondary">Loading members...</p> : facilitators.length ? (
            <div className="meeting-admin-options">
              {facilitators.map((facilitator) => (
                <label key={facilitator.id} className="meeting-admin-option">
                  <input
                    type="checkbox"
                    checked={facilitatorIds.includes(facilitator.id)}
                    onChange={(event) => setFacilitatorIds((current) => (
                      event.target.checked
                        ? [...current, facilitator.id]
                        : current.filter((id) => id !== facilitator.id)
                    ))}
                  />
                  <span>{facilitator.name}</span>
                </label>
              ))}
            </div>
          ) : <p className="text-secondary">No active members with approved accounts are available to facilitate this meeting.</p>}
        </fieldset>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={loadingFacilitators || !facilitators.length || !isValid}>Create meeting</Button>
        </div>
      </form>
    </Modal>
  )
}
