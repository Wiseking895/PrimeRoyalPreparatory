import { SceneBackdrop } from '../SceneBackdrop'
import { SceneFrame } from '../SceneFrame'
import { C } from '../illustration-colors'

export function CoreSubjectsScene() {
  return (
    <SceneFrame>
      <SceneBackdrop />
      {/* large open book */}
      <g transform="translate(200 176)">
        <path d="M0,-34 L74,4 L74,54 L0,16 Z" fill={C.white} stroke={C.royal} strokeWidth="3" />
        <path d="M0,-34 L-74,4 L-74,54 L0,16 Z" fill={C.white} stroke={C.royal} strokeWidth="3" />
        <rect x="-4" y="0" width="8" height="44" rx="3" fill={C.magenta} />
        <text x="30" y="34" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="22" fill={C.royal}>
          A+
        </text>
        <text x="-56" y="34" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="22" fill={C.magenta}>
          1+1
        </text>
        <circle cx="-20" cy="16" r="4" fill={C.royalLight} />
      </g>
      {/* pencil */}
      <g transform="translate(96 190) rotate(28)">
        <rect x="0" y="-5" width="56" height="10" rx="3" fill={C.magenta} />
        <path d="M56,-5 L72,0 L56,5 Z" fill={C.creamDeep} />
        <path d="M68,0 L72,0 L70,3 Z" fill={C.ink} />
      </g>
      <path d="M296,64 L312,80" stroke={C.magenta} strokeWidth="6" strokeLinecap="round" />
      <path d="M88,96 L104,112" stroke={C.royal} strokeWidth="6" strokeLinecap="round" />
    </SceneFrame>
  )
}
