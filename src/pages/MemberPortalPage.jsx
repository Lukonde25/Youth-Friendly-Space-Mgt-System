import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, EventCard } from '../components'
import MeetingStatusBadge from '../components/MeetingStatusBadge'
import OrganizationPostCard from '../components/OrganizationPostCard'
import {
  fetchMemberEventFeedback,
  submitEventFeedback
} from '../services/eventFeedbackService'
import { attachSignedCoverUrls, fetchPublishedPosts } from '../services/postService'
import { fetchMemberMeetings } from '../services/meetingService'
import { fetchOrganizations, supabase } from '../services/supabaseClient'

export default function MemberPortalPage({ profile, user, activeTab, onMembershipChangeRequested }) {
  const [invitations, setInvitations] = useState([])
  const [memberMeetings, setMemberMeetings] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [spaceSaving, setSpaceSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [requestedOrganizationId, setRequestedOrganizationId] = useState('')
  const [profileScreen, setProfileScreen] = useState('general')
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmation: '' })
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
        const [invitationResult, memberMeetingData] = await Promise.all([
          supabase
            .from('event_invitations')
            .select('id, status, events(id, name, date, location, description, event_type, status, capacity, cover_image_path)')
            .eq('member_id', profile.member_id)
            .order('created_at', { ascending: false }),
          fetchMemberMeetings(profile.member_id, user.id)
        ])

        if (invitationResult.error) throw invitationResult.error
        const invitationData = invitationResult.data || []
        const eventsWithCovers = await attachSignedCoverUrls(
          invitationData.map((invitation) => invitation.events).filter(Boolean)
        )
        const signedEvents = new Map(eventsWithCovers.map((event) => [event.id, event]))
        if (isMounted) {
          setInvitations(invitationData.map((invitation) => ({
            ...invitation,
            events: invitation.events ? signedEvents.get(invitation.events.id) : null
          })))
          setMemberMeetings(memberMeetingData)
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
  }, [profile.member_id, user.id])

  useEffect(() => {
    if (activeTab !== 'Profile') return undefined
    setProfileScreen('general')

    let isMounted = true
    fetchOrganizations()
      .then((organizationData) => {
        if (isMounted) setOrganizations(organizationData || [])
      })
      .catch((loadError) => {
        if (isMounted) setError(loadError.message)
      })

    return () => {
      isMounted = false
    }
  }, [activeTab])

  const upcomingInvitations = useMemo(() => invitations.filter((invitation) => (
    invitation.events && invitation.events.status !== 'cancelled' && new Date(invitation.events.date) >= new Date()
  )), [invitations])
  const otherOrganizations = useMemo(
    () => organizations.filter((organization) => organization.id !== profile.organization_id),
    [organizations, profile.organization_id]
  )
  const pastInvitations = useMemo(() => invitations.filter((invitation) => (
    invitation.events && (
      invitation.events.status === 'cancelled'
      || new Date(invitation.events.date) < new Date()
    )
  )), [invitations])
  const attendedCount = invitations.filter((invitation) => invitation.status === 'attended').length
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
          phone: form.phone.trim()
        })
        .eq('id', user.id)
      if (profileError) throw profileError

      setNotice((current) => current || 'Your profile was updated.')
      setProfileScreen('general')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const cancelProfileEdit = () => {
    setForm({
      full_name: profile.full_name || '',
      email: user.email || '',
      phone: profile.phone || '',
      age: profile.age || ''
    })
    setProfileScreen('general')
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (passwordForm.password.length < 8) {
      setError('Your new password must be at least 8 characters long.')
      return
    }
    if (passwordForm.password !== passwordForm.confirmation) {
      setError('The password confirmation does not match.')
      return
    }

    try {
      setPasswordSaving(true)
      setError(null)
      setNotice(null)
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordForm.password
      })
      if (passwordError) throw passwordError
      setPasswordForm({ password: '', confirmation: '' })
      setNotice('Your password was changed.')
    } catch (passwordError) {
      setError(passwordError.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const requestFriendlySpaceChange = async (event) => {
    event.preventDefault()
    const nextOrganization = organizations.find((organization) => organization.id === requestedOrganizationId)
    if (!nextOrganization) {
      setError('Choose a friendly space from the list.')
      return
    }
    if (!window.confirm(`Request to join ${nextOrganization.name}? You will need approval from its coordinator.`)) return

    try {
      setSpaceSaving(true)
      setError(null)
      setNotice(null)
      const { error: requestError } = await supabase.rpc('request_friendly_space_change', {
        requested_organization_id: nextOrganization.id
      })
      if (requestError) throw requestError
      if (onMembershipChangeRequested) onMembershipChangeRequested(nextOrganization)
      setNotice(`Your request to join ${nextOrganization.name} was sent. The coordinator must approve it before you can use member features.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSpaceSaving(false)
    }
  }

  const renderEvents = (items, showResponse) => items.map((invitation) => (
    <div key={invitation.id} className="member-event-item">
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
    </div>
  ))

  return (
    <div className="member-portal space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {notice && <Alert variant="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}

      {!profile.member_id && (
        <Alert variant="warning">
          Your account is approved, but it is not connected to a member record. Ask your coordinator to link your membership.
        </Alert>
      )}

      {loading ? (
        <p className="text-secondary">Loading your member information...</p>
      ) : (
        <>
          {activeTab === 'Overview' && (
            <div className="member-home-grid">
              <aside className="member-upcoming-sidebar" aria-label="Upcoming events and announcements">
                <div className="member-section-heading">
                  <h2>Upcoming &amp; announcements</h2>
                  <span>Events you’ve been invited to</span>
                </div>
                {upcomingInvitations.length ? (
                  <div className="member-upcoming-list">
                    {upcomingInvitations.slice(0, 5).map((invitation) => (
                      <Card key={invitation.id} className="member-upcoming-card">
                        <span className="member-event-date">
                          {new Date(invitation.events.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <div className="member-upcoming-details">
                          <strong>{invitation.events.name}</strong>
                          <span>{new Date(invitation.events.date).toLocaleString(undefined, {
                            weekday: 'short',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}</span>
                          {invitation.events.location && <span>{invitation.events.location}</span>}
                        </div>
                        {['invited', 'confirmed', 'declined'].includes(invitation.status) && (
                          <div className="member-upcoming-actions">
                            <Button
                              size="sm"
                              onClick={() => respondToInvitation(invitation.id, 'confirmed')}
                              disabled={invitation.status === 'confirmed'}
                            >
                              {invitation.status === 'confirmed' ? 'Going' : 'Confirm'}
                            </Button>
                            {invitation.status !== 'declined' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => respondToInvitation(invitation.id, 'declined')}
                              >
                                Decline
                              </Button>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card><p className="text-secondary">No upcoming event announcements.</p></Card>
                )}
                <div className="member-upcoming-summary">
                  <span>Events attended</span><strong>{attendedCount}</strong>
                  <span>Meetings attended</span><strong>{memberMeetings.filter((meeting) => meeting.was_attended).length}</strong>
                </div>
              </aside>
              <section className="member-post-feed">
                <div className="member-section-heading">
                  <h2>Posts</h2>
                  <span>Updates from your friendly space</span>
                </div>
                <CentreNews organizationId={profile.organization_id} userId={user.id} />
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

          {activeTab === 'Meetings' && (
            <section className="space-y-4">
              <h3>Meetings and facilitation</h3>
              {memberMeetings.length ? memberMeetings.map((meeting) => (
                <Card key={meeting.id} className="member-attended-meeting">
                  <div className="flex-between gap-3">
                    <h4>{meeting.title}</h4>
                    <MeetingStatusBadge status={meeting.status} />
                  </div>
                  <p className="text-secondary">
                    <strong>{meeting.is_facilitator ? 'Facilitating a meeting on' : 'Meeting date:'}</strong>{' '}
                    {new Date(meeting.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p><strong>Location:</strong> {meeting.location}</p>
                  {meeting.description && <p>{meeting.description}</p>}
                  {meeting.topic && <p><strong>Topic:</strong> {meeting.topic}</p>}
                  {meeting.announcements && <p><strong>Announcements:</strong> {meeting.announcements}</p>}
                  {meeting.notes && <p>{meeting.notes}</p>}
                  {meeting.photo_url && <img className="meeting-photo-preview" src={meeting.photo_url} alt={`Photo from ${meeting.title}`} />}
                </Card>
              )) : <Card><p className="text-secondary">Meetings you attend or facilitate will appear here.</p></Card>}
            </section>
          )}

          {activeTab === 'Profile' && (
            <div className="space-y-6">
              {profileScreen !== 'edit' && (
                <div className="flex gap-3" role="group" aria-label="Profile sections">
                  <Button
                    type="button"
                    variant={profileScreen === 'general' ? 'primary' : 'secondary'}
                    aria-pressed={profileScreen === 'general'}
                    onClick={() => setProfileScreen('general')}
                  >General Info</Button>
                  <Button
                    type="button"
                    variant={profileScreen === 'security' ? 'primary' : 'secondary'}
                    aria-pressed={profileScreen === 'security'}
                    onClick={() => setProfileScreen('security')}
                  >Security</Button>
                </div>
              )}

              {profileScreen === 'general' && (
                <div className="space-y-6">
                  <Card>
                    <h3>Friendly space membership</h3>
                    <p className="text-secondary">
                      Your current membership will end and the new friendly space coordinator must approve your request.
                    </p>
                    <form onSubmit={requestFriendlySpaceChange} className="space-y-4">
                      <label className="block">
                        <span className="block mb-2 font-medium text-sm">Request to join</span>
                        <select
                          className="w-full p-3 border rounded"
                          value={requestedOrganizationId}
                          onChange={(event) => setRequestedOrganizationId(event.target.value)}
                          required
                          disabled={!otherOrganizations.length || spaceSaving}
                        >
                          <option value="" disabled>
                            {otherOrganizations.length ? 'Choose a friendly space' : 'No other friendly spaces available'}
                          </option>
                          {otherOrganizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>{organization.name}</option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" variant="secondary" loading={spaceSaving}>Request change</Button>
                    </form>
                  </Card>

                  <Card>
                    <h3>General Info</h3>
                    <p className="text-secondary">Your account and contact details.</p>
                    <dl className="member-profile-details">
                      <div><dt>Full name</dt><dd>{form.full_name || 'Not provided'}</dd></div>
                      <div><dt>Email</dt><dd>{user.email || 'Not provided'}</dd></div>
                      <div><dt>Phone number</dt><dd>{form.phone || 'Not provided'}</dd></div>
                      <div><dt>Age</dt><dd>{form.age || 'Not provided'}</dd></div>
                      <div><dt>Friendly space</dt><dd>{profile.organizationName || 'Not provided'}</dd></div>
                    </dl>
                    <div className="flex justify-end mt-6">
                      <Button type="button" onClick={() => setProfileScreen('edit')}>Edit details</Button>
                    </div>
                  </Card>
                </div>
              )}

              {profileScreen === 'edit' && (
                <Card>
                  <div className="flex-between gap-3 mb-4">
                    <div><h3>Edit details</h3><p className="text-secondary">Update your name, email, and phone number.</p></div>
                    <Button type="button" variant="secondary" onClick={cancelProfileEdit}>Back</Button>
                  </div>
                  <form onSubmit={saveProfile} className="space-y-4">
                    <label className="block">
                      <span className="block mb-2 font-medium text-sm">Full name</span>
                      <input className="w-full p-3 border rounded" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
                    </label>
                    <label className="block">
                      <span className="block mb-2 font-medium text-sm">Email</span>
                      <input className="w-full p-3 border rounded" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                      <span className="block mt-2 text-sm text-secondary">You’ll need to confirm a new email address using the link sent to it.</span>
                    </label>
                    <label className="block">
                      <span className="block mb-2 font-medium text-sm">Phone number</span>
                      <input className="w-full p-3 border rounded" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
                    </label>
                    <div className="flex gap-3">
                      <Button type="button" variant="secondary" onClick={cancelProfileEdit}>Cancel</Button>
                      <Button type="submit" loading={saving}>Save details</Button>
                    </div>
                  </form>
                </Card>
              )}

              {profileScreen === 'security' && (
                <Card>
                  <h3>Security</h3>
                  <p className="text-secondary">Change your account password.</p>
                  <form onSubmit={changePassword} className="space-y-4">
                    <label className="block">
                      <span className="block mb-2 font-medium text-sm">New password</span>
                      <input className="w-full p-3 border rounded" type="password" autoComplete="new-password" minLength={8} value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} required />
                    </label>
                    <label className="block">
                      <span className="block mb-2 font-medium text-sm">Confirm new password</span>
                      <input className="w-full p-3 border rounded" type="password" autoComplete="new-password" minLength={8} value={passwordForm.confirmation} onChange={(event) => setPasswordForm({ ...passwordForm, confirmation: event.target.value })} required />
                    </label>
                    <Button type="submit" loading={passwordSaving}>Update password</Button>
                  </form>
                </Card>
              )}
            </div>
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

function CentreNews({ organizationId, userId }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    const loadPosts = async () => {
      try {
        const data = await fetchPublishedPosts(organizationId, userId)
        if (isMounted) setPosts(data.slice(0, 10))
      } catch (loadError) {
        if (isMounted) setError(loadError.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadPosts()
    return () => {
      isMounted = false
    }
  }, [organizationId, userId])

  if (error) return <Alert variant="error">{`Could not load centre news: ${error}`}</Alert>
  if (loading) return <p className="text-secondary">Loading posts...</p>
  if (!posts.length) return <Card><p className="text-secondary">No centre news yet.</p></Card>
  return (
    <div className="member-post-list">
      {posts.map((post) => (
        <OrganizationPostCard key={post.id} post={post} userId={userId} />
      ))}
    </div>
  )
}
