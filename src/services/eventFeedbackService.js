import { supabase } from './supabaseClient'

export const fetchEventFeedback = async (eventId) => {
  const { data, error } = await supabase
    .from('event_feedback')
    .select('id, rating, feedback, created_at, members(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const fetchMemberEventFeedback = async (eventId, memberId) => {
  const { data, error } = await supabase
    .from('event_feedback')
    .select('id, rating, feedback')
    .eq('event_id', eventId)
    .eq('member_id', memberId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const submitEventFeedback = async ({ eventId, memberId, rating, feedback }) => {
  const { data, error } = await supabase
    .from('event_feedback')
    .insert({
      event_id: eventId,
      member_id: memberId,
      rating: Number(rating),
      feedback: feedback.trim()
    })
    .select('id, rating, feedback')
    .single()

  if (error) throw error
  return data
}
