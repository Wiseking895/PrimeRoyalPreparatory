import { useEffect, useState } from 'react'
import { LogIn, Menu, UserRound, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { Logo } from '@/components/common/Logo'
import { NavDropdown } from '@/components/common/NavDropdown'
import { Button } from '@/components/ui/Button'
import { mainNav, mobileNav } from '@/data/nav'
import type { MainNavItem } from '@/data/nav'
import { cn } from '@/lib/cn'

function isItemActive(pathname: string, item: MainNavItem): boolean {
  if (item.path) {
    if (item.path === '/') return pathname === '/'
    return pathname === item.path || pathname.startsWith(`${item.path}/`)
  }
  if (item.dropdown) {
    return item.dropdown.some((child) => {
      const base = child.path.split('#')[0]
      return pathname === base || pathname.startsWith(`${base}/`)
    })
  }
  return false
}

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  const closeMenu = () => setOpen(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    closeMenu()
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-transparent bg-cream-100/90 backdrop-blur transition-shadow',
        scrolled && 'border-cream-300/70 shadow-[0_2px_20px_-8px_rgba(11,20,48,0.18)]',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-20">
        <NavLink to="/" className="shrink-0" aria-label="PRPS — go to homepage">
          <Logo taglineClassName="lg:tracking-[0.18em]" />
        </NavLink>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1.5 lg:flex xl:gap-4 2xl:gap-6">
          {mainNav.map((item) => {
            const active = isItemActive(pathname, item)
            if (item.dropdown) {
              return (
                <NavDropdown key={item.label} label={item.label} items={item.dropdown} isActive={active} />
              )
            }
            return (
              <NavLink
                key={item.label}
                to={item.path as string}
                className={cn(
                  'relative rounded-lg py-1 text-[13px] font-semibold transition-colors xl:text-sm',
                  active ? 'text-magenta-600' : 'text-ink-700 hover:text-magenta-600',
                )}
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-magenta-500 transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-3">
          <Button
            to="/staff/login"
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            ariaLabel="Open the Staff Login"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Staff Login
          </Button>
          <Button to="/#parent-portal" size="sm" className="whitespace-nowrap" ariaLabel="Open the Parent Portal">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Parent Portal
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-900 transition-colors hover:bg-cream-200 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile navigation */}
      <div
        id="mobile-navigation"
        className={cn(
          'fixed inset-0 z-50 overflow-y-auto lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'fixed inset-0 bg-royal-900/50 backdrop-blur-sm transition-opacity',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeMenu}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={cn(
            'absolute right-0 top-0 flex w-[min(20rem,85vw)] flex-col bg-cream-50 shadow-2xl transition-transform duration-300',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <Logo />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-900 transition-colors hover:bg-cream-200"
              onClick={closeMenu}
              aria-label="Close navigation menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Mobile navigation" className="px-5 py-5">
            <ul className="space-y-1.5">
              {mobileNav.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.path as string}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-xl px-4 py-3.5 text-base font-semibold transition-colors',
                        isActive
                          ? 'bg-magenta-500/10 text-magenta-600'
                          : 'text-ink-700 hover:bg-cream-200 hover:text-magenta-600',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-3 border-t border-cream-200 pt-5">
              <Button to="/staff/login" variant="outline" size="lg" className="w-full whitespace-nowrap">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Staff Login
              </Button>
              <Button to="/#parent-portal" size="lg" className="w-full whitespace-nowrap">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Parent Portal
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}