import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Restores scroll position on navigation. When the URL contains a hash
 * (e.g. /#parent-portal) it scrolls to that element instead.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const element = document.querySelector(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])

  return null
}
