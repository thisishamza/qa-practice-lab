import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Manual scroll restoration plus route focus management.
 *
 * BrowserRouter does not include a scroll restoration component, so the shell
 * records the scroll position for each history entry and restores it on POP.
 * New entries start at the top. After a pathname change, focus moves to the
 * page heading so keyboard and screen-reader users land in the new content.
 */
export function useRouteManagement() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const previousKey = useRef(location.key)
  const previousPathname = useRef(location.pathname)
  const scrollPositions = useRef(new Map<string, number>())
  const lastScroll = useRef(0)
  const hasMounted = useRef(false)

  useEffect(() => {
    function handleScroll() {
      lastScroll.current = window.scrollY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useLayoutEffect(() => {
    // Read from the scroll listener rather than window.scrollY: by the time
    // this runs, a shorter destination page may already have clamped the old
    // scroll offset.
    scrollPositions.current.set(previousKey.current, lastScroll.current)
    previousKey.current = location.key

    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    const target =
      navigationType === 'POP'
        ? scrollPositions.current.get(location.key) ?? 0
        : 0

    window.scrollTo({ top: target, left: 0, behavior: 'instant' })
    lastScroll.current = target
  }, [location.key, navigationType])

  useEffect(() => {
    if (previousPathname.current === location.pathname) {
      return
    }

    previousPathname.current = location.pathname

    const main = document.getElementById('main-content')
    const heading = main?.querySelector('h1')

    if (!heading) {
      main?.focus({ preventScroll: true })
      return
    }

    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) {
      return
    }

    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])
}
