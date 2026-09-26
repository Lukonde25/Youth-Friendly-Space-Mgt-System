import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, EventCard } from '../components'
import {
  fetchMemberEventFeedback,
  submitEventFeedback
} from '../services/eventFeedbackService'
import { supabase } from '../services/supabaseClient'

const portalTabs = [
  { label: 'Overview', icon: '⌂' },
  { label: 'Events', icon: '▣' },
  { label: 'Activities', icon: '◷' },
  { label: 'Profile', icon: '●' }
]

export default function MemberPortalPage({ profile, user, organizationName, onLogout }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [invitations, setInvitations] = useState([])
  const [participations, setParticipations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    email: user.email || '',
    phone: profile.phone || '',
    age: profile.age || ''
  })

  useEffect(() => {
    if (!profile.member_id) {
      setLoading(false)
      return
    }

    let isMounted = true
    const loadParticipation = async () => {
      try {
        setError(null)
        const [invitationResult, participationResult] = await Promise.all([
          supabase
            .from('event_invitations')
            .select('id, status, events(id, name, date, location, description, event_type, status)')
            .eq('member_id', profile.member_id)
            .order('created_at', { ascending: false }),
          supabase
            .from('activity_participants')
            .select('id, activity_id, activities(id, activity_type, date, location, people_reached, contraceptives_distributed, pregnancies_identified, screenings_done, health_talks_given)')
            .eq('member_id', profile.member_id)
        ])

        if (invitationResult.error) throw invitationResult.error
        if (participationResult.error) throw participationResult.error
        if (isMounted) {
          setInvitations(invitationResult.data || [])
          setParticipations(participationResult.data || [])
        }
      } catch (loadError) {
        if (isMounted) setError(loadError.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadParticipation()
    return () => {
      isMounted = false
    }
  }, [profile.member_id])

  const upcomingInvitations = useMemo(() => invitations.filter((invitation) => (
    invitation.events && invitation.events.status !== 'cancelled' && new Date(invitation.events.date) >= new Date()
  )), [invitations])
  const pastInvitations = useMemo(() => invitations.filter((invitation) => (
    invitation.events && (
      invitation.events.status === 'cancelled'
      || new Date(invitation.events.date) < new Date()
    )
  )), [invitations])
  const attendedCount = invitations.filter((invitation) => invitation.status === 'attended').length
  const contribution = participations.reduce((totals, item) => {
    const activity = item.activities
    if (!activity) return totals
    totals.people += activity.people_reached || 0
    totals.screenings += activity.screenings_done || 0
    totals.talks += activity.health_talks_given || 0
    return totals
  }, { people: 0, screenings: 0, talks: 0 })

  const respondToInvitation = async (invitationId, response) => {
    try {
      setError(null)
      setNotice(null)
      const { error: responseError } = await supabase.rpc('respond_to_event_invitation', {
        requested_invitation_id: invitationId,
        requested_response: response
      })
      if (responseError) throw responseError
      setInvitations((current) => current.map((invitation) => (
        invitation.id === invitationId ? { ...invitation, status: response } : invitation
      )))
      setNotice(`Your response was ${response}.`)
    } catch (responseError) {
      setError(responseError.message)
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      setNotice(null)

      if (form.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: form.email.trim() })
        if (emailError) throw emailError
        setNotice('Check your new email address for a confirmation link. Your account email changes after confirmation.')
      }

      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          age: Number(form.age)
        })
        .eq('id', user.id)
      if (profileError) throw profileError

      setNotice((current) => current || 'Your profile was updated.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const renderEvents = (items, showResponse) => items.map((invitation) => (
    <Card key={invitation.id}>
      <EventCard
        event={invitation.events}
        showActions={false}
        showInvitationStats={false}
      />
      <div className="member-event-footer">
        <span className="text-sm text-secondary">
          Invitation status: <strong>{invitation.status}</strong>
        </span>
        {showResponse && invitation.events.status !== 'cancelled' && ['invited', 'confirmed', 'declined'].includes(invitation.status) && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => respondToInvitation(invitation.id, 'confirmed')}
              disabled={invitation.status === 'confirmed'}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => respondToInvitation(invitation.id, 'declined')}
              disabled={invitation.status === 'declined'}
            >
              Decline
            </Button>
          </div>
        )}
      </div>
      {invitation.status === 'attended' && (
        <MemberEventFeedback eventId={invitation.events.id} memberId={profile.member_id} />
      )}
    </Card>
  ))

  return (
    <div className="member-portal space-y-6">
      <header className="member-welcome">
        <p className="member-eyebrow">{organizationName}</p>
        <h2>Hello, {profile.full_name || user.email?.split('@')[0] || 'there'}</h2>
        <p>Your centre updates and participation, together in one place.</p>
        <button type="button" className="member-logout" onClick={onLogout}>Sign out</button>
      </header>

      <nav className="member-tabs" aria-label="Member sections">
        {portalTabs.map(({ label, icon }) => (
          <button
            key={label}
            type="button"
            className={activeTab === label ? 'member-tab active' : 'member-tab'}
            onClick={() => setActiveTab(label)}
          >
            <span className="mobile-nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {notice && <Alert variant="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}

      {!profile.member_id && (
        <Alert variant="warning">
          Your account is approved, but it is not connected to a member record. Ask your coordinator to link your membership.
        </Alert>
      )}

      {loading ? (
        <p className="text-secondary">Loading your activity...</p>
      ) : (
        <>
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-3 gap-4 member-dashboard-stats">
                <Card className="member-stat"><span>Events attended</span><strong>{attendedCount}</strong></Card>
                <Card className="member-stat"><span>Activities joined</span><strong>{participations.length}</strong></Card>
                <Card className="member-stat"><span>People reached</span><strong>{contribution.people}</strong></Card>
              </div>
              <section className="space-y-4">
                <h3>Upcoming invitations</h3>
                {upcomingInvitations.length ? renderEvents(upcomingInvitations.slice(0, 3), true) : (
                  <Card><p className="text-secondary">No upcoming invitations.</p></Card>
                )}
              </section>
              <section className="space-y-4">
                <h3>Centre news</h3>
                <CentreNews organizationId={profile.organization_id} />
              </section>
            </div>
          )}

          {activeTab === 'Events' && (
            <div className="space-y-6">
              <section className="space-y-4">
                <h3>Upcoming invitations</h3>
                {upcomingInvitations.length ? renderEvents(upcomingInvitations, true) : (
                  <Card><p className="text-secondary">No upcoming invitations.</p></Card>
                )}
              </section>
              <section className="space-y-4">
                <h3>Past events</h3>
                {pastInvitations.length ? renderEvents(pastInvitations, false) : (
                  <Card><p className="text-secondary">No past events yet.</p></Card>
                )}
              </section>
            </div>
          )}

          {activeTab === 'Activities' && (
            <section className="space-y-4">
              <h3>Your participation</h3>
              <Card className="member-stat-row">
                <span>People reached through your activities</span><strong>{contribution.people}</strong>
              </Card>
              <Card className="member-stat-row">
                <span>Screenings supported</span><strong>{contribution.screenings}</strong>
              </Card>
              <Card className="member-stat-row">
                <span>Health talks supported</span><strong>{contribution.talks}</strong>
              </Card>
              {participations.map((item) => item.activities && (
                <Card key={item.id}>
                  <h4>{item.activities.activity_type.replaceAll('_', ' ')}</h4>
                  <p className="text-secondary">
                    {new Date(item.activities.date).toLocaleDateString()}
                    {item.activities.location ? ` · ${item.activities.location}` : ''}
                  </p>
                  <p className="text-sm text-secondary">
                    {item.activities.people_reached || 0} people reached · {item.activities.screenings_done || 0} screenings
                  </p>
                </Card>
              ))}
            </section>
          )}

          {activeTab === 'Profile' && (
            <Card>
              <h3>Your profile</h3>
              <form onSubmit={saveProfile} className="space-y-4">
                <label className="block">
                  <span className="block mb-2 font-medium text-sm">Full name</span>
                  <input
                    className="w-full p-3 border rounded"
                    value={form.full_name}
                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="block mb-2 font-medium text-sm">Email</span>
                  <input
                    className="w-full p-3 border rounded"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="block mb-2 font-medium text-sm">Phone</span>
                  <input
                    className="w-full p-3 border rounded"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="block mb-2 font-medium text-sm">Age</span>
                  <input
                    className="w-full p-3 border rounded"
                    type="number"
                    min="10"
                    max="120"
                    value={form.age}
                    onChange={(event) => setForm({ ...form, age: event.target.value })}
                    required
                  />
                </label>
                <Button type="submit" loading={saving}>Save profile</Button>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function MemberEventFeedback({ eventId, memberId }) {
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState('5')
  const [existingFeedback, setExistingFeedback] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMemberEventFeedback(eventId, memberId)
      .then(setExistingFeedback)
      .catch((loadError) => setError(loadError.message))
  }, [eventId, memberId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const result = await submitEventFeedback({ eventId, memberId, rating, feedback })
      setExistingFeedback(result)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  if (existingFeedback) {
    return (
      <div className="mt-4 border-t pt-4">
        <p className="font-medium">Your feedback · {existingFeedback.rating}/5</p>
        <p className="text-sm text-secondary">{existingFeedback.feedback}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t pt-4 space-y-3">
      <h4>Share event feedback</h4>
      {error && <Alert variant="error">{error}</Alert>}
      <label className="block">
        <span className="block mb-2 text-sm font-medium">Rating</span>
        <select className="w-full p-3 border rounded" value={rating} onChange={(event) => setRating(event.target.value)}>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select>
      </label>
      <textarea
        className="w-full p-3 border rounded"
        placeholder="What did you think about the event?"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        required
        rows="3"
      />
      <Button type="submit" size="sm" loading={saving}>Submit feedback</Button>
    </form>
  )
}

function CentreNews({ organizationId }) {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    const loadPosts = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('organization_posts')
          .select('id, title, body, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(3)
        if (queryError) throw queryError
        if (isMounted) setPosts(data || [])
      } catch (loadError) {
        if (isMounted) setError(loadError.message)
      }
    }
    loadPosts()
    return () => {
      isMounted = false
    }
  }, [organizationId])

  if (error) return <Alert variant="error">{`Could not load centre news: ${error}`}</Alert>
  if (!posts.length) return <Card><p className="text-secondary">No centre news yet.</p></Card>
  return posts.map((post) => (
    <Card key={post.id}>
      <h4>{post.title}</h4>
      <p className="text-secondary whitespace-pre-wrap">{post.body}</p>
      <p className="text-sm text-tertiary">{new Date(post.created_at).toLocaleString()}</p>
    </Card>
  ))
}
