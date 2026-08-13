import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { MainNavChild } from '@/data/nav'
import { cn } from '@/lib/cn'

interface NavDropdownProps {
  label: string
  items: MainNavChild[]
  isActive: boolean
  className?: string
}

export function NavDropdown({ label, items, isActive, className }: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pathname, hash } = useLocation()

  const menuId = `nav-menu-${label.toLowerCase().replace(/\s+/g, '-')}`
  const close = () => setOpen(false)

  // Close when navigating to a different route (pathname or hash).
  useEffect(() => {
    close()
  }, [pathname, hash])

  // Close on Escape or on a click/pointer-down outside the dropdown.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      containerRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')?.focus()
    }
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const links = Array.from(
      containerRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]') ?? [],
    )
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      links[(index + 1) % links.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      links[(index - 1 + links.length) % links.length]?.focus()
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold transition-colors xl:text-sm',
          open || isActive ? 'text-magenta-600' : 'text-ink-700 hover:text-magenta-600',
        )}
      >
        {label}
        <ChevronDown
          className={cn('h-4 w-4 text-ink-500 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 pt-3">
          <ul
            id={menuId}
            role="menu"
            aria-label={`${label} submenu`}
            onKeyDown={handleMenuKeyDown}
            className="animate-menu-in w-56 overflow-hidden rounded-xl border border-cream-300/70 bg-white p-2 shadow-[0_18px_40px_-12px_rgba(11,20,48,0.18)]"
          >
            {items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  role="menuitem"
                  tabIndex={0}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-cream-100 hover:text-magenta-600"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
