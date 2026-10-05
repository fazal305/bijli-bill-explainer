import { useEffect, useState } from 'react'

export function current() {
  if (typeof window === 'undefined') return 'home'
  return window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home'
}

// Hash routes keep GitHub Pages happy (no server rewrites) and let the
// phone's own back button leave a screen.
export function useHashRoute() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function href(route) {
  return route === 'home' ? '#/' : `#/${route}`
}
