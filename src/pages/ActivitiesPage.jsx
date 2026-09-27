import { useEffect, useRef, useState } from 'react'
import { Button, Card, Alert } from '../components'
import ActivityCard from '../components/ActivityCard'
import { useForm } from '../hooks/useForm'
import { logActivity, fetchActivities, deleteActivity, recordActivityParticipants } from '../services/activityService'
import { fetchMembers } from '../services/memberService'

export default function ActivitiesPage({ organizationId, userId }) {
  const [activities, setActivities] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadActivities()
  }, [organizationId])

  const loadActivities = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchActivities(organizationId)
      const memberData = await fetchMembers(organizationId)
      setActivities(data || [])
      setMembers(memberData || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteActivity = async (activityId) => {
    if (!confirm('Delete this activity?')) return
    try {
      const activity = activities.find((item) => item.id === activityId)
      await deleteActivity(activityId, activity?.cover_image_path)
      await loadActivities()
    } catch (err) {
      setError(err.message)
      if (err.message.startsWith('The activity was deleted,')) await loadActivities()
    }
  }

  if (loading) return <div className="p-6 text-center text-secondary">Loading activities...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <div>
        <h2 className="text-2xl font-bold">Activities</h2>
        <p className="text-secondary">Create a cover-first activity update and record its results.</p>
      </div>

      <LogActivityForm organizationId={organizationId} userId={userId} members={members} onSuccess={loadActivities} />

      {activities.length > 0 ? (
        <div className="activity-card-grid">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onDelete={handleDeleteActivity} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">📝</div>
          <h3>No Activities Yet</h3>
          <p className="text-secondary mb-4">Your activities will appear here after you add one.</p>
        </Card>
      )}
    </div>
  )
}

