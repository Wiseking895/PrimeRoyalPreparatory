import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

function Football() {
  return (
    <g>
      <circle cx="0" cy="0" r="17" fill={C.white} stroke={C.ink} strokeWidth="2" />
      <path d="M0,-17 L8,-4 L0,10 L-8,-4 Z" fill={C.ink} />
      <path d="M-14,-9 L-4,-8 L-12,6 Z" fill={C.ink} />
      <path d="M14,-9 L4,-8 L12,6 Z" fill={C.ink} />
    </g>
  )
}

export function SportsScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      <ellipse cx="220" cy="250" rx="70" ry="16" fill={C.creamDeep} opacity="0.7" />
      <g transform="translate(222 232) rotate(-18)">
        <Football />
      </g>
      <KidFigure x="158" y="252" scale={0.95} skin={C.skin2} hair={C.hair3} flip />
      <KidFigure x="286" y="252" scale={0.85} skin={C.skin1} hair={C.hair1} backpack />
      <path d="M120,168 L136,184" stroke={C.magenta} strokeWidth="6" strokeLinecap="round" />
      <circle cx="330" cy="78" r="10" fill={C.magenta} opacity="0.4" />
      <circle cx="60" cy="70" r="8" fill={C.royal} opacity="0.4" />
    </SceneFrame>
  )
}
