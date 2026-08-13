import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'

export default function NotFoundPage() {
  return (
    <Container className="flex flex-col items-center py-24 text-center sm:py-32">
      <p className="text-7xl font-extrabold tracking-tight text-magenta-500">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-900">Page not found</h1>
      <p className="mt-2 max-w-md text-ink-500">
        The page you are looking for does not exist or may have moved.
      </p>
      <Button to="/" className="mt-8">
        Back to Home
      </Button>
    </Container>
  )
}
