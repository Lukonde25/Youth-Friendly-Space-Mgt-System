import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card } from '../components'
import ThemeToggle from '../components/ThemeToggle'
import LoginPage from './LoginPage'
import {
  fetchPublicActivities,
  fetchPublicEvent,
  fetchPublicEvents,
  fetchPublicPosts,
  fetchPublicSpace,
  fetchPublicSpaces
} from '../services/publicService'

const readRoute = () => {
  const route = window.location.hash.replace(/^#\/?/, '')
  const [page = '', id = ''] = route.split('/').map(decodeURIComponent)
  return { page: page || 'home', id }
}

const distanceBetween = (a, b) => {
  const radians = (degrees) => degrees * Math.PI / 180
  const latDelta = radians(b.latitude - a.latitude)
  const lngDelta = radians(b.longitude - a.longitude)
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

const formatDate = (value) => new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: value?.includes('T') ? 'short' : undefined
})

function SpaceCard({ space }) {
  return (
    <Card className="public-space-card">
      <span className="public-eyebrow">Youth friendly space</span>
      <h2><a href={`#/space/${space.id}`}>{space.name}</a></h2>
      {(space.city || space.province) && <p className="text-secondary">{[space.city, space.province].filter(Boolean).join(', ')}</p>}
      {space.description && <p>{space.description}</p>}
      {space.interest_tags?.length > 0 && (
        <div className="public-tag-list">
          {space.interest_tags.map((tag) => <a key={tag} href={`#/interest/${encodeURIComponent(tag)}`}>{tag}</a>)}
        </div>
      )}
      <a className="public-text-link" href={`#/space/${space.id}`}>View space <span aria-hidden="true">→</span></a>
    </Card>
  )
}

function PublicContentCard({ item, type }) {
  const isEvent = type === 'event'
  return (
    <Card className="public-content-card">
      <span className="public-eyebrow">{isEvent ? item.event_type?.replaceAll('_', ' ') || 'Event' : 'Centre news'}</span>
      <h3>{isEvent ? <a href={`#/activity/${item.id}`}>{item.name}</a> : item.title}</h3>
      <p className="text-secondary">{isEvent ? formatDate(item.date) : formatDate(item.created_at)}</p>
      {isEvent && item.organization_name && <p className="text-secondary">{item.organization_name}</p>}
      {item.description || item.body ? <p>{item.description || item.body}</p> : null}
      {isEvent && item.location && <p className="text-secondary">{item.location}</p>}
      {isEvent && <a className="public-text-link" href={`#/activity/${item.id}`}>Event details <span aria-hidden="true">→</span></a>}
    </Card>
  )
}

