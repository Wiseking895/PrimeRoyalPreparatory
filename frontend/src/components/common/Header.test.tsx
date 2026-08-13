import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('uses the logo as the home link and exposes no "Home" nav item', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull()
  })

  it('renders the primary desktop navigation items once without a Home item', () => {
    renderHeader()

    // About Us and Academics are directly visible top-level triggers.
    for (const label of ['About Us', 'Academics', 'More']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }

    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull()
  })

  it('groups Admissions, School Life, Gallery, News & Events and Contact Us inside the More dropdown', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    const expected: Array<[string, string]> = [
      ['Admissions', '/admissions'],
      ['School Life', '/school-life'],
      ['Gallery', '/gallery'],
      ['News & Events', '/news'],
      ['Contact Us', '/contact'],
    ]

    for (const [label, href] of expected) {
      const item = screen.getByRole('menuitem', { name: label })
      expect(item.getAttribute('href')).toBe(href)
    }
  })

  it('opens the About Us dropdown on click and shows all four destinations', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'About Us' }))

    for (const label of ['About PRPS', 'Mission & Vision', 'School Leadership', 'Why Choose Us']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('opens the Academics dropdown with its destinations', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Academics' }))
    for (const label of [
      'Academic Programs',
      'Curriculum',
      'Co-Curricular Activities',
      'Admission Process',
    ]) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('closes the dropdown on Escape', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'About Us' }))
    expect(screen.getByRole('menuitem', { name: 'About PRPS' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menuitem', { name: 'About PRPS' })).toBeNull()
  })

  it('closes the dropdown when clicking outside', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'About Us' }))
    expect(screen.getByRole('menuitem', { name: 'About PRPS' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'About PRPS' })).toBeNull()
  })

  it('presents the mobile navigation as a plain flat list with no nested categories', () => {
    renderHeader()

    const flatItems = [
      'About & School Life',
      'Academics',
      'Admissions',
      'Gallery',
      'News & Events',
      'Contact Us',
    ]

    for (const label of flatItems) {
      const links = screen.getAllByRole('link', { name: label })
      expect(links.length).toBeGreaterThanOrEqual(1)
    }

    // No accordion/category trigger should exist for any mobile entry.
    expect(screen.queryByRole('button', { name: 'About & School Life' })).toBeNull()
  })

  it('exposes both the Staff Login and Parent Portal entry points without wrapping', () => {
    renderHeader()

    // Each entry point appears twice: once in the desktop toolbar and once in
    // the (always-rendered) mobile drawer.
    const staffLoginLinks = screen.getAllByRole('link', { name: /Staff Login/i })
    const parentPortalLinks = screen.getAllByRole('link', { name: /Parent Portal/i })

    expect(staffLoginLinks.length).toBeGreaterThanOrEqual(2)
    expect(parentPortalLinks.length).toBeGreaterThanOrEqual(2)

    for (const link of [...staffLoginLinks, ...parentPortalLinks]) {
      expect(link.className).toContain('whitespace-nowrap')
    }

    for (const link of staffLoginLinks) {
      expect(link.getAttribute('href')).toBe('/staff/login')
    }
    for (const link of parentPortalLinks) {
      expect(link.getAttribute('href')).toBe('/#parent-portal')
    }
  })
})