import { useEffect, useState } from 'react'
import { Alert, Button, Card } from '../components'
import { fetchSpaceProfileForAdmin, searchMapLocations, updatePublicSpaceProfile } from '../services/publicService'

const emptyProfile = {
  is_public: true,
  description: '',
  address: '',
  city: '',
  province: '',
  latitude: '',
  longitude: '',
  phone_contact: '',
  email_contact: '',
  opening_hours: '',
  interest_tags: []
}

export default function PublicProfileSettingsPage({ organizationId }) {
  const [form, setForm] = useState(emptyProfile)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState([])
  const [locationSearching, setLocationSearching] = useState(false)
  const [locationLabel, setLocationLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    fetchSpaceProfileForAdmin(organizationId)
      .then((record) => {
        if (!active) return
        setName(record.name || '')
        setForm({ ...emptyProfile, ...record })
        setTags((record.interest_tags || []).join(', '))
        if (record.latitude != null && record.longitude != null) setLocationLabel('Saved map pin')
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [organizationId])

  const updateField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({
      ...current,
      [field]: value,
      ...( ['address', 'city', 'province'].includes(field) ? { latitude: '', longitude: '' } : {})
    }))
    if (['address', 'city', 'province'].includes(field)) {
      setLocationLabel('')
      setLocationSearchResults([])
    }
  }

  const findLocation = async (event) => {
    event.preventDefault()
    const query = [form.address, form.city, form.province].filter(Boolean).join(', ').trim()
    if (!query) {
      setError('Enter a street address, town, or province first.')
      return
    }

    setLocationSearching(true)
    setError(null)
    setLocationSearchResults([])
    try {
      const matches = await searchMapLocations(query)
      setLocationSearchResults(matches)
      if (!matches.length) setError('No matching places found. Try adding a town or province.')
    } catch (searchError) {
      setError(searchError.message || 'Could not search for that location.')
    } finally {
      setLocationSearching(false)
    }
  }

  const chooseLocation = (result) => {
    const addressParts = result.address || {}
    const street = [addressParts.house_number, addressParts.road].filter(Boolean).join(' ')
    const city = addressParts.city || addressParts.town || addressParts.village || addressParts.municipality
    const province = addressParts.state || addressParts.province || addressParts.county
    setForm((current) => ({
      ...current,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      ...(street ? { address: street } : {}),
      ...(city ? { city } : {}),
      ...(province ? { province } : {})
    }))
    setLocationLabel(result.display_name)
    setLocationSearchResults([])
    setError(null)
  }

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.')
      return
    }
    setError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude }))
        setLocationLabel('Your current device location')
      },
      () => setError('Could not get your location. Check browser location permission and try again.'),
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const hasCoordinates = form.latitude !== '' && form.latitude != null
        && form.longitude !== '' && form.longitude != null
      const updates = {
        is_public: form.is_public,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        latitude: hasCoordinates ? Number(form.latitude) : null,
        longitude: hasCoordinates ? Number(form.longitude) : null,
        phone_contact: form.phone_contact.trim() || null,
        email_contact: form.email_contact.trim() || null,
        opening_hours: form.opening_hours.trim() || null,
        interest_tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      }
      const updated = await updatePublicSpaceProfile(organizationId, updates)
      setForm({ ...emptyProfile, ...updated })
      setTags((updated.interest_tags || []).join(', '))
      setLocationLabel(updated.latitude != null && updated.longitude != null ? 'Saved map pin' : '')
      setNotice('Public profile saved.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-secondary">Loading public profile settings...</p>

  const hasCoordinates = form.latitude !== '' && form.latitude != null
    && form.longitude !== '' && form.longitude != null

  return (
    <div className="public-profile-settings space-y-6">
      <div><h2 className="text-2xl font-bold">Public profile</h2><p className="text-secondary">Choose what people can see when they discover {name}.</p></div>
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {notice && <Alert variant="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="public-visibility-toggle"><input type="checkbox" checked={Boolean(form.is_public)} onChange={updateField('is_public')} /><span><strong>Show this friendly space in public discovery</strong><small>Visitors can see the details below and any posts or events you mark public.</small></span></label>
          <label className="block"><span className="block mb-2 font-medium text-sm">About this space</span><textarea className="w-full p-3 border rounded" rows="4" maxLength="2000" value={form.description || ''} onChange={updateField('description')} placeholder="Describe the services and support offered." /></label>
          <div className="public-settings-grid">
            <label className="block"><span className="block mb-2 font-medium text-sm">Street address</span><input className="w-full p-3 border rounded" value={form.address || ''} onChange={updateField('address')} placeholder="Street, neighbourhood, or landmark" /></label>
            <label className="block"><span className="block mb-2 font-medium text-sm">Town or city</span><input className="w-full p-3 border rounded" value={form.city || ''} onChange={updateField('city')} /></label>
            <label className="block"><span className="block mb-2 font-medium text-sm">Province</span><input className="w-full p-3 border rounded" value={form.province || ''} onChange={updateField('province')} /></label>
            <label className="block"><span className="block mb-2 font-medium text-sm">Public phone</span><input className="w-full p-3 border rounded" type="tel" value={form.phone_contact || ''} onChange={updateField('phone_contact')} /></label>
            <label className="block"><span className="block mb-2 font-medium text-sm">Public email</span><input className="w-full p-3 border rounded" type="email" value={form.email_contact || ''} onChange={updateField('email_contact')} /></label>
            <label className="block"><span className="block mb-2 font-medium text-sm">Opening hours</span><input className="w-full p-3 border rounded" value={form.opening_hours || ''} onChange={updateField('opening_hours')} placeholder="e.g. Mon–Fri, 08:00–16:00" /></label>
          </div>
          <section className="public-location-picker" aria-labelledby="public-location-heading">
            <div><h3 id="public-location-heading">Pin your location</h3><p className="text-secondary">Search the address above or use your device while you are at the space. Coordinates are filled in automatically.</p></div>
            <div className="public-location-actions">
              <Button type="button" variant="secondary" loading={locationSearching} disabled={!form.address && !form.city && !form.province} onClick={findLocation}>Find address on map</Button>
              <Button type="button" variant="secondary" onClick={useDeviceLocation}>Use my current location</Button>
            </div>
            {locationLabel && <p className="public-location-selected" role="status"><strong>Selected location:</strong> {locationLabel}</p>}
            {hasCoordinates && (
              <a className="public-map-preview-link" href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=17/${form.latitude}/${form.longitude}`} target="_blank" rel="noreferrer">Check this pin on OpenStreetMap</a>
            )}
            {locationSearchResults.length > 0 && (
              <ul className="public-location-results" aria-label="Address search results">
                {locationSearchResults.map((result) => <li key={result.place_id}><button type="button" onClick={() => chooseLocation(result)}>{result.display_name}</button></li>)}
              </ul>
            )}
            <small className="public-map-attribution">Location lookup uses <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. The address is sent only when you choose “Find address on map”; don’t include personal or confidential information.</small>
          </section>
          <label className="block"><span className="block mb-2 font-medium text-sm">Interests or services</span><input className="w-full p-3 border rounded" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Health talks, counselling, sport" /><span className="block mt-2 text-sm text-secondary">Separate each item with a comma.</span></label>
          <Button type="submit" loading={saving}>Save public profile</Button>
        </form>
      </Card>
    </div>
  )
}
