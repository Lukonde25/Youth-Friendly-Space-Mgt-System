/**
 * Member Service
 * 
 * Handles all member-related operations
 */

import { supabase } from './supabaseClient'

export const fetchMembers = async (organizationId, { includeInactive = false } = {}) => {
  const query = supabase
    .from('members')
    .select('*')
    .eq('organization_id', organizationId)
  if (!includeInactive) query.eq('active', true)

  const { data: members, error: membersError } = await query
    .order('name', { ascending: true })

  if (membersError) throw membersError
  return members
}

export const fetchMember = async (memberId) => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single()

  if (error) throw error
  return data
}

export const createMember = async (organizationId, memberData) => {
  const { data, error } = await supabase
    .from('members')
    .insert([
      {
        organization_id: organizationId,
        ...memberData,
        active: true,
        created_at: new Date().toISOString()
      }
    ])
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateMember = async (memberId, memberData) => {
  const { data, error } = await supabase
    .from('members')
    .update(memberData)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deactivateMember = async (memberId) => {
  const { error } = await supabase.rpc('deactivate_member', {
    requested_member_id: memberId
  })
  if (error) throw error
}

export const getMemberStats = async (memberId) => {
  const { data: eventData, error: eventError } = await supabase
    .from('event_invitations')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'attended')

  const { data: activityData, error: activityError } = await supabase
    .from('activity_participants')
    .select('*')
    .eq('member_id', memberId)

  if (eventError) throw eventError
  if (activityError) throw activityError

  return {
    events_attended: eventData?.length || 0,
    activities_participated: activityData?.length || 0
  }
}

export const getMemberEngagementHistory = async (memberId) => {
  const [eventResult, activityResult] = await Promise.all([
    supabase
      .from('event_invitations')
      .select('id, status, events(name, date, location)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false }),
    supabase
      .from('activity_participants')
      .select('id, activities(activity_type, date, location)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
  ])

  if (eventResult.error) throw eventResult.error
  if (activityResult.error) throw activityResult.error

  return {
    events: eventResult.data || [],
    activities: activityResult.data || []
  }
}

export const getAvailableMembersForEvent = async (organizationId, eventId) => {
  const { data: members, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)

  if (memberError) throw memberError

  const { data: invitations, error: invError } = await supabase
    .from('event_invitations')
    .select('member_id')
    .eq('event_id', eventId)

  if (invError) throw invError

  const invitedIds = invitations.map(inv => inv.member_id)
  
  return members.filter(member => !invitedIds.includes(member.id))
}

export const searchMembers = async (organizationId, query) => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)

  if (error) throw error
  return data
}
