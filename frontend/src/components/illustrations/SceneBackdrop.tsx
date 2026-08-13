import { C } from './illustration-colors'

interface SceneBackdropProps {
  ground?: boolean
}

/**
 * Shared backdrop for scene illustrations: warm cream surface with soft brand
 * accents and subtle dots.
 */
export function SceneBackdrop({ ground = true }: SceneBackdropProps) {
  return (
    <>
      <rect width="400" height="300" rx="26" fill={C.creamCard} />
      <circle cx="42" cy="46" r="7" fill={C.creamDeep} />
      <circle cx="358" cy="64" r="11" fill={C.creamDeep} />
      <circle cx="330" cy="232" r="30" fill={C.royal} opacity="0.10" />
      <circle cx="72" cy="246" r="38" fill={C.magenta} opacity="0.10" />
      {ground ? (
        <ellipse cx="200" cy="252" rx="168" ry="30" fill={C.ink} opacity="0.05" />
      ) : null}
    </>
  )
}
