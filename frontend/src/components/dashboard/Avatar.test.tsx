import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Avatar } from './Avatar'
import { api } from '@/lib/api'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Avatar', () => {
  it('renders initials when there is no picture', () => {
    render(<Avatar name="Kofi Mensah" />)

    expect(screen.getByText('KM')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('uses legacy and absolute URLs as-is', () => {
    vi.spyOn(api, 'resolveDocumentUrl')

    const legacy = render(
      <Avatar name="Ama Owusu" imageUrl="/api/uploads/profile-pictures/legacy.jpg" />,
    )
    expect(legacy.container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/uploads/profile-pictures/legacy.jpg',
    )
    expect(api.resolveDocumentUrl).not.toHaveBeenCalled()

    const absolute = render(<Avatar name="Ama Owusu" imageUrl="https://cdn.example.com/photo.jpg" />)
    expect(absolute.container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/photo.jpg',
    )
    expect(api.resolveDocumentUrl).not.toHaveBeenCalled()
  })

  it('resolves an object-store reference to a presigned URL', async () => {
    const resolveSpy = vi
      .spyOn(api, 'resolveDocumentUrl')
      .mockResolvedValue('https://acct.r2.test/doc-1.jpg?X-Amz-Signature=abc')

    render(<Avatar name="Kofi Mensah" imageUrl="/api/documents/doc-1" />)

    // Until the presigned URL is available we show the branded initials block.
    expect(screen.getByText('KM')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()

    await waitFor(() => {
      expect(document.querySelector('img')).toHaveAttribute(
        'src',
        'https://acct.r2.test/doc-1.jpg?X-Amz-Signature=abc',
      )
    })
    expect(resolveSpy).toHaveBeenCalledWith('/api/documents/doc-1')
    expect(screen.queryByText('KM')).not.toBeInTheDocument()
  })

  it('keeps the initials fallback when resolution fails', async () => {
    vi.spyOn(api, 'resolveDocumentUrl').mockRejectedValue(new Error('unauthorized'))

    render(<Avatar name="Kofi Mensah" imageUrl="/api/documents/doc-1" />)

    await waitFor(() => {
      expect(api.resolveDocumentUrl).toHaveBeenCalledTimes(1)
    })
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('KM')).toBeInTheDocument()
  })

  it('swaps the picture when the reference changes', async () => {
    const resolveSpy = vi
      .spyOn(api, 'resolveDocumentUrl')
      .mockImplementation((reference: string) =>
        Promise.resolve(`https://r2.test/${reference.slice('/api/documents/'.length)}.jpg`),
      )

    const { rerender } = render(<Avatar name="Kofi Mensah" imageUrl="/api/documents/doc-1" />)

    await waitFor(() => {
      expect(document.querySelector('img')).toHaveAttribute('src', 'https://r2.test/doc-1.jpg')
    })

    rerender(<Avatar name="Kofi Mensah" imageUrl="/api/documents/doc-2" />)

    await waitFor(() => {
      expect(document.querySelector('img')).toHaveAttribute('src', 'https://r2.test/doc-2.jpg')
    })
    expect(resolveSpy).toHaveBeenCalledWith('/api/documents/doc-2')
  })
})
