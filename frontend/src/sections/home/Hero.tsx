import { ArrowRight, Play } from 'lucide-react'
import homeHeroImage from '@/assets/images/hero/home1.jpeg'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { siteConfig } from '@/config/site'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-royal-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-magenta-500/10"
      />

      <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div className="relative z-10">
          <Badge>{siteConfig.motto}</Badge>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-royal-900 sm:text-5xl xl:text-6xl">
            Shaping Today.
            <br />
            <span className="text-magenta-500">Transforming</span> Tomorrow.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-500 sm:text-lg">
            {siteConfig.name} nurtures young minds with quality education, strong values, and a
            passion for excellence.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button to="/admissions" size="lg">
              Apply for Admission
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button to="/about" variant="secondary" size="lg">
              Explore Our School
            </Button>
            <Button to="#school-gallery" variant="soft" size="lg">
              <Play className="h-5 w-5 text-magenta-500" aria-hidden="true" />
              Watch Video
            </Button>
          </div>
        </div>

        <div className="relative">
          {/* Colored curved treatment around the image (magenta / royal / gold). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-6 h-40 w-40 rounded-[42%_58%_55%_45%/52%_48%_52%_48%] bg-magenta-500/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 bottom-0 h-48 w-48 rounded-[58%_42%_45%_55%/48%_52%_46%_54%] bg-royal-500/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 right-16 h-14 w-14 rounded-full bg-gold-400/40"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-10 h-3 w-3 rounded-full bg-gold-400/70"
          />

          <div className="relative mx-auto max-w-md sm:max-w-lg lg:max-w-none">
            <div className="relative overflow-hidden rounded-t-[12rem] rounded-b-[2.75rem] border-4 border-white bg-white shadow-[0_28px_70px_-24px_rgba(11,20,48,0.45)]">
              <div className="aspect-[4/5]">
                <img
                  src={homeHeroImage}
                  alt="Pupils at Prime Royal Preparatory School"
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 top-20 h-24 w-24 rounded-full border-[6px] border-gold-400/60"
              />
            </div>
          </div>

          <div className="absolute -left-2 bottom-10 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-12px_rgba(11,20,48,0.25)] sm:flex">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-magenta-500 text-base font-extrabold text-white">
              800+
            </span>
            <span className="text-sm font-bold text-ink-900">Happy Pupils</span>
          </div>
        </div>
      </Container>
    </section>
  )
}