export default function PublicPortal({ theme, onToggleTheme }) {
  const [route, setRoute] = useState(readRoute)
  const [spaces, setSpaces] = useState([])
  const [space, setSpace] = useState(null)
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [activities, setActivities] = useState([])
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState(null)
  const [locationError, setLocationError] = useState(null)

  useEffect(() => {
    const handleRoute = () => setRoute(readRoute())
    window.addEventListener('hashchange', handleRoute)
    return () => window.removeEventListener('hashchange', handleRoute)
  }, [])

  useEffect(() => {
    let current = true
    setLoading(true)
    setError(null)
    setSpace(null)
    setPosts([])
    setEvents([])
    setActivities([])
    setEvent(null)

    const load = async () => {
      try {
        if (route.page === 'login') return
        if (route.page === 'space' && route.id) {
          const [spaceRecord, publicPosts, publicEvents] = await Promise.all([
            fetchPublicSpace(route.id), fetchPublicPosts(route.id), fetchPublicEvents(route.id)
          ])
          if (!spaceRecord) throw new Error('This friendly space is unavailable or has not published a public profile.')
          if (current) {
            setSpace(spaceRecord)
            setPosts(publicPosts)
            setEvents(publicEvents)
          }
          return
        }
        if (route.page === 'activity' && route.id) {
          const record = await fetchPublicEvent(route.id)
          if (!record) throw new Error('This event is unavailable or is not public.')
          const spaceRecord = await fetchPublicSpace(record.organization_id)
          if (current) {
            setEvent(record)
            setSpace(spaceRecord)
          }
          return
        }
        if (route.page === 'activities') {
          const data = await fetchPublicActivities()
          if (current) setActivities(data)
          return
        }
        if (route.page === 'home') {
          const [spaceData, activityData] = await Promise.all([
            fetchPublicSpaces(),
            fetchPublicActivities(6)
          ])
          if (current) {
            setSpaces(spaceData)
            setActivities(activityData)
          }
          return
        }
        const data = await fetchPublicSpaces()
        if (current) setSpaces(data)
      } catch (loadError) {
        if (current) setError(loadError.message || 'Could not load public information.')
      } finally {
        if (current) setLoading(false)
      }
    }
    load()
    return () => { current = false }
  }, [route.page, route.id])

  const visibleSpaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    let results = spaces
    if (route.page === 'interest') {
      results = results.filter((item) => item.interest_tags?.some((tag) => tag.toLocaleLowerCase() === route.id.toLocaleLowerCase()))
    }
    if (query) {
      results = results.filter((item) => [item.name, item.description, item.city, item.province, ...(item.interest_tags || [])]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
    }
    if (route.page === 'nearby' && position) {
      results = results
        .filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
        .map((item) => ({ ...item, distance: distanceBetween(position, { latitude: Number(item.latitude), longitude: Number(item.longitude) }) }))
        .sort((a, b) => a.distance - b.distance)
    }
    return results
  }, [spaces, route.page, route.id, search, position])

  const getPosition = () => {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setLocationError('Location permission was not granted. You can browse all spaces instead.'),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  if (route.page === 'login') return <LoginPage theme={theme} onToggleTheme={onToggleTheme} />

  const interestTags = [...new Set(spaces.flatMap((item) => item.interest_tags || []))].sort()
  const isSpacesView = ['spaces', 'nearby', 'interest'].includes(route.page)
  const pageTitle = route.page === 'nearby'
    ? 'Friendly spaces near you'
    : route.page === 'interest'
      ? `Spaces for ${route.id}`
      : 'Find a youth friendly space'

  return (
    <div className="public-portal">
      <header className="public-header">
        <a className="public-brand" href="#/" aria-label="Youth Health home">
          <span className="public-brand-mark">YH</span><span>Youth Health</span>
        </a>
        <nav aria-label="Public navigation">
          <a href="#/spaces">Find spaces</a>
          <a href="#/activities">Activities</a>
          <a href="#/nearby">Near me</a>
          <a className="public-sign-in" href="#/login">Sign in</a>
        </nav>
        {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
      </header>

      <main className="public-main">
        {error && <Alert variant="error">{error}</Alert>}

        {route.page === 'home' && (
          <>
            <section className="public-hero">
              <span className="public-eyebrow">See what is happening in your community</span>
              <h1>Discover activities for young people.</h1>
              <p>Explore upcoming activities and opportunities shared by local youth friendly spaces.</p>
              <div className="public-hero-actions">
                <Button type="button" onClick={() => { window.location.hash = '#/activities' }}>Browse activities</Button>
                <a className="public-hero-secondary" href="#/spaces">Find a space</a>
                <a className="public-hero-secondary" href="#/nearby">Find spaces near me</a>
              </div>
            </section>
            <section className="public-section">
              <div className="public-section-heading"><div><span className="public-eyebrow">Coming up</span><h2>Activities in your community</h2></div><a href="#/activities">View all activities →</a></div>
              {loading ? <p className="text-secondary">Loading activities...</p> : activities.length ? (
                <div className="public-activity-grid">{activities.map((item) => <PublicContentCard key={item.id} item={item} type="event" />)}</div>
              ) : <Card><p className="text-secondary">No public activities have been announced yet.</p></Card>}
            </section>
            <section className="public-section">
              <div className="public-section-heading"><div><span className="public-eyebrow">Discover</span><h2>Explore friendly spaces</h2></div><a href="#/spaces">View all spaces →</a></div>
              {loading ? <p className="text-secondary">Loading spaces...</p> : visibleSpaces.length ? (
                <div className="public-space-grid">{visibleSpaces.slice(0, 6).map((item) => <SpaceCard key={item.id} space={item} />)}</div>
              ) : <Card><p className="text-secondary">No public friendly spaces are listed yet.</p></Card>}
            </section>
            {!!interestTags.length && <section className="public-section"><h2>Browse by interest</h2><div className="public-tag-list">{interestTags.map((tag) => <a key={tag} href={`#/interest/${encodeURIComponent(tag)}`}>{tag}</a>)}</div></section>}
          </>
        )}

        {isSpacesView && (
          <section className="public-section">
            <span className="public-eyebrow">Explore your community</span>
            <h1>{pageTitle}</h1>
            <p className="text-secondary">Browse public profiles and find the right space for you.</p>
            <div className="public-directory-tools">
              <label><span className="sr-only">Search friendly spaces</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, place, or interest" /></label>
              {route.page === 'nearby' && <Button type="button" variant="secondary" onClick={getPosition}>{position ? 'Refresh my location' : 'Use my location'}</Button>}
            </div>
            {locationError && <p className="public-location-error" role="status">{locationError}</p>}
            {route.page === 'nearby' && position && <p className="text-secondary">Showing spaces with a published location, nearest first.</p>}
            {loading ? <p className="text-secondary">Loading spaces...</p> : visibleSpaces.length ? (
              <div className="public-space-grid">{visibleSpaces.map((item) => (
                <div key={item.id} className="public-space-result">
                  <SpaceCard space={item} />
                  {Number.isFinite(item.distance) && <span className="public-distance">{item.distance.toFixed(1)} km away</span>}
                </div>
              ))}</div>
            ) : <Card><p className="text-secondary">{route.page === 'nearby' && !position ? 'Choose “Use my location” to sort spaces by distance, or browse all spaces.' : 'No spaces match your search yet.'}</p></Card>}
          </section>
        )}

        {route.page === 'activities' && (
          <section className="public-section">
            <span className="public-eyebrow">What’s happening</span>
            <h1>Public activities</h1>
            <p className="text-secondary">Upcoming activities shared by public friendly spaces.</p>
            {loading ? <p className="text-secondary">Loading activities...</p> : activities.length ? (
              <div className="public-activity-grid">{activities.map((item) => <PublicContentCard key={item.id} item={item} type="event" />)}</div>
            ) : <Card><p className="text-secondary">No public activities have been announced yet.</p></Card>}
          </section>
        )}

        {route.page === 'space' && (
          <section className="public-section">
            {loading ? <p className="text-secondary">Loading space...</p> : space && <>
              <a className="public-back-link" href="#/spaces">← All spaces</a>
              <div className="public-space-profile">
                <span className="public-eyebrow">Youth friendly space</span>
                <h1>{space.name}</h1>
                {space.description && <p className="public-profile-description">{space.description}</p>}
                <dl className="public-profile-details">
                  {(space.address || space.city || space.province) && <div><dt>Location</dt><dd>{[space.address, space.city, space.province].filter(Boolean).join(', ')}</dd></div>}
                  {space.phone_contact && <div><dt>Phone</dt><dd><a href={`tel:${space.phone_contact}`}>{space.phone_contact}</a></dd></div>}
                  {space.email_contact && <div><dt>Email</dt><dd><a href={`mailto:${space.email_contact}`}>{space.email_contact}</a></dd></div>}
                  {space.opening_hours && <div><dt>Opening hours</dt><dd>{space.opening_hours}</dd></div>}
                </dl>
                {space.latitude != null && space.longitude != null && (
                  <a className="public-map-preview-link" href={`https://www.openstreetmap.org/?mlat=${space.latitude}&mlon=${space.longitude}#map=16/${space.latitude}/${space.longitude}`} target="_blank" rel="noreferrer">View location on OpenStreetMap</a>
                )}
                {space.interest_tags?.length > 0 && <div className="public-tag-list">{space.interest_tags.map((tag) => <a key={tag} href={`#/interest/${encodeURIComponent(tag)}`}>{tag}</a>)}</div>}
                <a className="public-join-link" href="#/login">Sign in or create an account to request membership</a>
              </div>
              <div className="public-profile-columns">
                <section><h2>Upcoming activities</h2>{events.length ? <div className="public-card-list">{events.map((item) => <PublicContentCard key={item.id} item={item} type="event" />)}</div> : <Card><p className="text-secondary">No public activities at this time.</p></Card>}</section>
                <section><h2>Centre updates</h2>{posts.length ? <div className="public-card-list">{posts.map((item) => <PublicContentCard key={item.id} item={item} type="post" />)}</div> : <Card><p className="text-secondary">No public updates yet.</p></Card>}</section>
              </div>
            </>}
          </section>
        )}

        {route.page === 'activity' && (
          <section className="public-section">
            {loading ? <p className="text-secondary">Loading activity...</p> : event && <Card className="public-activity-detail">
              <a className="public-back-link" href={`#/space/${space?.id}`}>← {space?.name || 'Friendly space'}</a>
              <span className="public-eyebrow">{event.event_type?.replaceAll('_', ' ') || 'Activity'}</span>
              <h1>{event.name}</h1><p className="text-secondary">{formatDate(event.date)}</p>
              {event.location && <p><strong>Location:</strong> {event.location}</p>}
              {event.description && <p>{event.description}</p>}
              {space && <a className="public-text-link" href={`#/space/${space.id}`}>Visit {space.name} →</a>}
            </Card>}
          </section>
        )}
      </main>

      <footer className="public-footer"><span>Youth Health System</span><span>Explore local support and opportunities for young people.</span><a href="#/login">Centre sign in</a></footer>
    </div>
  )
}
