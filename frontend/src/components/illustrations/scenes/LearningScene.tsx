import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function LearningScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* book nook */}
      <rect x="70" y="196" width="260" height="10" rx="5" fill={C.creamDeep} />
      <KidFigure x="178" y="248" scale={0.92} skin={C.skin1} hair={C.hair1} skirt />
      {/* open book */}
      <g transform="translate(202 198) rotate(4)">
        <path d="M0,-10 L30,4 L30,32 L0,18 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <path d="M0,-10 L-30,4 L-30,32 L0,18 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <rect x="-2.5" y="4" width="5" height="22" rx="2" fill={C.magenta} />
        <circle cx="16" cy="20" r="3" fill={C.magentaLight} />
        <circle cx="-14" cy="18" r="3" fill={C.royalLight} />
      </g>
      <KidFigure x="252" y="248" scale={0.85} skin={C.skin3} hair={C.hair2} flip />
      <path d="M120,150 L136,166" stroke={C.royal} strokeWidth="6" strokeLinecap="round" />
      <path d="M286,140 L302,156" stroke={C.magenta} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
