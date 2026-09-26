import { useEffect, useState } from 'react'
import { Button, Card, Modal, Alert, Table } from '../components'
import { useForm } from '../hooks/useForm'
import { logActivity, fetchActivities, deleteActivity, recordActivityParticipants } from '../services/activityService'
import { fetchMembers } from '../services/memberService'

export default function ActivitiesPage({ organizationId, userId }) {
  const [activities, setActivities] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLogForm, setShowLogForm] = useState(false)

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
      await deleteActivity(activityId)
      await loadActivities()
    } catch (err) {
      setError(err.message)
    }
  }

  const columns = [
    { key: 'date', label: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'activity_type', label: 'Type', render: (row) => row.activity_type.replace('_', ' ').toUpperCase() },
    { key: 'location', label: 'Location' },
    { key: 'people_reached', label: 'People' },
    { key: 'pregnancies_identified', label: 'Pregnancies' },
    { key: 'contraceptives_distributed', label: 'Contraceptives' },
    { key: 'screenings_done', label: 'Screenings' },
    { key: 'health_talks_given', label: 'Health Talks' },
    { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" variant="danger" onClick={() => handleDeleteActivity(row.id)}>Delete</Button> }
  ]

  if (loading) return <div className="p-6 text-center text-secondary">Loading activities...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <div className="flex-between">
        <h2 className="text-2xl font-bold">Activities</h2>
        <Button onClick={() => setShowLogForm(true)}>+ Log Activity</Button>
      </div>

      {activities.length > 0 ? (
        <Card>
          <Table columns={columns} data={activities} emptyMessage="No activities logged" />
        </Card>
      ) : (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">📝</div>
          <h3>No Activities Yet</h3>
          <p className="text-secondary mb-4">Start logging your outreach work and health services</p>
          <Button onClick={() => setShowLogForm(true)}>Log First Activity</Button>
        </Card>
      )}

      <LogActivityModal isOpen={showLogForm} organizationId={organizationId} userId={userId} members={members} onClose={() => setShowLogForm(false)} onSuccess={loadActivities} />
    </div>
  )
}

function LogActivityModal({ isOpen, organizationId, userId, members, onClose, onSuccess }) {
  const [submitError, setSubmitError] = useState(null)

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
          description: values.notes
        })
        if (values.participant_ids.length) {
          try {
            await recordActivityParticipants(activity.id, values.participant_ids)
          } catch (participantError) {
            try {
              await deleteActivity(activity.id)
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
        onClose()
        onSuccess()
      } catch (err) {
        setSubmitError(err.message)
      }
    }
  )

  return (
    <Modal isOpen={isOpen} title="Log Activity" onClose={onClose} size="lg">
      {submitError && <Alert variant="error" className="mb-4" onDismiss={() => setSubmitError(null)}>{submitError}</Alert>}

      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-2 font-medium text-sm">Activity Type *</label>
          <select name="activity_type" value={form.values.activity_type} onChange={form.handleChange} className="w-full p-3 border rounded" required>
            <option value="clinic_visit">Clinic Visit</option>
            <option value="outreach">Outreach</option>
            <option value="health_talk">Health Talk</option>
            <option value="training">Training</option>
            <option value="conference">Conference</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 font-medium text-sm">Date *</label>
          <input type="date" name="date" value={form.values.date} onChange={form.handleChange} className="w-full p-3 border rounded" required />
        </div>

        <input type="text" name="location" placeholder="Location (e.g., Central Market)" value={form.values.location} onChange={form.handleChange} className="w-full p-3 border rounded" />

        <div className="grid grid-2 gap-4">
          <input type="number" name="people_reached" placeholder="People Reached" value={form.values.people_reached} onChange={form.handleChange} className="w-full p-3 border rounded" min="0" />
          <input type="number" name="pregnancies_identified" placeholder="Pregnancies Identified" value={form.values.pregnancies_identified} onChange={form.handleChange} className="w-full p-3 border rounded" min="0" />
          <input type="number" name="contraceptives_distributed" placeholder="Contraceptives Distributed" value={form.values.contraceptives_distributed} onChange={form.handleChange} className="w-full p-3 border rounded" min="0" />
          <input type="number" name="screenings_done" placeholder="Screenings Done" value={form.values.screenings_done} onChange={form.handleChange} className="w-full p-3 border rounded" min="0" />
          <input type="number" name="health_talks_given" placeholder="Health Talks Given" value={form.values.health_talks_given} onChange={form.handleChange} className="w-full p-3 border rounded" min="0" />
        </div>

        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">Members who participated</legend>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {members.map((member) => (
              <label key={member.id} className="flex items-center gap-2 text-sm">
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
                {member.name}
              </label>
            ))}
          </div>
        </fieldset>

        <textarea name="notes" placeholder="Additional notes (optional)" value={form.values.notes} onChange={form.handleChange} rows="3" className="w-full p-3 border rounded" />

        <div className="flex gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={form.loading}>Log Activity</Button>
        </div>
      </form>
    </Modal>
  )
}
