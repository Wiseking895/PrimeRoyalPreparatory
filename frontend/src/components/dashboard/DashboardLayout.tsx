import { useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  CircleUserRound,
  ClipboardList,
  Eye,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  Wallet,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/common/Logo'
import { Avatar } from '@/components/dashboard/Avatar'
import { Badge } from '@/components/dashboard/Badge'
import { cn } from '@/lib/cn'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
  permission?: string
}

const ownerNav: NavItem[] = [
  { label: 'Dashboard', to: '/owner/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Pupils', to: '/owner/pupils', icon: Users, permission: 'pupils.view' },
  { label: 'Classes', to: '/owner/classes', icon: BookOpenCheck, permission: 'classes.view' },
  { label: 'Teachers', to: '/owner/academic/teachers', icon: Users, permission: 'teachers.view' },
  { label: 'Subjects', to: '/owner/academic/subjects', icon: BookOpenCheck, permission: 'subjects.view' },
  { label: 'Assignments', to: '/owner/academic/assignments', icon: UserCog, permission: 'assignments.manage' },
  { label: 'Headteacher', to: '/owner/headteacher', icon: UserCog },
  { label: 'Staff', to: '/owner/staff', icon: Users },
  { label: 'Roles & Permissions', to: '/owner/roles', icon: ShieldCheck },
  { label: 'Finance', to: '/owner/finance', icon: Wallet, permission: 'finance.view' },
  { label: 'Audit Activity', to: '/owner/audit', icon: ScrollText },
  { label: 'My Profile', to: '/owner/profile', icon: CircleUserRound },
  { label: 'Settings', to: '/owner/settings', icon: Settings },
]

const headteacherNav: NavItem[] = [
  { label: 'Dashboard', to: '/headteacher/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Pupils', to: '/headteacher/pupils', icon: Users, permission: 'pupils.view' },
  { label: 'Classes', to: '/headteacher/classes', icon: BookOpenCheck, permission: 'classes.view' },
  { label: 'Teachers', to: '/headteacher/academic/teachers', icon: Users, permission: 'teachers.view' },
  { label: 'Subjects', to: '/headteacher/academic/subjects', icon: BookOpenCheck, permission: 'subjects.view' },
  { label: 'Assignments', to: '/headteacher/academic/assignments', icon: UserCog, permission: 'assignments.manage' },
  { label: 'Staff', to: '/headteacher/staff', icon: Users },
  { label: 'Roles', to: '/headteacher/roles', icon: ShieldCheck },
  { label: 'Finance', to: '/headteacher/finance', icon: Wallet, permission: 'finance.view' },
  { label: 'My Profile', to: '/headteacher/profile', icon: CircleUserRound },
]

const accountantNav: NavItem[] = [
  { label: 'Dashboard', to: '/accountant/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Sessions & Terms', to: '/accountant/sessions', icon: BookOpenCheck, permission: 'finance.view' },
  { label: 'Fee Structures', to: '/accountant/fees', icon: Receipt, permission: 'finance.view' },
  { label: 'Charge Generation', to: '/accountant/charges', icon: ListChecks, permission: 'finance.view' },
  { label: 'Payments', to: '/accountant/payments', icon: Wallet, permission: 'finance.view' },
  { label: 'Pupil Finance', to: '/accountant/pupils', icon: Users, permission: 'finance.view' },
  { label: 'Summary', to: '/accountant/summary', icon: ScrollText, permission: 'finance.view' },
  { label: 'My Profile', to: '/accountant/profile', icon: CircleUserRound },
]

const teacherNav: NavItem[] = [
  { label: 'Dashboard', to: '/teacher/dashboard', icon: LayoutDashboard, end: true },
  { label: 'My Classes', to: '/teacher/classes', icon: BookOpenCheck, permission: 'sba.view' },
  { label: 'SBA Records', to: '/teacher/sba', icon: ClipboardList, permission: 'sba.view' },
  { label: 'Enter Scores', to: '/teacher/sba/entry', icon: ListChecks, permission: 'sba.manage' },
  { label: 'My Profile', to: '/teacher/profile', icon: CircleUserRound },
]

function NavList({
  items,
  hasPermission,
  onNavigate,
}: {
  items: NavItem[]
  hasPermission: (key: string) => boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items
        .filter((item) => !item.permission || hasPermission(item.permission))
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
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
  )
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  return (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={user?.fullName ?? 'User'} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{user?.fullName}</p>
          <p className="truncate text-xs text-cream-200/70">{user?.staffId ?? user?.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-200/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
        Logout
      </button>
    </div>
  )
}

export function DashboardLayout() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAccountant = user?.roles.includes('ACCOUNTANT') ?? false
  const isOwner = user?.roles.includes('OWNER') ?? false
  const isTeacher = user?.roles.some((role) => role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') ?? false

  const basePath = isOwner ? 'owner' : isAccountant ? 'accountant' : isTeacher ? 'teacher' : 'headteacher'

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const items = useMemo(
    () => (isOwner ? ownerNav : isAccountant ? accountantNav : isTeacher ? teacherNav : headteacherNav),
    [isOwner, isAccountant, isTeacher],
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const roleBadge = isOwner ? (
    <Badge tone="gold" className="bg-gold-400/20 text-gold-400 ring-gold-500/30">
      Owner
    </Badge>
  ) : isAccountant ? (
    <Badge tone="royal" className="bg-white/10 text-cream-100 ring-white/20">
      Accountant
    </Badge>
  ) : isTeacher ? (
    <Badge tone="magenta" className="bg-magenta-500/20 text-magenta-300 ring-magenta-500/30">
      Teacher
    </Badge>
  ) : (
    <Badge tone="magenta">Headteacher</Badge>
  )

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-royal-800 lg:flex">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
          <Logo dark />
          {roleBadge}
        </div>
        <NavList items={items} hasPermission={hasPermission} />
        <div className="px-5 pb-3">
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-cream-200/60 transition-colors hover:text-white"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View public website
          </NavLink>
        </div>
        <SidebarFooter onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-cream-200 bg-white px-4 shadow-sm lg:hidden">
        <span className="flex items-center gap-2">
          <Logo />
          {roleBadge}
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-royal-700 transition-colors hover:bg-cream-100"
          aria-label="Open dashboard menu"
          aria-expanded={drawerOpen}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
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
          aria-label="Dashboard menu"
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
              aria-label="Close dashboard menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <NavList items={items} hasPermission={hasPermission} onNavigate={() => setDrawerOpen(false)} />
          <div className="px-5 pb-3">
            <NavLink
              to="/"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-cream-200/60 transition-colors hover:text-white"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              View public website
            </NavLink>
          </div>
          <SidebarFooter onLogout={handleLogout} />
        </div>
      </div>

      {/* Content */}
      <div className="lg:pl-72">
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <span className="sr-only">{basePath} dashboard</span>
          <Outlet />
        </main>
        <footer className="border-t border-cream-200 px-4 py-6 pb-24 lg:pb-6">
          <p className="mx-auto flex max-w-7xl items-center justify-between text-xs text-ink-500">
            <span>Prime Royal Preparatory School &middot; Staff Portal</span>
            <span className="hidden sm:block">© {new Date().getFullYear()}</span>
          </p>
        </footer>
      </div>
    </div>
  )
}