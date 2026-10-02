import { render, screen } from '@testing-library/react'
import { createBrowserRouter, matchRoutes, RouterProvider } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { ToastProvider } from '@/components/dashboard/Toast'

const { setupStatusMock } = vi.hoisted(() => ({ setupStatusMock: vi.fn() }))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    api: { ...(actual.api as Record<string, unknown>), setupStatus: setupStatusMock },
  }
})

let router: ReturnType<typeof createBrowserRouter>

/**
 * Deep-link behaviour: the SPA is entered at a client-side route before React
 * Router takes control — exactly what a fresh browser or an external device
 * does when it opens a shared link such as `/setup/owner`. The hosting layer
 * (Vercel) must serve `index.html` for that path; this suite asserts that the
 * router then resolves the entry URL to the right PRPS page.
 */
beforeAll(async () => {
  localStorage.clear()
  setupStatusMock.mockResolvedValue({ ownerExists: false, googleOAuthEnabled: false })
  window.history.replaceState({}, '', '/setup/owner')
  router = (await import('./index')).router
}, 30_000)

function renderApp(entry?: string) {
  if (entry) {
    window.history.replaceState({}, '', entry)
  }
  const activeRouter = entry ? createBrowserRouter(router.routes) : router
  return render(
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={activeRouter} />
      </ToastProvider>
    </AuthProvider>,
  )
}

describe('SPA deep links', () => {
  it('renders OwnerSetupPage when the app is entered directly at /setup/owner', async () => {
    expect(window.location.pathname).toBe('/setup/owner')

    renderApp()

    expect(await screen.findByText('Set up your Owner account')).toBeInTheDocument()
    expect(setupStatusMock).toHaveBeenCalled()
  })

  it('renders the staff login page for a direct /login entry', async () => {
    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'PRPS Staff Portal' })).toBeInTheDocument()
  })

  it('renders the app 404 page for an unknown path instead of a hosting 404', async () => {
    renderApp('/this-route-does-not-exist')

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('registers the protected portal routes so a direct request resolves inside the SPA', () => {
    for (const path of [
      '/',
      '/owner',
      '/owner/headteacher',
      '/headteacher/dashboard',
      '/teacher/dashboard',
      '/parent/login',
      '/developer/accounts',
    ]) {
      const matches = matchRoutes(router.routes, path)
      expect(matches, `no route matched ${path}`).not.toBeNull()
      expect(matches?.at(-1)?.route.path, `catch-all matched ${path}`).not.toBe('*')
    }

    const unknown = matchRoutes(router.routes, '/definitely-not-a-page')
    expect(unknown?.at(-1)?.route.path).toBe('*')
  })
})
