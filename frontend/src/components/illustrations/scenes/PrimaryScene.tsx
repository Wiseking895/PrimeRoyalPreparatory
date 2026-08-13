import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function PrimaryScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      <KidFigure x="178" y="252" scale={1} skin={C.skin2} hair={C.hair3} backpack />
      <g transform="translate(222 204) rotate(5)">
        <path d="M0,-12 L26,2 L26,28 L0,14 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <path d="M0,-12 L-26,2 L-26,28 L0,14 Z" fill={C.white} stroke={C.royal} strokeWidth="2.5" />
        <rect x="-2.5" y="2" width="5" height="20" rx="2" fill={C.magenta} />
      </g>
      <KidFigure x="262" y="252" scale={0.85} skin={C.skin1} hair={C.hair1} flip skirt />
      {/* sun */}
      <circle cx="328" cy="70" r="18" fill={C.magenta} opacity="0.3" />
      <circle cx="328" cy="70" r="10" fill={C.magentaLight} />
      <path d="M108,120 L124,136" stroke={C.royal} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
