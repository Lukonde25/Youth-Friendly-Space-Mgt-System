import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { MainLayout } from './components'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MembersPage from './pages/MembersPage'
import EventsPage from './pages/EventsPage'
import ActivitiesPage from './pages/ActivitiesPage'

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [organizationId, setOrganizationId] = useState(null)

  useEffect(() => {
    if (user) {
      setOrganizationId(user.id.slice(0, 8))
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-secondary">Loading Youth Health System...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const navItems = [
    { 
      label: '📊 Dashboard', 
      href: '#', 
      active: currentPage === 'dashboard',
      onClick: () => setCurrentPage('dashboard')
    },
    { 
      label: '👥 Members', 
      href: '#', 
      active: currentPage === 'members',
      onClick: () => setCurrentPage('members')
    },
    { 
      label: '📅 Events', 
      href: '#', 
      active: currentPage === 'events',
      onClick: () => setCurrentPage('events')
    },
    { 
      label: '📝 Activities', 
      href: '#', 
      active: currentPage === 'activities',
      onClick: () => setCurrentPage('activities')
    }
  ]

  const pageConfig = {
    dashboard: { title: 'Dashboard', subtitle: 'Welcome back! Here\'s your impact this month', icon: '📊' },
    members: { title: 'Members', subtitle: 'Manage your organization\'s members', icon: '👥' },
    events: { title: 'Events', subtitle: 'Create and manage events', icon: '📅' },
    activities: { title: 'Activities', subtitle: 'Log outreach activities and health services', icon: '📝' }
  }

  const config = pageConfig[currentPage]

  const renderPage = () => {
    if (!organizationId) return null
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage organizationId={organizationId} />
      case 'members':
        return <MembersPage organizationId={organizationId} />
      case 'events':
        return <EventsPage organizationId={organizationId} />
      case 'activities':
        return <ActivitiesPage organizationId={organizationId} />
      default:
        return <DashboardPage organizationId={organizationId} />
    }
  }

  return (
    <MainLayout
      title={`${config.icon} ${config.title}`}
      subtitle={config.subtitle}
      navItems={navItems}
      user={{ name: user.email?.split('@')[0] || 'User', role: 'Admin' }}
      onLogout={handleLogout}
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
