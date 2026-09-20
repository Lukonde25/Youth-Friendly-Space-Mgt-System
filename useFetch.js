/**
 * useFetch Hook
 * 
 * Handles data fetching with loading and error states
 * 
 * Usage:
 * const { data, loading, error, refetch } = useFetch(
 *   () => supabase.from('members').select('*')
 * )
 */

import { useState, useEffect, useCallback } from 'react'

export const useFetch = (queryFn, dependencies = []) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: err } = await queryFn()
      
      if (err) throw err
      setData(result)
    } catch (err) {
      setError(err.message)
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [queryFn])

  useEffect(() => {
    fetchData()
  }, dependencies)

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

export default useFetch
