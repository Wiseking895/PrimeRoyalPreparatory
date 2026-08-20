import { useEffect, useState } from 'react'
import { Eye, LayoutDashboard, LogOut, Menu, UserRound, Users, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useParentAuth } from '@/auth/ParentAuthContext'
import { Logo } from '@/components/common/Logo'
import { Avatar } from '@/components/dashboard/Avatar'
import { Badge } from '@/components/dashboard/Badge'
import { cn } from '@/lib/cn'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const parentNav: NavItem[] = [
  { label: 'Dashboard', to: '/parent/dashboard', icon: LayoutDashboard, end: true },
  { label: 'My Children', to: '/parent/children', icon: Users },
  { label: 'My Profile', to: '/parent/profile', icon: UserRound },
]

export function ParentDashboardLayout() {
  const { profile, logout } = useParentAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/parent/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-royal-800 lg:flex">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
          <Logo dark />
          <Badge tone="gold" className="bg-gold-400/20 text-gold-400 ring-gold-500/30">
            Parent
          </Badge>
        </div>
        <nav aria-label="Parent portal navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {parentNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10'
                    : 'text-cream-200/80 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 pb-3">
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-cream-200/60 transition-colors hover:text-white"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View public website
          </NavLink>
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.fullName ?? 'Parent'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{profile?.fullName}</p>
              <p className="truncate text-xs text-cream-200/70">{profile?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-200/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-cream-200 bg-white px-4 shadow-sm lg:hidden">
        <span className="flex items-center gap-2">
          <Logo />
          <Badge tone="gold" className="bg-gold-400/20 text-gold-400 ring-gold-500/30">
            Parent
          </Badge>
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-royal-700 transition-colors hover:bg-cream-100"
          aria-label="Open parent portal menu"
          aria-expanded={drawerOpen}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn('fixed inset-0 z-50 lg:hidden', drawerOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      >
        <div
          className={cn(
            'absolute inset-0 bg-royal-900/60 backdrop-blur-sm transition-opacity',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Parent portal menu"
          className={cn(
            'absolute inset-y-0 left-0 flex w-[min(19rem,86vw)] flex-col bg-royal-800 shadow-2xl transition-transform duration-300',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Logo dark />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-cream-200 transition-colors hover:bg-white/10"
              aria-label="Close parent portal menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Parent portal navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {parentNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10'
                      : 'text-cream-200/80 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="lg:pl-72">
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <span className="sr-only">parent dashboard</span>
          <Outlet />
        </main>
        <footer className="border-t border-cream-200 px-4 py-6 pb-24 lg:pb-6">
          <p className="mx-auto flex max-w-7xl items-center justify-between text-xs text-ink-500">
            <span>Prime Royal Preparatory School &middot; Parent Portal</span>
            <span className="hidden sm:block">© {new Date().getFullYear()}</span>
          </p>
        </footer>
      </div>
    </div>
  )
}