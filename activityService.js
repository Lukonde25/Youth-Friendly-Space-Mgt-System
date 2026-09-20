import { supabase } from './supabaseClient'

export const fetchActivities = async (organizationId, limit = 50) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export const fetchActivity = async (activityId) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single()
  if (error) throw error
  return data
}

export const logActivity = async (organizationId, userId, activityData) => {
  const { data, error } = await supabase
    .from('activities')
    .insert([{ organization_id: organizationId, created_by: userId, ...activityData, created_at: new Date().toISOString() }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateActivity = async (activityId, activityData) => {
  const { data, error } = await supabase
    .from('activities')
    .update(activityData)
    .eq('id', activityId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteActivity = async (activityId) => {
  const { error } = await supabase.from('activities').delete().eq('id', activityId)
  if (error) throw error
}

export const recordActivityParticipants = async (activityId, memberIds) => {
  const participants = memberIds.map(memberId => ({
    activity_id: activityId,
    member_id: memberId,
    role: 'participant',
    created_at: new Date().toISOString()
  }))

  const { data, error } = await supabase
    .from('activity_participants')
    .insert(participants)
    .select()
  if (error) throw error
  return data
}

export const fetchActivitiesByType = async (organizationId, activityType, startDate, endDate) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('activity_type', activityType)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export const getMonthlyActivitySummary = async (organizationId) => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const startDate = firstDay.toISOString().split('T')[0]
  const endDate = lastDay.toISOString().split('T')[0]

  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  const summary = {
    total_activities: activities.length,
    people_reached: activities.reduce((sum, a) => sum + (a.people_reached || 0), 0),
    pregnancies_identified: activities.reduce((sum, a) => sum + (a.pregnancies_identified || 0), 0),
    contraceptives_distributed: activities.reduce((sum, a) => sum + (a.contraceptives_distributed || 0), 0),
    by_type: {}
  }

  activities.forEach(activity => {
    const type = activity.activity_type
    if (!summary.by_type[type]) {
      summary.by_type[type] = { count: 0, people_reached: 0 }
    }
    summary.by_type[type].count += 1
    summary.by_type[type].people_reached += activity.people_reached || 0
  })

  return summary
}

export const fetchActivitiesByLocation = async (organizationId, location) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('location', location)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export const fetchLocations = async (organizationId) => {
  const { data, error } = await supabase
    .from('activities')
    .select('location')
    .eq('organization_id', organizationId)
    .not('location', 'is', null)

  if (error) throw error

  const uniqueLocations = [...new Set(data.map(a => a.location))]
  return uniqueLocations.sort()
}
