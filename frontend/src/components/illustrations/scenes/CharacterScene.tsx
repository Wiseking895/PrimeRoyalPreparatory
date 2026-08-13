import { KidFigure } from '../KidFigure'
import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function CharacterScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      <KidFigure x="188" y="252" scale={0.98} skin={C.skin3} hair={C.hair1} />
      {/* heart */}
      <g transform="translate(212 196)">
        <path
          d="M0,16 C-6,8 -26,2 -26,-12 C-26,-24 -12,-26 -4,-16 C0,-11 0,-9 0,-6 C0,-9 0,-11 4,-16 C12,-26 26,-24 26,-12 C26,2 6,8 0,16 Z"
          fill={C.magenta}
        />
      </g>
      {/* sparkles */}
      <path d="M120,136 L128,136 L128,128 L128,136 L136,136 L136,136 L128,136 L128,144 L128,136 Z" fill={C.royal} />
      <path d="M302,120 L310,120 L310,112 L310,120 L318,120 L318,120 L310,120 L310,128 L310,120 Z" fill={C.magenta} />
      <circle cx="70" cy="92" r="9" fill={C.royal} opacity="0.4" />
      <circle cx="330" cy="184" r="8" fill={C.magenta} opacity="0.4" />
    </SceneFrame>
  )
}
