import { useState, useEffect, useCallback, useRef } from 'react'
import api, { extractError } from '../utils/api.js'

/**
 * useQuery — lightweight data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useQuery('/attendance/today')
 *   const { data, loading, error, refetch } = useQuery('/employees', { params: { limit: 50 } }, [dept])
 *
 * @param {string} url          API endpoint (relative to /api/v1)
 * @param {object} axiosConfig  Optional axios request config (params, headers, etc.)
 * @param {array}  deps         Dependency array – refetch when these change
 */
export default function useQuery(url, axiosConfig = {}, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res } = await api.get(url, axiosConfig)
      if (mountedRef.current) setData(res)
    } catch (e) {
      if (mountedRef.current) setError(extractError(e, 'Failed to load data'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => { mountedRef.current = false }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
