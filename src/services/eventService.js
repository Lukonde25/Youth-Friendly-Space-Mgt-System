import { supabase } from './supabaseClient'
import { attachSignedCoverUrls, removeCoverImage, uploadCoverImage } from './postService'

const attachOutcomePhotos = async (events) => Promise.all(events.map(async (event) => {
  if (!event.photo_url) return { ...event, outcome_photo_url: null }
  const { data, error } = await supabase.storage
    .from('organization-post-covers')
    .createSignedUrl(event.photo_url, 60 * 60)
  if (error) throw error
  return { ...event, outcome_photo_url: data.signedUrl }
}))

export const fetchEvents = async (organizationId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
  if (error) throw error
  const withCovers = await attachSignedCoverUrls(data || [])
  return attachOutcomePhotos(withCovers)
}

export const fetchEvent = async (eventId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()
  if (error) throw error

  const { data: invitations } = await supabase
    .from('event_invitations')
    .select('status')
    .eq('event_id', eventId)

  const stats = {
    total_invited: invitations?.length || 0,
    confirmed: invitations?.filter(i => i.status === 'confirmed').length || 0,
    attended: invitations?.filter(i => i.status === 'attended').length || 0
  }

  const [withCover] = await attachSignedCoverUrls([{ ...data, ...stats }])
  return (await attachOutcomePhotos([withCover]))[0]
}

export const createEvent = async (organizationId, userId, eventData) => {
  const { coverFile, ...fields } = eventData
  const coverImagePath = await uploadCoverImage(organizationId, userId, coverFile)
  const { data, error } = await supabase
    .from('events')
    .insert([{
      organization_id: organizationId,
      ...fields,
      cover_image_path: coverImagePath,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()
  if (error) {
    if (coverImagePath) {
      try {
        await removeCoverImage(coverImagePath)
      } catch (cleanupError) {
        console.error('Could not remove event cover after event creation failed:', cleanupError)
      }
    }
    throw error
  }
  return (await attachSignedCoverUrls([data]))[0]
}

export const updateEvent = async (eventId, eventData) => {
  const { data, error } = await supabase
    .from('events')
    .update(eventData)
    .eq('id', eventId)
    .select()
    .single()
  if (error) throw error
  return (await attachSignedCoverUrls([data]))[0]
}

export const deleteEvent = async (eventId, coverImagePath) => {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
  if (coverImagePath) {
    try {
      await removeCoverImage(coverImagePath)
    } catch (cleanupError) {
      throw new Error(`The event was deleted, but its cover image could not be removed: ${cleanupError.message}`)
    }
  }
}

export const cancelEvent = async (eventId) => {
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
  if (error) throw error
}

export const inviteMembers = async (eventId, memberIds) => {
  if (!memberIds.length) return []

  const { data: existingInvitations, error: existingError } = await supabase
    .from('event_invitations')
    .select('member_id')
    .eq('event_id', eventId)
    .in('member_id', memberIds)
  if (existingError) throw existingError

  const alreadyInvitedIds = new Set((existingInvitations || []).map(({ member_id }) => member_id))
  const newMemberIds = memberIds.filter((memberId) => !alreadyInvitedIds.has(memberId))
  if (!newMemberIds.length) return []

  const invitations = newMemberIds.map(memberId => ({
    event_id: eventId,
    member_id: memberId,
    status: 'invited',
    created_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('event_invitations')
    .insert(invitations)
    .select()
  if (error) throw error
  return data
}

export const fetchEventInvitations = async (eventId) => {
  const { data, error } = await supabase
    .from('event_invitations')
    .select('*, members:member_id(id, name, phone, email)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export const updateInvitationStatus = async (invitationId, status) => {
  const { data, error } = await supabase
    .from('event_invitations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invitationId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const recordEventAttendance = async (eventId, memberIds) => {
  const { error } = await supabase
    .from('event_invitations')
    .update({ status: 'attended', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('member_id', memberIds)
  if (error) throw error
}

export const fetchUpcomingEvents = async (organizationId, limit = 5) => {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return attachSignedCoverUrls(data || [])
}

export const fetchPastEvents = async (organizationId, limit = 10) => {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return attachSignedCoverUrls(data || [])
}
