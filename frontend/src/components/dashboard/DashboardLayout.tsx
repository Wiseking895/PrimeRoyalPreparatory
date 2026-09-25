import { useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  ClipboardList,
  Eye,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
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
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { DeveloperModeBanner } from '@/components/dashboard/DeveloperModeBanner'
import { cn } from '@/lib/cn'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
  permission?: string
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const ownerNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Overview', to: '/owner/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'School',
    items: [
      { label: 'Headteacher', to: '/owner/headteacher', icon: UserCog },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance Overview', to: '/owner/finance/overview', icon: Wallet, permission: 'finance.view' },
      { label: 'Reconciliation', to: '/owner/finance/reconciliation', icon: ClipboardCheck, permission: 'finance.view' },
      { label: 'Payment History', to: '/owner/finance/payments', icon: History, permission: 'finance.view' },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Work Output', to: '/owner/work-output', icon: ClipboardList, permission: 'owner.manage' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Announcements', to: '/owner/announcements', icon: Megaphone, permission: 'announcements.view' },
      { label: 'Notifications', to: '/owner/notifications', icon: ShieldCheck, permission: 'notifications.view' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', to: '/owner/profile', icon: CircleUserRound },
      { label: 'Settings', to: '/owner/settings', icon: Settings },
    ],
  },
]

const headteacherNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/headteacher/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Academic Years & Terms', to: '/headteacher/finance/sessions', icon: CalendarDays, permission: 'academic.view' },
      { label: 'Pupils', to: '/headteacher/pupils', icon: Users, permission: 'pupils.view' },
      { label: 'Classes', to: '/headteacher/classes', icon: BookOpenCheck, permission: 'classes.view' },
      { label: 'Teachers', to: '/headteacher/academic/teachers', icon: Users, permission: 'teachers.view' },
      { label: 'Subjects', to: '/headteacher/academic/subjects', icon: BookOpenCheck, permission: 'subjects.view' },
      { label: 'Assignments', to: '/headteacher/academic/assignments', icon: UserCog, permission: 'assignments.manage' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Staff', to: '/headteacher/staff', icon: Users },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance', to: '/headteacher/finance', icon: Wallet, permission: 'finance.view' },
      { label: 'Fee Structures', to: '/headteacher/finance/fees', icon: Receipt, permission: 'finance.view' },
      { label: 'Reconciliation', to: '/headteacher/finance/reconciliation', icon: ClipboardCheck, permission: 'finance.view' },
      { label: 'Payment History', to: '/headteacher/finance/payments', icon: History, permission: 'finance.view' },
    ],
  },
  {
    label: 'Academic Oversight',
    items: [
      { label: 'Work Output', to: '/headteacher/work-output', icon: ClipboardList, permission: 'teachers.view' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Announcements', to: '/headteacher/announcements', icon: Megaphone, permission: 'announcements.view' },
      { label: 'Notifications', to: '/headteacher/notifications', icon: ShieldCheck, permission: 'notifications.view' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', to: '/headteacher/profile', icon: CircleUserRound },
    ],
  },
]

const accountantNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/accountant/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Fee Structures', to: '/accountant/fees', icon: Receipt, permission: 'finance.view' },
      { label: 'Reconciliation', to: '/accountant/reconciliation', icon: ClipboardCheck, permission: 'finance.view' },
      { label: 'Payment History', to: '/accountant/payments', icon: History, permission: 'finance.view' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Announcements', to: '/accountant/announcements', icon: Megaphone, permission: 'announcements.view' },
      { label: 'Notifications', to: '/accountant/notifications', icon: ShieldCheck, permission: 'notifications.view' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', to: '/accountant/profile', icon: CircleUserRound },
    ],
  },
]

const teacherNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/teacher/dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { label: 'My Classes', to: '/teacher/classes', icon: BookOpenCheck, permission: 'sba.view' },
      { label: 'SBA Records', to: '/teacher/sba', icon: ClipboardList, permission: 'sba.view' },
      { label: 'Enter Scores', to: '/teacher/sba/entry', icon: ListChecks, permission: 'sba.manage' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Announcements', to: '/teacher/announcements', icon: Megaphone, permission: 'announcements.view' },
      { label: 'Notifications', to: '/teacher/notifications', icon: ShieldCheck, permission: 'notifications.view' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', to: '/teacher/profile', icon: CircleUserRound },
    ],
  },
]

