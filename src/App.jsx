import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { MainLayout } from './components'
import { supabase } from './services/supabaseClient'
import LoginPage from './pages/LoginPage'
import useTheme from './hooks/useTheme'
import DashboardPage from './pages/DashboardPage'
import MembersPage from './pages/MembersPage'
import EventsPage from './pages/EventsPage'
import ActivitiesPage from './pages/ActivitiesPage'
import PostsPage from './pages/PostsPage'
import MemberRequestsPage from './pages/MemberRequestsPage'
import MemberPortalPage from './pages/MemberPortalPage'

export default function App() {
  const { user, loading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [organizationError, setOrganizationError] = useState(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      setOrganizationError(null)
      return
    }

    let isMounted = true
    setProfileLoading(true)
    setOrganizationError(null)

    const fetchProfile = async () => {
      try {
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('organization_id, account_type, app_role, approval_status, full_name, phone, age, member_id')
          .eq('id', user.id)
          .maybeSingle()

        if (error) throw error
        if (!userProfile?.organization_id) {
          throw new Error('Your account is not linked to a friendly space yet.')
        }

        const { data: organization, error: organizationLookupError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', userProfile.organization_id)
          .maybeSingle()

        if (organizationLookupError) throw organizationLookupError
        if (!organization) throw new Error('The friendly space linked to your account could not be found.')

        if (isMounted) {
          setProfile({
            ...userProfile,
            organizationName: organization.name
          })
        }
      } catch (error) {
        console.error('Failed to load profile for current user:', error)
        if (isMounted) {
          setOrganizationError(error.message || 'We could not load your friendly space.')
        }
      } finally {
        if (isMounted) setProfileLoading(false)
      }
    }

    fetchProfile()
    return () => {
      isMounted = false
    }
  }, [user])

  if (!user) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} />
  }

  if (loading || profileLoading) {
    return (
      <div className="flex-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-secondary">Loading Youth Health System...</p>
        </div>
      </div>
    )
  }

  if (organizationError || !profile) {
    return (
      <div className="flex-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-primary mb-3">Account setup incomplete</h1>
          <p className="text-secondary mb-4">
            {organizationError || 'Your account profile could not be loaded.'}
          </p>
          <button type="button" onClick={handleLogout} className="text-primary hover:underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (profile.approval_status === 'pending') {
    return (
      <div className="flex-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-primary mb-3">Request awaiting approval</h1>
          <p className="text-secondary mb-5">
            Your request to join {profile.organizationName} is with the centre coordinator.
            You’ll be able to access member features after approval.
          </p>
          <button type="button" onClick={handleLogout} className="text-primary hover:underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (profile.approval_status === 'rejected' || profile.approval_status === 'suspended') {
    return (
      <div className="flex-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg text-center">
          <div className="text-4xl mb-4">ℹ️</div>
          <h1 className="text-xl font-bold text-primary mb-3">
            {profile.approval_status === 'suspended' ? 'Membership inactive' : 'Request not approved'}
          </h1>
          <p className="text-secondary mb-5">
            {profile.approval_status === 'suspended'
              ? `Your membership at ${profile.organizationName} is inactive. Contact the centre coordinator for help.`
              : `Your request to join ${profile.organizationName} was not approved. Contact the centre coordinator for help.`}
          </p>
          <button type="button" onClick={handleLogout} className="text-primary hover:underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = profile.app_role === 'center_admin'
  const isMember = profile.app_role === 'member' || profile.app_role === 'general_user'
  if (!isAdmin && !isMember) {
    return (
      <div className="flex-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-xl font-bold text-primary mb-3">Account role unavailable</h1>
          <p className="text-secondary mb-5">Contact your friendly space coordinator to check your account setup.</p>
          <button type="button" onClick={handleLogout} className="text-primary hover:underline">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const navItems = isAdmin
    ? [
        { label: '📊 Dashboard', href: '#', active: currentPage === 'dashboard', onClick: () => setCurrentPage('dashboard') },
        { label: '👥 Members', href: '#', active: currentPage === 'members', onClick: () => setCurrentPage('members') },
        { label: '📅 Events', href: '#', active: currentPage === 'events', onClick: () => setCurrentPage('events') },
        { label: '📝 Activities', href: '#', active: currentPage === 'activities', onClick: () => setCurrentPage('activities') },
        { label: '📣 Centre News', href: '#', active: currentPage === 'posts', onClick: () => setCurrentPage('posts') },
        { label: '🙋 Join Requests', href: '#', active: currentPage === 'requests', onClick: () => setCurrentPage('requests') }
      ]
    : [
        { label: '⌂ Overview', href: '#', active: currentPage === 'feed' || currentPage === 'dashboard', onClick: () => setCurrentPage('feed') },
        { label: '▣ Events', href: '#', active: currentPage === 'member-events', onClick: () => setCurrentPage('member-events') },
        { label: '◷ Activities', href: '#', active: currentPage === 'member-activities', onClick: () => setCurrentPage('member-activities') },
        { label: '● Profile', href: '#', active: currentPage === 'member-profile', onClick: () => setCurrentPage('member-profile') }
      ]

  const pageConfig = {
    dashboard: { title: 'Dashboard', subtitle: 'Your friendly space impact at a glance' },
    members: { title: 'Members', subtitle: 'Manage your friendly space members' },
    events: { title: 'Events', subtitle: 'Create and manage events' },
    activities: { title: 'Activities', subtitle: 'Log outreach activities and health services' },
    posts: { title: 'Centre News', subtitle: 'Share updates with your friendly space' },
    requests: { title: 'Join Requests', subtitle: 'Approve new members to your friendly space' },
    feed: { title: 'Overview', subtitle: profile.organizationName }
  }

  const renderPage = () => {
    if (isMember) {
      return (
        <MemberPortalPage
          profile={profile}
          user={user}
          onMembershipChangeRequested={(organization) => {
            setProfile((currentProfile) => ({
              ...currentProfile,
              organization_id: organization.id,
              organizationName: organization.name,
              approval_status: 'pending',
              member_id: null
            }))
          }}
          activeTab={{
            feed: 'Overview',
            'member-events': 'Events',
            'member-activities': 'Activities',
            'member-profile': 'Profile'
          }[currentPage] || 'Overview'}
        />
      )
    }

    switch (currentPage) {
      case 'members':
        return <MembersPage organizationId={profile.organization_id} />
      case 'events':
        return <EventsPage organizationId={profile.organization_id} userId={user.id} />
      case 'activities':
        return <ActivitiesPage organizationId={profile.organization_id} userId={user.id} />
      case 'posts':
        return <PostsPage organizationId={profile.organization_id} userId={user.id} />
      case 'requests':
        return <MemberRequestsPage organizationId={profile.organization_id} />
      case 'dashboard':
      default:
        return <DashboardPage organizationId={profile.organization_id} />
    }
  }

  const config = pageConfig[isAdmin ? currentPage : 'feed']

  return (
    <MainLayout
      title={config.title}
      subtitle={config.subtitle}
      navItems={navItems}
      user={{
        name: user.email?.split('@')[0] || 'User',
        role: isAdmin ? 'Centre Admin' : 'Member'
      }}
      onLogout={handleLogout}
      showNavigation
      showMobileNavigation
      showMobileGreeting={isAdmin}
      showPageHeading={!isAdmin || currentPage !== 'dashboard'}
      theme={theme}
      onToggleTheme={toggleTheme}
      notificationUserId={isAdmin ? user.id : null}
      notificationOrganizationId={isAdmin ? profile.organization_id : null}
      onOpenMembershipRequests={() => setCurrentPage('requests')}
    >
      {renderPage()}
    </MainLayout>
  )

  function handleLogout() {
    signOut().catch(err => {
      console.error('Logout error:', err)
      window.location.reload()
    })
  }
}
