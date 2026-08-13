import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function ICTScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* desk */}
      <rect x="110" y="196" width="180" height="12" rx="5" fill={C.creamDeep} stroke={C.inkSoft} strokeWidth="3" />
      <rect x="122" y="208" width="8" height="34" rx="3" fill={C.inkSoft} />
      <rect x="270" y="208" width="8" height="34" rx="3" fill={C.inkSoft} />
      {/* laptop */}
      <rect x="150" y="118" width="104" height="72" rx="8" fill={C.royal} />
      <rect x="158" y="126" width="88" height="56" rx="4" fill={C.white} />
      <rect x="168" y="136" width="16" height="34" rx="3" fill={C.magenta} />
      <rect x="190" y="136" width="16" height="26" rx="3" fill={C.royalLight} />
      <rect x="212" y="136" width="16" height="40" rx="3" fill={C.magentaLight} />
      <rect x="146" y="190" width="112" height="8" rx="4" fill={C.inkSoft} />
      <KidFigure x="122" y="238" scale={0.8} skin={C.skin1} hair={C.hair1} backpack />
      <circle cx="340" cy="80" r="10" fill={C.magenta} opacity="0.4" />
      <path d="M296,120 L312,136" stroke={C.royal} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
