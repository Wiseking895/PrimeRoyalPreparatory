import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function PupilsScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      <KidFigure x="150" y="252" scale={0.95} skin={C.skin1} hair={C.hair1} backpack />
      {/* open book held in front */}
      <g transform="translate(196 200) rotate(6)">
        <path d="M0,-14 L34,0 L34,34 L0,20 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <path d="M0,-14 L-34,0 L-34,34 L0,20 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <rect x="-3" y="0" width="6" height="24" rx="2" fill={C.magenta} />
      </g>
      <KidFigure x="252" y="252" scale={0.95} skin={C.skin3} hair={C.hair2} flip skirt />
      <path d="M118,182 L134,198" stroke={C.magenta} strokeWidth="5" strokeLinecap="round" />
      <path d="M288,172 L304,188" stroke={C.royal} strokeWidth="5" strokeLinecap="round" />
    </SceneFrame>
  )
}