function NavGroupSection({
  group,
  hasPermission,
  onNavigate,
  isOwner,
}: {
  group: NavGroup
  hasPermission: (key: string) => boolean
  onNavigate?: () => void
  isOwner: boolean
}) {
  const visibleItems = group.items.filter((item) => !item.permission || hasPermission(item.permission))
  if (visibleItems.length === 0) return null

  return (
    <div className="mb-1">
      {group.label && (
        <p
          className={cn(
            'mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em]',
            isOwner ? 'text-cream-200/60' : 'text-cream-200/65',
          )}
        >
          {group.label}
        </p>
      )}
      <div className="space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all duration-150',
                isOwner
                  ? isActive
                    ? 'bg-magenta-500/15 text-white shadow-sm'
                    : 'text-cream-200/55 hover:bg-white/5 hover:text-cream-100'
                  : isActive
                    ? 'bg-magenta-500/15 text-white shadow-sm'
                    : 'text-cream-200/60 hover:bg-white/5 hover:text-cream-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                    isActive ? 'bg-magenta-500/25 text-magenta-300' : 'text-cream-200/70 group-hover:text-cream-100',
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {item.label}
                {isActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-magenta-400" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function SidebarFooter({ onLogout, isOwner, isHeadteacher, isAccountant }: { onLogout: () => void; isOwner: boolean; isHeadteacher: boolean; isAccountant: boolean }) {
  const { user } = useAuth()
  return (
    <div className="border-t border-white/[0.06] p-4">
      <div className="flex items-center gap-3">
        <Avatar name={user?.fullName ?? 'User'} imageUrl={user?.profilePictureUrl} size="sm" className="ring-2 ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">{user?.fullName}</p>
          <p className="truncate text-[11px] text-cream-200/70">{isOwner ? 'School Owner' : isHeadteacher ? 'Headteacher' : isAccountant ? 'Accountant' : user?.staffId ?? user?.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold text-cream-200/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        Sign out
      </button>
    </div>
  )
}

function OwnerTopBar({ pageTitle, pageSubtitle }: { pageTitle: string; pageSubtitle?: string }) {
  const { user } = useAuth()
  const isOwner = user?.roles.includes('OWNER') ?? false
  const isHeadteacher = user?.roles.includes('HEADTEACHER') ?? false
  const isAccountant = user?.roles.includes('ACCOUNTANT') ?? false
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#081536]/80 backdrop-blur-md px-6 py-3">
      <div>
        <h1 className="text-lg font-extrabold text-white">{pageTitle}</h1>
        {pageSubtitle && <p className="mt-0.5 text-[12px] text-cream-200/65">{pageSubtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[12px] font-semibold text-cream-200/60">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
          <Avatar name={user?.fullName ?? 'Owner'} imageUrl={user?.profilePictureUrl} size="sm" className="ring-1 ring-magenta-500/30" />
          <div className="hidden sm:block">
            <p className="text-[12px] font-bold text-white">{user?.fullName}</p>
            <p className="text-[10px] text-magenta-300">{isOwner ? 'Owner' : isHeadteacher ? 'Headteacher' : isAccountant ? 'Accountant' : 'Staff'}</p>
          </div>
        </div>
      </div>
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
  const isHeadteacher = user?.roles.includes('HEADTEACHER') ?? false
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

  const navGroups = useMemo(
    () => (isOwner ? ownerNavGroups : isAccountant ? accountantNavGroups : isTeacher ? teacherNavGroups : headteacherNavGroups),
    [isOwner, isAccountant, isTeacher],
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const pageTitle = isOwner ? 'School Overview' : isHeadteacher ? 'Headteacher Dashboard' : isAccountant ? 'Finance Dashboard' : isTeacher ? 'Teacher Dashboard' : 'Dashboard'
  const pageSubtitle = isOwner ? 'Real-time school-wide overview' : isHeadteacher ? 'Operational school management' : isAccountant ? 'Finance operations dashboard' : undefined

  const roleBadge = isOwner ? (
    <Badge tone="gold" className="bg-gold-400/20 text-gold-400 ring-gold-500/30">
      Owner
    </Badge>
  ) : isHeadteacher ? (
    <Badge tone="magenta" className="bg-magenta-500/20 text-magenta-300 ring-magenta-500/30">
      Headteacher
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
    <Badge tone="magenta">Staff</Badge>
  )

  // ── DARK GLASSMOPIC LAYOUT (Owner + Headteacher + Accountant) ──
  if (isOwner || isHeadteacher || isAccountant) {
    return (
      <div className="min-h-screen bg-[#081536]">
        <DeveloperModeBanner />
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col bg-[#0b1430]/95 backdrop-blur-md lg:flex">
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
            <Logo dark />
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-cream-200/60">
              {isOwner ? 'Owner Portal' : isAccountant ? 'Finance Portal' : 'Headteacher Portal'}
            </span>
          </div>

          {/* Nav groups */}
          <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {navGroups.map((group, i) => (
              <NavGroupSection key={i} group={group} hasPermission={hasPermission} isOwner={isOwner} />
            ))}
          </nav>

          {/* View public website */}
          <div className="px-4 pb-2">
            <NavLink
              to="/"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-cream-200/60 transition-colors hover:text-cream-100/60"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              View public website
            </NavLink>
          </div>

          <SidebarFooter onLogout={handleLogout} isOwner={isOwner} isHeadteacher={isHeadteacher} isAccountant={isAccountant} />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0b1430]/90 backdrop-blur-md px-4 shadow-sm lg:hidden">
          <span className="flex items-center gap-2.5">
            <Logo dark />
            {roleBadge}
          </span>
          <div className="flex items-center gap-1">
            <NotificationBell dark />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-cream-200/60 transition-colors hover:bg-white/10"
              aria-label="Open dashboard menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
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
              'absolute inset-0 bg-royal-900/70 backdrop-blur-sm transition-opacity duration-300',
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
              'absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] flex-col bg-[#0b1430] shadow-2xl transition-transform duration-300',
              drawerOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <Logo dark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-cream-200/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close dashboard menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
              {navGroups.map((group, i) => (
                <NavGroupSection key={i} group={group} hasPermission={hasPermission} isOwner={isOwner} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </nav>
            <div className="px-4 pb-2">
              <NavLink
                to="/"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-cream-200/60 transition-colors hover:text-cream-100/60"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View public website
              </NavLink>
            </div>
            <SidebarFooter onLogout={handleLogout} isOwner={isOwner} isHeadteacher={isHeadteacher} isAccountant={isAccountant} />
          </div>
        </div>

        {/* Content */}
        <div className="lg:pl-[240px]">
          <OwnerTopBar pageTitle={pageTitle} pageSubtitle={pageSubtitle} />
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-6">
            <span className="sr-only">{basePath} dashboard</span>
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  // ── STANDARD LAYOUT (cream background) ──
  return (
    <div className="min-h-screen bg-cream-100">
      <DeveloperModeBanner />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-royal-900 lg:flex">
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo dark />
          </div>
          <NotificationBell dark />
        </div>

        {/* Nav groups */}
        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {navGroups.map((group, i) => (
            <NavGroupSection key={i} group={group} hasPermission={hasPermission} isOwner={false} />
          ))}
        </nav>

        {/* View public website */}
        <div className="px-4 pb-2">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-cream-200/60 transition-colors hover:text-cream-100/70"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View public website
          </NavLink>
        </div>

        <SidebarFooter onLogout={handleLogout} isOwner={false} isHeadteacher={false} isAccountant={false} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-cream-200/80 bg-white/80 backdrop-blur-md px-4 shadow-sm lg:hidden">
        <span className="flex items-center gap-2.5">
          <Logo />
          {roleBadge}
        </span>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-royal-700 transition-colors hover:bg-cream-100"
            aria-label="Open dashboard menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
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
            'absolute inset-0 bg-royal-900/70 backdrop-blur-sm transition-opacity duration-300',
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
            'absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] flex-col bg-royal-900 shadow-2xl transition-transform duration-300',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <Logo dark />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-cream-200/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close dashboard menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {navGroups.map((group, i) => (
              <NavGroupSection key={i} group={group} hasPermission={hasPermission} isOwner={false} onNavigate={() => setDrawerOpen(false)} />
            ))}
          </nav>
          <div className="px-4 pb-2">
            <NavLink
              to="/"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-cream-200/60 transition-colors hover:text-cream-100/70"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              View public website
            </NavLink>
          </div>
          <SidebarFooter onLogout={handleLogout} isOwner={false} isHeadteacher={false} isAccountant={false} />
        </div>
      </div>

      {/* Content */}
      <div className="lg:pl-[260px]">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <span className="sr-only">{basePath} dashboard</span>
          <Outlet />
        </main>
        <footer className="border-t border-cream-200/60 px-4 py-5 pb-20 lg:pb-5">
          <p className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-ink-500">
            <span>Prime Royal Preparatory School</span>
            <span className="hidden sm:block">&copy; {new Date().getFullYear()}</span>
          </p>
        </footer>
      </div>
    </div>
  )
}
