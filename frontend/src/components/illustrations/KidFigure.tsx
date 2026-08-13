import { C } from './illustration-colors'

interface KidFigureProps {
  x: number | string
  y: number | string
  scale?: number
  skin?: string
  hair?: string
  flip?: boolean
  backpack?: boolean
  skirt?: boolean
}

/**
 * A stylised PRPS pupil. The shirt is ALWAYS solid cream (body, collar, neck
 * and sleeves) — see the uniform rule in the project brief. Local origin is at
 * the feet; the figure is roughly 128 units tall.
 */
export function KidFigure({
  x,
  y,
  scale = 1,
  skin = C.skin1,
  hair = C.hair1,
  flip = false,
  backpack = false,
  skirt = false,
}: KidFigureProps) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale}) scale(${flip ? -1 : 1} 1)`}
      aria-hidden="true"
    >
      {backpack ? (
        <rect x="-20" y="-84" width="13" height="20" rx="4" fill={C.royalDeep} />
      ) : null}

      {/* legs */}
      <rect x="-12" y="-34" width="8" height="28" rx="3" fill={C.royalDeep} />
      <rect x="4" y="-34" width="8" height="28" rx="3" fill={C.royalDeep} />
      {/* shoes */}
      <ellipse cx="-12" cy="-3" rx="7" ry="4" fill={C.ink} />
      <ellipse cx="8" cy="-3" rx="7" ry="4" fill={C.ink} />

      {/* shorts / skirt — navy */}
      {skirt ? (
        <path d="M-16,-54 L16,-54 L18,-34 L-18,-34 Z" fill={C.royal} />
      ) : (
        <rect x="-16" y="-56" width="32" height="22" rx="4" fill={C.royal} />
      )}

      {/* arms */}
      <rect x="-27" y="-82" width="9" height="15" rx="4" fill={C.uniform} transform="rotate(-14 -27 -74)" />
      <rect x="18" y="-82" width="9" height="15" rx="4" fill={C.uniform} transform="rotate(14 18 -74)" />

      {/* shirt — SOLID CREAM */}
      <path
        d="M-15,-54 L-18,-82 C-18,-89 -16,-92 -9,-92 L9,-92 C16,-92 18,-89 18,-82 L15,-54 C15,-52 -15,-52 -15,-54 Z"
        fill={C.uniform}
      />
      {/* collar — cream (slightly deeper tone for depth only) */}
      <path d="M-7,-92 L0,-97 L7,-92 Z" fill={C.uniformDeep} />

      {/* head */}
      <circle cx="0" cy="-108" r="17" fill={skin} />
      {/* hair */}
      <path d="M-17,-108 A17,17 0 0 1 17,-108 A17,17 0 0 0 -17,-108 Z" fill={hair} />
      {/* face */}
      <circle cx="-6" cy="-106" r="1.7" fill={C.ink} />
      <circle cx="6" cy="-106" r="1.7" fill={C.ink} />
      <path d="M-4,-100 Q0,-95 4,-100" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}
