import { supabase } from './supabaseClient'

export const fetchEvents = async (organizationId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
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

  return { ...data, ...stats }
}

export const createEvent = async (organizationId, eventData) => {
  const { data, error } = await supabase
    .from('events')
    .insert([{ organization_id: organizationId, ...eventData, created_at: new Date().toISOString() }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateEvent = async (eventId, eventData) => {
  const { data, error } = await supabase
    .from('events')
    .update(eventData)
    .eq('id', eventId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteEvent = async (eventId) => {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export const cancelEvent = async (eventId) => {
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
  if (error) throw error
}

export const inviteMembers = async (eventId, memberIds) => {
  const invitations = memberIds.map(memberId => ({
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
  return data
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
  return data
}
