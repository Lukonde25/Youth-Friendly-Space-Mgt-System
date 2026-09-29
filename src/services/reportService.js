import { supabase } from './supabaseClient'
import { fetchMeetings } from './meetingService'

export const getDashboardData = async (organizationId) => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1)
  const startDate = firstDay.toISOString().split('T')[0]
  const trendStartDate = trendStart.toISOString().split('T')[0]
  const todayDate = today.toISOString().split('T')[0]

  const [eventResult, memberResult, upcomingResult, meetingData] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, event_type, date, location, status, people_reached, pregnancies_identified, contraceptives_distributed, health_screenings, health_talks_held')
      .eq('organization_id', organizationId)
      .gte('date', trendStartDate)
      .lte('date', todayDate)
      .neq('status', 'cancelled')
      .order('date', { ascending: false }),
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('events')
      .select('id, name, date, location, description, event_type, status, cover_image_path')
      .eq('organization_id', organizationId)
      .eq('status', 'scheduled')
      .gte('date', todayDate)
      .order('date', { ascending: true })
      .limit(5),
    fetchMeetings(organizationId, { upcomingOnly: true })
  ])

  for (const result of [eventResult, memberResult, upcomingResult]) {
    if (result.error) throw result.error
  }

  const events = eventResult.data || []
  const thisMonthEvents = events.filter((event) => event.date >= startDate)
  const eventIds = thisMonthEvents.map((event) => event.id)
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

  const monthlyEventTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const monthEvents = events.filter((event) => event.date.startsWith(key))
    return {
      month: monthDate.toLocaleString('default', { month: 'short' }),
      count: monthEvents.length,
      people_reached: monthEvents.reduce((sum, event) => sum + (event.people_reached || 0), 0)
    }
  })
  const locationReach = Object.values(thisMonthEvents.reduce((locations, event) => {
    const location = event.location?.trim() || 'Not specified'
    if (!locations[location]) locations[location] = { location, events: 0, people_reached: 0 }
    locations[location].events += 1
    locations[location].people_reached += event.people_reached || 0
    return locations
  }, {})).sort((a, b) => b.people_reached - a.people_reached).slice(0, 5)

  return {
    month: today.toLocaleString('default', { month: 'long', year: 'numeric' }),
    people_reached: thisMonthEvents.reduce((sum, event) => sum + (event.people_reached || 0), 0),
    pregnancies_identified: thisMonthEvents.reduce((sum, event) => sum + (event.pregnancies_identified || 0), 0),
    contraceptives_distributed: thisMonthEvents.reduce((sum, event) => sum + (event.contraceptives_distributed || 0), 0),
    health_screenings: thisMonthEvents.reduce((sum, event) => sum + (event.health_screenings || 0), 0),
    health_talks_held: thisMonthEvents.reduce((sum, event) => sum + (event.health_talks_held || 0), 0),
    active_members: memberResult.count || 0,
    events_count: thisMonthEvents.length,
    event_attendance: invitations.length,
    upcoming_events: upcomingResult.data || [],
    upcoming_meetings: meetingData,
    monthly_event_trend: monthlyEventTrend,
    location_reach: locationReach,
    by_event_type: getEventBreakdown(thisMonthEvents),
    recent_events: thisMonthEvents.slice(0, 5)
  }
}

export const getMemberParticipationStats = async (organizationId) => {
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('active', true)
  if (membersError) throw membersError
  if (!members?.length) return []

  const stats = await Promise.all(members.map(async (member) => {
    const [eventResult, meetingResult] = await Promise.all([
      supabase
        .from('event_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .eq('status', 'attended'),
      supabase
        .from('meeting_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .eq('attended', true)
    ])
    if (eventResult.error) throw eventResult.error
    if (meetingResult.error) throw meetingResult.error
    const meetingsAttended = meetingResult.count || 0
    const eventsAttended = eventResult.count || 0
    return {
      member_id: member.id,
      name: member.name,
      events_attended: eventsAttended,
      meetings_attended: meetingsAttended,
      total_participation: eventsAttended + meetingsAttended
    }
  }))
  return stats.sort((a, b) => b.total_participation - a.total_participation)
}

export const getEventAttendanceStats = async (organizationId) => {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, name, date')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
    .limit(10)
  if (eventsError) throw eventsError
  if (!events?.length) return []

  return Promise.all(events.map(async (event) => {
    const { data: invitations, error } = await supabase
      .from('event_invitations')
      .select('status')
      .eq('event_id', event.id)
    if (error) throw error
    const invited = invitations?.length || 0
    const confirmed = invitations?.filter((item) => item.status === 'confirmed').length || 0
    const attended = invitations?.filter((item) => item.status === 'attended').length || 0
    return {
      event_id: event.id,
      event_name: event.name,
      event_date: event.date,
      total_invited: invited,
      confirmed,
      attended,
      attendance_rate: invited ? ((attended / invited) * 100).toFixed(1) : 0
    }
  }))
}

const getEventBreakdown = (events) => events.reduce((breakdown, event) => {
  const type = event.event_type || 'other'
  if (!breakdown[type]) breakdown[type] = { count: 0, people_reached: 0 }
  breakdown[type].count += 1
  breakdown[type].people_reached += event.people_reached || 0
  return breakdown
}, {})

export const getMonthlyComparison = async (organizationId) => {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const currentStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
  const currentEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
  const prevStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
  const prevEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
  const [currentResult, previousResult] = await Promise.all([
    supabase.from('events').select('people_reached, pregnancies_identified').eq('organization_id', organizationId).gte('date', currentStart).lte('date', currentEnd),
    supabase.from('events').select('people_reached, pregnancies_identified').eq('organization_id', organizationId).gte('date', prevStart).lte('date', prevEnd)
  ])
  if (currentResult.error) throw currentResult.error
  if (previousResult.error) throw previousResult.error
  const currentEvents = currentResult.data || []
  const previousEvents = previousResult.data || []
  const sum = (items, field) => items.reduce((total, event) => total + (event[field] || 0), 0)
  const currentPeople = sum(currentEvents, 'people_reached')
  const previousPeople = sum(previousEvents, 'people_reached')
  const currentPregnancies = sum(currentEvents, 'pregnancies_identified')
  const previousPregnancies = sum(previousEvents, 'pregnancies_identified')
  return {
    people_reached: {
      current: currentPeople,
      previous: previousPeople,
      change: previousPeople > 0 ? (((currentPeople - previousPeople) / previousPeople) * 100).toFixed(1) : 0
    },
    pregnancies: {
      current: currentPregnancies,
      previous: previousPregnancies,
      change: previousPregnancies > 0 ? (((currentPregnancies - previousPregnancies) / previousPregnancies) * 100).toFixed(1) : 0
    }
  }
}
