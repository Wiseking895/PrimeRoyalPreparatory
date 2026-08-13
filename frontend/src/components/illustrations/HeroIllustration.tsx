import { KidFigure } from './KidFigure'
import { C } from './illustration-colors'

/**
 * Hero scene: pupils in solid cream uniforms on the PRPS brand palette.
 * The arch-shaped container treatment is applied by the Hero section.
 */
export function HeroIllustration() {
  return (
    <svg viewBox="0 0 640 520" role="img" aria-label="Happy PRPS pupils in school uniforms" className="h-full w-full">
      {/* soft background */}
      <rect width="640" height="520" rx="28" fill={C.creamCard} />
      <circle cx="96" cy="120" r="46" fill={C.royal} opacity="0.08" />
      <circle cx="560" cy="140" r="54" fill={C.magenta} opacity="0.08" />
      <circle cx="60" cy="440" r="40" fill={C.magenta} opacity="0.08" />
      <circle cx="600" cy="420" r="34" fill={C.royal} opacity="0.08" />
      <circle cx="120" cy="90" r="8" fill={C.creamDeep} />
      <circle cx="540" cy="92" r="10" fill={C.creamDeep} />
      <circle cx="330" cy="60" r="7" fill={C.creamDeep} />

      {/* floating accents */}
      <path
        d="M120,168 L128,168 L128,160 L128,168 L136,168 L136,168 L128,168 L128,176 L128,168 Z"
        fill={C.magenta}
      />
      <path
        d="M512,200 L522,200 L522,190 L522,200 L532,200 L532,200 L522,200 L522,210 L522,200 Z"
        fill={C.royal}
      />
      <circle cx="478" cy="118" r="12" fill={C.magenta} opacity="0.5" />
      <circle cx="150" cy="300" r="10" fill={C.royal} opacity="0.4" />
      <path d="M494,264 L520,290" stroke={C.creamDeep} strokeWidth="10" strokeLinecap="round" />

      {/* ground */}
      <ellipse cx="320" cy="452" rx="230" ry="34" fill={C.ink} opacity="0.05" />

      {/* open book */}
      <g transform="translate(320 462)">
        <path d="M0,-8 L26,4 L26,26 L0,14 Z" fill={C.white} stroke={C.royal} strokeWidth="2" />
        <path d="M0,-8 L-26,4 L-26,26 L0,14 Z" fill={C.white} stroke={C.royal} strokeWidth="2" />
        <rect x="-2" y="4" width="4" height="16" rx="2" fill={C.magenta} />
      </g>

      {/* pupils — always solid cream shirts */}
      <KidFigure x="196" y="432" scale={1} skin={C.skin2} hair={C.hair3} flip backpack />
      <KidFigure x="322" y="428" scale={1.18} skin={C.skin1} hair={C.hair1} skirt />
      <KidFigure x="446" y="434" scale={1.05} skin={C.skin3} hair={C.hair2} backpack />
    </svg>
  )
}
