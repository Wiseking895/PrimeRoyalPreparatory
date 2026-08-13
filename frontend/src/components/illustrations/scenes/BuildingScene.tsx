import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function BuildingScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* flag */}
      <rect x="68" y="44" width="5" height="64" rx="2" fill={C.ink} />
      <path d="M73,46 L112,58 L73,72 Z" fill={C.magenta} />
      {/* building */}
      <rect x="90" y="100" width="220" height="150" rx="10" fill={C.white} stroke={C.creamDeep} strokeWidth="5" />
      {/* parapet */}
      <rect x="90" y="100" width="220" height="26" rx="6" fill={C.royal} />
      {/* sign */}
      <rect x="148" y="112" width="104" height="26" rx="6" fill={C.white} />
      <text
        x="200"
        y="131"
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="800"
        fontSize="17"
        fill={C.royal}
      >
        PRPS
      </text>
      {/* arched door */}
      <path d="M178,250 L178,216 A22,22 0 0 1 222,216 L222,250 Z" fill={C.magentaDeep} />
      <circle cx="216" cy="234" r="2.4" fill={C.white} />
      {/* windows */}
      <rect x="114" y="156" width="32" height="40" rx="4" fill={C.creamCard} stroke={C.royal} strokeWidth="3.5" />
      <rect x="254" y="156" width="32" height="40" rx="4" fill={C.creamCard} stroke={C.royal} strokeWidth="3.5" />
      <rect x="114" y="206" width="32" height="40" rx="4" fill={C.creamCard} stroke={C.royal} strokeWidth="3.5" />
      <rect x="254" y="206" width="32" height="40" rx="4" fill={C.creamCard} stroke={C.royal} strokeWidth="3.5" />
      {/* bushes */}
      <ellipse cx="118" cy="252" rx="22" ry="14" fill="#8FBF7F" />
      <ellipse cx="282" cy="252" rx="22" ry="14" fill="#8FBF7F" />
      <circle cx="336" cy="70" r="9" fill={C.magenta} opacity="0.4" />
    </SceneFrame>
  )
}
