/**
 * Supabase Client Configuration
 *
 * This initializes the Supabase client for API calls.
 * Authentication is handled through Supabase Auth only.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY || ''
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasSupabaseConfig) {
  console.warn('Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // During local development, always begin with the login screen.
        persistSession: !import.meta.env.DEV
      }
    })
  : null

const ensureSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.')
  }

  return supabase
}

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const client = ensureSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

/**
 * Sign up new user
 */
export const fetchOrganizations = async () => {
  const client = ensureSupabaseClient()
  const { data, error } = await client
    .from('organizations')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Sign up as a centre administrator or as a personal account joining a centre.
 */
export const signUp = async (email, password, registration) => {
  const client = ensureSupabaseClient()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        account_type: registration.accountType,
        organization_name: registration.organizationName || null,
        organization_id: registration.organizationId || null,
        full_name: registration.fullName || null,
        phone: registration.phone || null,
        age: registration.age || null
      }
    }
  })

  if (error) throw error
  return data
}

/**
 * Sign in user
 */
export const signIn = async (email, password) => {
  const client = ensureSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

/**
 * Sign out user
 */
export const signOut = async () => {
  const client = ensureSupabaseClient()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

/**
 * Get user session
 */
export const getSession = async () => {
  const client = ensureSupabaseClient()
  const { data: { session } } = await client.auth.getSession()
  return session
}

/**
 * Listen to auth changes
 */
export const onAuthStateChange = (callback) => {
  return supabase ? supabase.auth.onAuthStateChange(callback) : {
    data: {
      subscription: {
        unsubscribe: () => {}
      }
    }
  }
}
