import { createPost, deletePost } from './postService'
import { supabase } from './supabaseClient'

const meetingFields = 'id, organization_id, title, scheduled_at, location, description, capacity, status, topic, announcements, notes, photo_path, post_id, created_by, created_at'
const STORAGE_BUCKET = 'organization-post-covers'

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const attachFacilitatorProfiles = async (facilitators, client) => {
  const userIds = [...new Set(facilitators.map((facilitator) => facilitator.user_id))]
  if (!userIds.length) return []
  const [usersResult, membersResult] = await Promise.all([
    client.from('users').select('id, full_name, email').in('id', userIds),
    client.from('members').select('user_id, name').in('user_id', userIds)
  ])
  if (usersResult.error) throw usersResult.error
  if (membersResult.error) throw membersResult.error
  const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]))
  const membersByUserId = new Map((membersResult.data || []).map((member) => [member.user_id, member]))
  return facilitators.map((facilitator) => {
    const user = usersById.get(facilitator.user_id)
    const member = membersByUserId.get(facilitator.user_id)
    return {
      ...facilitator,
      full_name: user?.full_name,
      email: user?.email,
      name: member?.name || user?.full_name || user?.email || 'Member'
    }
  })
}

export const fetchMeetings = async (organizationId, { upcomingOnly = false } = {}) => {
  const client = requireSupabase()
  let query = client
    .from('meetings')
    .select(meetingFields)
    .eq('organization_id', organizationId)
    .order('scheduled_at', { ascending: true })
  if (upcomingOnly) {
    query = query
      .in('status', ['scheduled', 'ongoing'])
      .gte('scheduled_at', new Date().toISOString())
      .limit(3)
  }
  const { data, error } = await query
  if (error) throw error

  const meetings = data || []
  if (!meetings.length) return []
  const meetingIds = meetings.map((meeting) => meeting.id)
  const [facilitatorResult, attendanceResult] = await Promise.all([
    client
      .from('meeting_facilitators')
      .select('meeting_id, user_id, confirmed_at, attended')
      .in('meeting_id', meetingIds),
    client
      .from('meeting_attendance')
      .select('meeting_id, attended')
      .in('meeting_id', meetingIds)
      .eq('attended', true)
  ])
  if (facilitatorResult.error) throw facilitatorResult.error
  if (attendanceResult.error) throw attendanceResult.error

  const facilitatorsWithProfiles = await attachFacilitatorProfiles(facilitatorResult.data || [], client)

  const facilitatorsByMeeting = new Map()
  for (const facilitator of facilitatorsWithProfiles) {
    const current = facilitatorsByMeeting.get(facilitator.meeting_id) || []
    current.push(facilitator)
    facilitatorsByMeeting.set(facilitator.meeting_id, current)
  }
  const attendanceByMeeting = new Map()
  for (const attendance of attendanceResult.data || []) {
    attendanceByMeeting.set(
      attendance.meeting_id,
      (attendanceByMeeting.get(attendance.meeting_id) || 0) + 1
    )
  }

  const signedMeetings = await Promise.all(meetings.map(async (meeting) => {
    if (!meeting.photo_path) return { ...meeting, photo_url: null }
    const { data: signedPhoto, error: photoError } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(meeting.photo_path, 60 * 60)
    if (photoError) throw photoError
    return { ...meeting, photo_url: signedPhoto.signedUrl }
  }))

  return signedMeetings.map((meeting) => ({
    ...meeting,
    facilitators: facilitatorsByMeeting.get(meeting.id) || [],
    attendees_count: attendanceByMeeting.get(meeting.id) || 0
  }))
}

export const fetchAvailableMeetingFacilitators = async (organizationId) => {
  const client = requireSupabase()
  const { data: members, error: membersError } = await client
    .from('members')
    .select('id, name, user_id')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .not('user_id', 'is', null)
    .order('name', { ascending: true })
  if (membersError) throw membersError
  if (!members?.length) return []

  const userIds = members.map((member) => member.user_id)
  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds)
    .in('app_role', ['member', 'general_user'])
    .eq('approval_status', 'approved')
  if (usersError) throw usersError
  const usersById = new Map((users || []).map((user) => [user.id, user]))
  return members
    .filter((member) => usersById.has(member.user_id))
    .map((member) => ({
      id: member.user_id,
      member_id: member.id,
      name: member.name,
      ...usersById.get(member.user_id)
    }))
}

export const createMeeting = async (organizationId, userId, meeting, facilitatorIds) => {
  const client = requireSupabase()
  const { data, error } = await client
    .from('meetings')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      title: `Meeting - ${new Date(meeting.scheduled_at).toLocaleDateString()}`,
      scheduled_at: meeting.scheduled_at,
      location: 'To be confirmed'
    })
    .select(meetingFields)
    .single()
  if (error) throw error

  const assignments = facilitatorIds.map((facilitatorId) => ({
    meeting_id: data.id,
    user_id: facilitatorId,
    assigned_by: userId
  }))
  const { error: assignmentError } = await client.from('meeting_facilitators').insert(assignments)
  if (assignmentError) {
    const { error: cleanupError } = await client.from('meetings').delete().eq('id', data.id)
    if (cleanupError) {
      throw new Error(
        `The meeting was created, but facilitator assignment failed: ${assignmentError.message}. `
        + `Automatic cleanup also failed: ${cleanupError.message}`
      )
    }
    throw assignmentError
  }
  return data
}

