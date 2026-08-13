import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function ClassroomScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* chalkboard */}
      <rect x="58" y="44" width="284" height="116" rx="10" fill={C.royal} />
      <rect x="50" y="36" width="300" height="8" rx="4" fill={C.creamDeep} />
      <rect x="50" y="152" width="300" height="8" rx="4" fill={C.creamDeep} />
      <text
        x="200"
        y="98"
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="800"
        fontSize="34"
        fill={C.white}
      >
        A B C
      </text>
      <text
        x="200"
        y="136"
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="800"
        fontSize="34"
        fill={C.magentaLight}
      >
        1 2 3
      </text>
      {/* desk */}
      <rect x="150" y="196" width="104" height="12" rx="5" fill={C.creamDeep} stroke={C.inkSoft} strokeWidth="3" />
      <rect x="160" y="208" width="8" height="34" rx="3" fill={C.inkSoft} />
      <rect x="236" y="208" width="8" height="34" rx="3" fill={C.inkSoft} />
      <KidFigure x="128" y="238" scale={0.8} skin={C.skin2} hair={C.hair3} backpack />
      <KidFigure x="292" y="238" scale={0.8} skin={C.skin1} hair={C.hair1} flip />
      <circle cx="340" cy="60" r="8" fill={C.magenta} opacity="0.35" />
    </SceneFrame>
  )
}