function LogActivityForm({ organizationId, userId, members, onSuccess }) {
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
    { activity_type: 'clinic_visit', date: new Date().toISOString().split('T')[0], location: '', people_reached: '', pregnancies_identified: '', contraceptives_distributed: '', screenings_done: '', health_talks_given: '', participant_ids: [], notes: '' },
    async (values) => {
      try {
        setSubmitError(null)
        const activity = await logActivity(organizationId, userId, {
          activity_type: values.activity_type,
          date: values.date,
          location: values.location,
          people_reached: parseInt(values.people_reached, 10) || 0,
          pregnancies_identified: parseInt(values.pregnancies_identified, 10) || 0,
          contraceptives_distributed: parseInt(values.contraceptives_distributed, 10) || 0,
          screenings_done: parseInt(values.screenings_done, 10) || 0,
          health_talks_given: parseInt(values.health_talks_given, 10) || 0,
          description: values.notes,
          coverFile
        })
        if (values.participant_ids.length) {
          try {
            await recordActivityParticipants(activity.id, values.participant_ids)
          } catch (participantError) {
            try {
              await deleteActivity(activity.id, activity.cover_image_path)
            } catch (cleanupError) {
              throw new Error(
                `Activity was saved, but participant linking failed: ${participantError.message}. `
                + `Automatic cleanup also failed: ${cleanupError.message}`
              )
            }
            throw participantError
          }
        }
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
          <h3>Add an activity</h3>
          <p className="text-secondary">Share a cover-first activity update with its results and participants.</p>
        </div>
        <span className="post-composer-step">1 · Activity details</span>
      </div>
      {submitError && <Alert variant="error" className="mb-4" onDismiss={() => setSubmitError(null)}>{submitError}</Alert>}

      <form onSubmit={form.handleSubmit} className="content-compose-form">
        <div className="content-compose-intro">
          <span className="content-compose-icon" aria-hidden="true">✦</span>
          <div>
            <h3>Share an activity update</h3>
            <p className="text-secondary">Add a cover and summary, then record the service metrics and participants.</p>
          </div>
        </div>
        <section className="content-compose-section">
          <div className="post-composer-heading">
            <div><h4>Activity cover</h4><p className="text-secondary">The activity type and summary appear over the image.</p></div>
            <span className="post-composer-step">01 · Cover</span>
          </div>
          <div className="content-compose-fields-grid">
            <label className="content-compose-field">
              <span>Activity type</span>
              <select name="activity_type" value={form.values.activity_type} onChange={form.handleChange} required>
                <option value="clinic_visit">Clinic Visit</option>
                <option value="outreach">Outreach</option>
                <option value="health_talk">Health Talk</option>
                <option value="training">Training</option>
                <option value="conference">Conference</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="content-compose-field">
              <span>Date</span>
              <input type="date" name="date" value={form.values.date} onChange={form.handleChange} required />
            </label>
            <label className="content-compose-field content-compose-field-wide">
              <span>Location <small>Optional</small></span>
              <input type="text" name="location" placeholder="Where did this activity take place?" value={form.values.location} onChange={form.handleChange} />
            </label>
          </div>
          <label className="content-compose-field">
            <span>Activity description</span>
            <textarea name="notes" placeholder="Describe the activity and its impact..." value={form.values.notes} onChange={form.handleChange} rows="3" maxLength="10000" />
          </label>
          <div className="content-compose-image-row">
            <label className="post-image-select">
              <input
                type="file"
                ref={coverInputRef}
                accept="image/*"
                aria-label="Choose activity cover image"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  if (file && (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024)) {
                    setSubmitError(file.size > 12 * 1024 * 1024
                      ? 'Choose an image under 12 MB.'
                      : 'Choose an image file for the activity cover.')
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
              <strong>{form.values.activity_type.replaceAll('_', ' ') || 'Your activity'}</strong>
              <p>{form.values.notes || 'Your activity description will appear here.'}</p>
            </div>
          </div>
        </section>
        <section className="content-compose-section">
          <div className="post-composer-heading">
            <div><h4>Activity results</h4><p className="text-secondary">Record the services and people reached.</p></div>
            <span className="post-composer-step">02 · Results</span>
          </div>
          <div className="content-compose-fields-grid">
            <label className="content-compose-field">
              <span>People reached</span>
              <input type="number" name="people_reached" placeholder="0" value={form.values.people_reached} onChange={form.handleChange} min="0" />
            </label>
            <label className="content-compose-field">
              <span>Pregnancies identified</span>
              <input type="number" name="pregnancies_identified" placeholder="0" value={form.values.pregnancies_identified} onChange={form.handleChange} min="0" />
            </label>
            <label className="content-compose-field">
              <span>Contraceptives distributed</span>
              <input type="number" name="contraceptives_distributed" placeholder="0" value={form.values.contraceptives_distributed} onChange={form.handleChange} min="0" />
            </label>
            <label className="content-compose-field">
              <span>Screenings done</span>
              <input type="number" name="screenings_done" placeholder="0" value={form.values.screenings_done} onChange={form.handleChange} min="0" />
            </label>
            <label className="content-compose-field">
              <span>Health talks given</span>
              <input type="number" name="health_talks_given" placeholder="0" value={form.values.health_talks_given} onChange={form.handleChange} min="0" />
            </label>
          </div>
        </section>
        <section className="content-compose-section">
          <div className="post-composer-heading">
            <div><h4>Participants</h4><p className="text-secondary">Select members who took part (optional).</p></div>
            <span className="post-composer-step">03 · Members</span>
          </div>
          <fieldset className="activity-participant-picker">
            <legend className="sr-only">Members who participated</legend>
            {members.length ? members.map((member) => (
              <label key={member.id} className="activity-participant-option">
                <input
                  type="checkbox"
                  checked={form.values.participant_ids.includes(member.id)}
                  onChange={(event) => {
                    const ids = form.values.participant_ids
                    form.setFieldValue(
                      'participant_ids',
                      event.target.checked
                        ? [...ids, member.id]
                        : ids.filter((id) => id !== member.id)
                    )
                  }}
                />
                <span>{member.name}</span>
              </label>
            )) : <p className="text-secondary">No members are available to select.</p>}
          </fieldset>
        </section>
        <div className="content-compose-actions">
          <Button type="submit" loading={form.loading}>Add Activity</Button>
        </div>
      </form>
    </Card>
  )
}