export const fetchMeetingRegister = async (meetingId, organizationId) => {
  const client = requireSupabase()
  const [membersResult, attendanceResult, facilitatorResult] = await Promise.all([
    client
      .from('members')
      .select('id, name, phone')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('name', { ascending: true }),
    client
      .from('meeting_attendance')
      .select('member_id, attended')
      .eq('meeting_id', meetingId),
    client
      .from('meeting_facilitators')
      .select('user_id, confirmed_at, attended')
      .eq('meeting_id', meetingId)
  ])
  if (membersResult.error) throw membersResult.error
  if (attendanceResult.error) throw attendanceResult.error
  if (facilitatorResult.error) throw facilitatorResult.error
  const facilitators = await attachFacilitatorProfiles(facilitatorResult.data || [], client)
  const attendanceByMember = new Map(
    (attendanceResult.data || []).map((attendance) => [attendance.member_id, attendance.attended])
  )
  return {
    members: (membersResult.data || []).map((member) => ({
      ...member,
      attended: attendanceByMember.get(member.id) === true
    })),
    facilitators
  }
}

export const updateMeetingDetails = async (meetingId, values) => {
  const client = requireSupabase()
  const { error } = await client
    .from('meetings')
    .update({
      topic: values.topic.trim() || null,
      announcements: values.announcements.trim() || null,
      notes: values.notes.trim() || null,
      photo_path: values.photo_path || null
    })
    .eq('id', meetingId)
  if (error) throw error
}

export const updateMeetingSchedule = async (meetingId, scheduledAt) => {
  const client = requireSupabase()
  const { error } = await client.from('meetings').update({ scheduled_at: scheduledAt }).eq('id', meetingId)
  if (error) throw error
}

export const updateMeetingStatus = async (meetingId, status) => {
  const client = requireSupabase()
  const { error } = await client.from('meetings').update({ status }).eq('id', meetingId)
  if (error) throw error
}

export const saveMeetingAttendance = async (meetingId, memberIds, attended, userId) => {
  const client = requireSupabase()
  if (!memberIds.length) return
  const { error } = await client
    .from('meeting_attendance')
    .upsert(
      memberIds.map((memberId) => ({
        meeting_id: meetingId,
        member_id: memberId,
        attended,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })),
      { onConflict: 'meeting_id,member_id' }
    )
  if (error) throw error
}

export const clearMeetingAttendance = async (meetingId) => {
  const client = requireSupabase()
  const { error } = await client.from('meeting_attendance').delete().eq('meeting_id', meetingId)
  if (error) throw error
}

export const setMeetingFacilitatorStatus = async (meetingId, userId, updates) => {
  const client = requireSupabase()
  const { error } = await client
    .from('meeting_facilitators')
    .update(updates)
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
  if (error) throw error
}

export const addMeetingFacilitator = async (meetingId, userId, assignedBy) => {
  const client = requireSupabase()
  const { error } = await client
    .from('meeting_facilitators')
    .insert({ meeting_id: meetingId, user_id: userId, assigned_by: assignedBy })
  if (error) throw error
}

export const removeMeetingFacilitator = async (meetingId, userId) => {
  const client = requireSupabase()
  const { error } = await client
    .from('meeting_facilitators')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
  if (error) throw error
}

export const shareMeetingAsPost = async (meeting, userId, coverFile) => {
  const client = requireSupabase()
  if (meeting.post_id) return meeting.post_id
  let postCover = coverFile
  if (!postCover && meeting.photo_path) {
    const { data, error } = await client.storage.from(STORAGE_BUCKET).download(meeting.photo_path)
    if (error) throw error
    postCover = data
  }
  const post = await createPost(meeting.organization_id, userId, {
    title: `Meeting: ${meeting.title}`,
    body: [
      meeting.description,
      meeting.topic && `Topic: ${meeting.topic}`,
      meeting.notes,
      meeting.announcements && `Announcements: ${meeting.announcements}`
    ].filter(Boolean).join('\n\n') || `A meeting was held at ${meeting.location}.`,
    coverFile: postCover
  })
  const { error } = await client
    .from('meetings')
    .update({ post_id: post.id, is_posted_to_community: true })
    .eq('id', meeting.id)
  if (error) {
    try {
      await deletePost(post.id, post.cover_image_path)
    } catch (cleanupError) {
      throw new Error(
        `The community post was created, but the meeting could not be linked to it: ${error.message}. `
        + `Automatic cleanup also failed: ${cleanupError.message}`
      )
    }
    throw new Error(`The community post could not be linked to the meeting: ${error.message}`)
  }
  return post.id
}

export const fetchMemberMeetings = async (memberId, userId) => {
  const client = requireSupabase()
  const [attendanceResult, facilitatorResult] = await Promise.all([
    client
      .from('meeting_attendance')
      .select('meeting_id')
      .eq('member_id', memberId)
      .eq('attended', true),
    client
      .from('meeting_facilitators')
      .select('meeting_id')
      .eq('user_id', userId)
  ])
  if (attendanceResult.error) throw attendanceResult.error
  if (facilitatorResult.error) throw facilitatorResult.error

  const attendedIds = new Set((attendanceResult.data || []).map((row) => row.meeting_id))
  const facilitatorIds = new Set((facilitatorResult.data || []).map((row) => row.meeting_id))
  const meetingIds = [...new Set([...attendedIds, ...facilitatorIds])]
  if (!meetingIds.length) return []

  const { data, error } = await client
    .from('meetings')
    .select('id, title, scheduled_at, location, description, topic, announcements, notes, photo_path, status')
    .in('id', meetingIds)
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  const meetings = (data || []).map((meeting) => ({
    ...meeting,
    is_facilitator: facilitatorIds.has(meeting.id),
    was_attended: attendedIds.has(meeting.id)
  }))
  return Promise.all(meetings.map(async (meeting) => {
    if (!meeting.photo_path) return { ...meeting, photo_url: null }
    const { data: signedPhoto, error: photoError } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(meeting.photo_path, 60 * 60)
    if (photoError) throw photoError
    return { ...meeting, photo_url: signedPhoto.signedUrl }
  }))
}
