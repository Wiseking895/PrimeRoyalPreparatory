import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

function renderInRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Button', () => {
  it('renders a native button by default', () => {
    renderInRouter(<Button>Submit</Button>)
    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toBeInTheDocument()
  })

  it('renders a link when a `to` prop is provided', () => {
    renderInRouter(<Button to="/about">About Us</Button>)
    const link = screen.getByRole('link', { name: 'About Us' })
    expect(link).toHaveAttribute('href', '/about')
  })

  it('applies variant and size classes', () => {
    renderInRouter(<Button variant="secondary" size="lg">Admissions</Button>)
    const button = screen.getByRole('button', { name: 'Admissions' })
    expect(button.className).toContain('bg-royal-600')
    expect(button.className).toContain('px-7')
  })
})
