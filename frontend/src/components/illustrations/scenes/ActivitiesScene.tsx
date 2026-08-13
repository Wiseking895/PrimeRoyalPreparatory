import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function ActivitiesScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* easel */}
      <rect x="128" y="196" width="8" height="46" rx="3" fill={C.inkSoft} />
      <rect x="244" y="196" width="8" height="46" rx="3" fill={C.inkSoft} />
      <rect x="128" y="224" width="124" height="8" rx="3" fill={C.inkSoft} />
      <rect x="138" y="112" width="104" height="82" rx="6" fill={C.white} stroke={C.creamDeep} strokeWidth="4" />
      <circle cx="176" cy="152" r="26" fill={C.magenta} opacity="0.85" />
      <path d="M204,130 L226,178 L182,178 Z" fill={C.royal} />
      <rect x="132" y="196" width="8" height="10" rx="3" fill={C.magentaDeep} />
      <KidFigure x="112" y="248" scale={0.88} skin={C.skin2} hair={C.hair3} flip />
      <KidFigure x="278" y="248" scale={0.88} skin={C.skin1} hair={C.hair1} backpack />
      <circle cx="330" cy="84" r="10" fill={C.royal} opacity="0.4" />
      <path d="M78,120 L94,136" stroke={C.magenta} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
