import { supabase } from './supabaseClient'

export const getDashboardData = async (organizationId) => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  const startDate = firstDay.toISOString().split('T')[0]
  const trendStartDate = trendStart.toISOString().split('T')[0]
  const todayDate = today.toISOString().split('T')[0]

  const [activityResult, memberResult, eventResult, upcomingResult] = await Promise.all([
    supabase
      .from('activities')
      .select('id, activity_type, date, location, created_by, people_reached, pregnancies_identified, contraceptives_distributed, screenings_done, health_talks_given')
      .eq('organization_id', organizationId)
      .gte('date', trendStartDate)
      .order('date', { ascending: false }),
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('events')
      .select('id, name, date, status')
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .lte('date', todayDate),
    supabase
      .from('events')
      .select('id, name, date, location, description, event_type')
      .eq('organization_id', organizationId)
      .eq('status', 'scheduled')
      .gte('date', todayDate)
      .order('date', { ascending: true })
      .limit(5)
  ])

  for (const result of [activityResult, memberResult, eventResult, upcomingResult]) {
    if (result.error) throw result.error
  }

  const activities = activityResult.data || []
  const thisMonthActivities = activities.filter((activity) => activity.date >= startDate)
  const eventIds = (eventResult.data || []).map((event) => event.id)
  let invitations = []
  if (eventIds.length) {
    const { data, error } = await supabase
      .from('event_invitations')
      .select('status')
      .in('event_id', eventIds)
      .eq('status', 'attended')
    if (error) throw error
    invitations = data || []
  }

  const monthlyActivityTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const monthActivities = activities.filter((activity) => activity.date.startsWith(key))
    return {
      month: monthDate.toLocaleString('default', { month: 'short' }),
      count: monthActivities.length,
      people_reached: monthActivities.reduce((sum, activity) => sum + (activity.people_reached || 0), 0)
    }
  })
  const locationReach = Object.values(thisMonthActivities.reduce((locations, activity) => {
    const location = activity.location?.trim() || 'Not specified'
    if (!locations[location]) locations[location] = { location, activities: 0, people_reached: 0 }
    locations[location].activities += 1
    locations[location].people_reached += activity.people_reached || 0
    return locations
  }, {})).sort((a, b) => b.people_reached - a.people_reached).slice(0, 5)

  const staffTotals = thisMonthActivities.reduce((staff, activity) => {
    if (!activity.created_by) return staff
    if (!staff[activity.created_by]) {
      staff[activity.created_by] = { user_id: activity.created_by, activities: 0, people_reached: 0 }
    }
    staff[activity.created_by].activities += 1
    staff[activity.created_by].people_reached += activity.people_reached || 0
    return staff
  }, {})
  const staffIds = Object.keys(staffTotals).filter((id) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ))
  let topStaff = Object.values(staffTotals).sort((a, b) => b.people_reached - a.people_reached).slice(0, 5)
  if (staffIds.length) {
    const { data: staffProfiles, error: staffError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', staffIds)
    if (staffError) throw staffError
    const profileById = Object.fromEntries((staffProfiles || []).map((profile) => [profile.id, profile]))
    topStaff = topStaff.map((staff) => ({
      ...staff,
      name: profileById[staff.user_id]?.full_name
        || profileById[staff.user_id]?.email
        || 'Coordinator'
    }))
  }
  topStaff = topStaff.map((staff) => ({
    ...staff,
    name: staff.name || 'Coordinator'
  }))

  const dashboard = {
    month: today.toLocaleString('default', { month: 'long', year: 'numeric' }),
    people_reached: thisMonthActivities.reduce((sum, activity) => sum + (activity.people_reached || 0), 0),
    clinic_visits: thisMonthActivities.filter((activity) => activity.activity_type === 'clinic_visit').length,
    pregnancies_identified: thisMonthActivities.reduce((sum, activity) => sum + (activity.pregnancies_identified || 0), 0),
    contraceptives_distributed: thisMonthActivities.reduce((sum, activity) => sum + (activity.contraceptives_distributed || 0), 0),
    screenings_done: thisMonthActivities.reduce((sum, activity) => sum + (activity.screenings_done || 0), 0),
    health_talks_given: thisMonthActivities.reduce((sum, activity) => sum + (activity.health_talks_given || 0), 0),
    active_members: memberResult.count || 0,
    events_count: (eventResult.data || []).length,
    event_attendance: invitations.length,
    total_activities: thisMonthActivities.length,
    recent_activities: thisMonthActivities.slice(0, 5),
    upcoming_events: upcomingResult.data || [],
    monthly_activity_trend: monthlyActivityTrend,
    location_reach: locationReach,
    top_staff: topStaff,
    by_activity_type: getActivityBreakdown(thisMonthActivities)
  }

  return dashboard
}

