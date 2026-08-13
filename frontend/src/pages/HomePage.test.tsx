import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage'

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('renders the hero and all major sections', () => {
    const { container } = renderHome()

    const text = container.textContent ?? ''
    expect(container.querySelector('h1')?.textContent).toContain('Shaping Today')
    expect(text).toContain('Why PRPS')
    expect(text).toContain('Our Academic Programs')
    expect(text).toContain('Our Admission Process')
    expect(text).toContain('Parent Portal')
    expect(text).toContain('Latest News & Events')
    expect(text).toContain('School Gallery')
    expect(text).toContain('Contact Us')
  })
})
