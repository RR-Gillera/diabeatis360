import { useEffect, useState } from 'react'

import { subscribeToCollection, subscribeToCount, subscribeToQuery } from '../services/collections'

/** Live list of every document in a collection: { data, loading, error }. Fine at capstone scale. */
export function useCollection(name) {
  const [state, setState] = useState({ data: [], loading: true, error: '' })
  useEffect(
    () => subscribeToCollection(
      name,
      (data) => setState({ data, loading: false, error: '' }),
      (error) => setState({ data: [], loading: false, error: error.message }),
    ),
    [name],
  )
  return state
}

/** Live count of documents where `field == value` — for sidebar/tab badges. Returns a plain number. */
export function useFilteredCount(name, field, value) {
  const [count, setCount] = useState(0)
  useEffect(() => subscribeToCount(name, field, value, setCount, () => setCount(0)), [name, field, value])
  return count
}

/**
 * Live list of documents where `field == value`, e.g. one patient's Glucose_Logs in the Users drawer.
 * Pass `value` as null/undefined (drawer closed) to skip subscribing entirely.
 */
export function useFilteredCollection(name, field, value) {
  const [state, setState] = useState({ data: [], loading: Boolean(value), error: '' })
  useEffect(() => {
    if (!value) return undefined
    return subscribeToQuery(
      name, field, value,
      (data) => setState({ data, loading: false, error: '' }),
      (error) => setState({ data: [], loading: false, error: error.message }),
    )
  }, [name, field, value])
  return value ? state : { data: [], loading: false, error: '' }
}
