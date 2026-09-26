/**
 * useAuth Hook
 * 
 * Manages authentication state and provides auth methods
 * 
 * Usage:
 * const { user, loading, signIn, signOut } = useAuth()
 */

import { useEffect, useState } from 'react'
import { onAuthStateChange, signOut as supabaseSignOut } from '../services/supabaseClient'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!onAuthStateChange) {
      setLoading(false)
      return
    }

    // Set up auth listener
    const { data: { subscription } = {} } = onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      setError(null)
      await supabaseSignOut()
      setUser(null)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signOut: handleSignOut
  }
}

export default useAuth