export const getMemberParticipationStats = async (organizationId) => {
  const { data: members } = await supabase
    .from('members')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('active', true)

  if (!members || members.length === 0) return []

  const stats = await Promise.all(
    members.map(async (member) => {
      const { count: eventCount } = await supabase
        .from('event_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .eq('status', 'attended')

      const { count: activityCount } = await supabase
        .from('activity_participants')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)

      return {
        member_id: member.id,
        name: member.name,
        events_attended: eventCount || 0,
        activities_participated: activityCount || 0,
        total_participation: (eventCount || 0) + (activityCount || 0)
      }
    })
  )

  return stats.sort((a, b) => b.total_participation - a.total_participation)
}

export const getEventAttendanceStats = async (organizationId) => {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, date')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
    .limit(10)

  if (!events || events.length === 0) return []

  const stats = await Promise.all(
    events.map(async (event) => {
      const { data: invitations } = await supabase
        .from('event_invitations')
        .select('status')
        .eq('event_id', event.id)

      const invited = invitations?.length || 0
      const confirmed = invitations?.filter(i => i.status === 'confirmed').length || 0
      const attended = invitations?.filter(i => i.status === 'attended').length || 0

      return {
        event_id: event.id,
        event_name: event.name,
        event_date: event.date,
        total_invited: invited,
        confirmed,
        attended,
        attendance_rate: invited > 0 ? ((attended / invited) * 100).toFixed(1) : 0
      }
    })
  )

  return stats
}

const getActivityBreakdown = (activities) => {
  if (!activities || activities.length === 0) return {}

  const breakdown = {}
  activities.forEach(activity => {
    const type = activity.activity_type
    if (!breakdown[type]) {
      breakdown[type] = { count: 0, people_reached: 0 }
    }
    breakdown[type].count += 1
    breakdown[type].people_reached += activity.people_reached || 0
  })

  return breakdown
}

export const getMonthlyComparison = async (organizationId) => {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const currentStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
  const currentEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]

  const prevStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
  const prevEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

  const { data: currentActivities } = await supabase
    .from('activities')
    .select('people_reached, pregnancies_identified')
    .eq('organization_id', organizationId)
    .gte('date', currentStart)
    .lte('date', currentEnd)

  const { data: prevActivities } = await supabase
    .from('activities')
    .select('people_reached, pregnancies_identified')
    .eq('organization_id', organizationId)
    .gte('date', prevStart)
    .lte('date', prevEnd)

  const currentPeople = currentActivities?.reduce((sum, a) => sum + (a.people_reached || 0), 0) || 0
  const prevPeople = prevActivities?.reduce((sum, a) => sum + (a.people_reached || 0), 0) || 0

  const currentPregnancies = currentActivities?.reduce((sum, a) => sum + (a.pregnancies_identified || 0), 0) || 0
  const prevPregnancies = prevActivities?.reduce((sum, a) => sum + (a.pregnancies_identified || 0), 0) || 0

  return {
    people_reached: {
      current: currentPeople,
      previous: prevPeople,
      change: prevPeople > 0 ? (((currentPeople - prevPeople) / prevPeople) * 100).toFixed(1) : 0
    },
    pregnancies: {
      current: currentPregnancies,
      previous: prevPregnancies,
      change: prevPregnancies > 0 ? (((currentPregnancies - prevPregnancies) / prevPregnancies) * 100).toFixed(1) : 0
    }
  }
}
