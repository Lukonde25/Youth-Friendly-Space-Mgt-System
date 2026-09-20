import { supabase } from './supabaseClient'

export const getDashboardData = async (organizationId) => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const startDate = firstDay.toISOString().split('T')[0]
  const endDate = lastDay.toISOString().split('T')[0]

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)

  const { data: members } = await supabase
    .from('members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('active', true)

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)

  const { data: invitations } = await supabase
    .from('event_invitations')
    .select('status')
    .eq('status', 'attended')

  const dashboard = {
    month: today.toLocaleString('default', { month: 'long', year: 'numeric' }),
    people_reached: activities?.reduce((sum, a) => sum + (a.people_reached || 0), 0) || 0,
    clinic_visits: activities?.filter(a => a.activity_type === 'clinic_visit').length || 0,
    pregnancies_identified: activities?.reduce((sum, a) => sum + (a.pregnancies_identified || 0), 0) || 0,
    contraceptives_distributed: activities?.reduce((sum, a) => sum + (a.contraceptives_distributed || 0), 0) || 0,
    active_members: members?.length || 0,
    events_count: events?.length || 0,
    event_attendance: invitations?.length || 0,
    total_activities: activities?.length || 0,
    recent_activities: activities?.slice(0, 5) || [],
    by_activity_type: getActivityBreakdown(activities)
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
