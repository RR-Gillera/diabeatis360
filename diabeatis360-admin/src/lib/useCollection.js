import { useEffect, useState } from 'react'

import { subscribeToCollection } from '../services/collections'

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
