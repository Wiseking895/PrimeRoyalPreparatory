import { Scene } from '@/components/illustrations/Scene'
import type { GalleryItem } from '@/types/content'

export function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream-300/70 bg-cream-100 shadow-sm">
      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
        <Scene name={item.scene} />
      </div>
      <figcaption className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-royal-900/90 via-royal-900/25 to-transparent p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-magenta-400">
          {item.category}
        </span>
        <span className="mt-1 text-lg font-bold text-white">{item.title}</span>
      </figcaption>
    </figure>
  )
}
