import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function EarlyYearsScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* blocks */}
      <rect x="196" y="196" width="42" height="42" rx="7" fill={C.royal} />
      <rect x="150" y="214" width="42" height="42" rx="7" fill={C.magenta} />
      <rect x="242" y="214" width="42" height="42" rx="7" fill={C.creamDeep} />
      {/* balloon */}
      <path d="M318,120 C318,88 288,88 288,120 C288,142 318,142 318,120 Z" fill={C.magenta} />
      <path d="M303,138 L303,196" stroke={C.inkSoft} strokeWidth="2" />
      <KidFigure x="120" y="252" scale={0.88} skin={C.skin1} hair={C.hair1} backpack />
      <KidFigure x="226" y="256" scale={0.8} skin={C.skin3} hair={C.hair2} flip skirt />
      <circle cx="78" cy="86" r="9" fill={C.royal} opacity="0.4" />
      <path d="M118,176 L134,192" stroke={C.royal} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
