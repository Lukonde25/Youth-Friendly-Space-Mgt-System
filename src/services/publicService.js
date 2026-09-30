import { supabase } from './supabaseClient'

let lastGeocoderRequestAt = 0

const SPACE_FIELDS = 'id, name, is_public, description, address, city, province, latitude, longitude, phone_contact, email_contact, opening_hours, interest_tags'
const PUBLIC_EVENT_FIELDS = 'id, organization_id, name, date, location, description, event_type, status, is_public, created_at'

export async function fetchPublicSpaces() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('organizations')
    .select(SPACE_FIELDS)
    .eq('is_public', true)
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchPublicSpace(spaceId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('organizations')
    .select(SPACE_FIELDS)
    .eq('id', spaceId)
    .eq('is_public', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchSpaceProfileForAdmin(spaceId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('organizations')
    .select(SPACE_FIELDS)
    .eq('id', spaceId)
    .single()
  if (error) throw error
  return data
}

export async function fetchPublicPosts(organizationId, limit = 10) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('organization_posts')
    .select('id, organization_id, title, body, created_at')
    .eq('organization_id', organizationId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchPublicEvents(organizationId, limit = 10) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('events')
    .select(PUBLIC_EVENT_FIELDS)
    .eq('organization_id', organizationId)
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchPublicActivities(limit = 30) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('events')
    .select(PUBLIC_EVENT_FIELDS)
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .limit(limit)
  if (error) throw error
  const activities = data || []
  const organizationIds = [...new Set(activities.map((item) => item.organization_id))]
  if (!organizationIds.length) return []
  const { data: organizations, error: organizationsError } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', organizationIds)
  if (organizationsError) throw organizationsError
  const names = new Map((organizations || []).map((organization) => [organization.id, organization.name]))
  return activities.map((item) => ({ ...item, organization_name: names.get(item.organization_id) || 'Friendly space' }))
}

export async function fetchPublicEvent(eventId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('events')
    .select(PUBLIC_EVENT_FIELDS)
    .eq('id', eventId)
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updatePublicSpaceProfile(organizationId, updates) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', organizationId)
    .select('id, name, is_public, description, address, city, province, latitude, longitude, phone_contact, email_contact, opening_hours, interest_tags')
    .single()
  if (error) throw error
  return data
}

export async function setPostPublic(postId, isPublic) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('organization_posts')
    .update({ is_public: isPublic })
    .eq('id', postId)
  if (error) throw error
}

export async function setEventPublic(eventId, isPublic) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('events')
    .update({ is_public: isPublic })
    .eq('id', eventId)
  if (error) throw error
}

export async function searchMapLocations(query) {
  const providerUrl = window.YOUTH_HEALTH_GEOCODER_URL
    || import.meta.env.VITE_GEOCODER_URL
    || 'https://nominatim.openstreetmap.org/search'
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const cacheKey = `youth-health-location-search:${providerUrl}:${normalizedQuery}`
  try {
    const cached = JSON.parse(window.localStorage.getItem(cacheKey) || 'null')
    if (cached && Date.now() - cached.savedAt < 30 * 24 * 60 * 60 * 1000) return cached.results
  } catch {
    // Ignore unavailable or invalid local cache entries and run a fresh search.
  }

  const waitMs = Math.max(0, 1100 - (Date.now() - lastGeocoderRequestAt))
  if (waitMs) await new Promise((resolve) => window.setTimeout(resolve, waitMs))
  lastGeocoderRequestAt = Date.now()

  const url = new URL(providerUrl)
  url.search = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5'
  }).toString()

  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('The location search service is unavailable. Try again later or use your device location.')
  const results = await response.json()
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), results }))
  } catch {
    // The location picker still works when browser storage is unavailable.
  }
  return results
}
