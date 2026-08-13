import type { ComponentType } from 'react'
import { ActivitiesScene } from './scenes/ActivitiesScene'
import { BuildingScene } from './scenes/BuildingScene'
import { CharacterScene } from './scenes/CharacterScene'
import { ClassroomScene } from './scenes/ClassroomScene'
import { CoreSubjectsScene } from './scenes/CoreSubjectsScene'
import { EarlyYearsScene } from './scenes/EarlyYearsScene'
import { ICTScene } from './scenes/ICTScene'
import { LearningScene } from './scenes/LearningScene'
import { PrimaryScene } from './scenes/PrimaryScene'
import { PupilsScene } from './scenes/PupilsScene'
import { SportsScene } from './scenes/SportsScene'

type SceneComponent = ComponentType<Record<string, never>>

const sceneMap: Record<string, SceneComponent> = {
  classroom: ClassroomScene,
  pupils: PupilsScene,
  building: BuildingScene,
  sports: SportsScene,
  learning: LearningScene,
  activities: ActivitiesScene,
  'early-years': EarlyYearsScene,
  ict: ICTScene,
  'core-subjects': CoreSubjectsScene,
  primary: PrimaryScene,
  character: CharacterScene,
}

interface SceneProps {
  name: string
  className?: string
}

/**
 * Resolves a scene key (used in content data) to its illustration.
 * Unknown keys fall back to the classroom scene rather than breaking the page.
 */
export function Scene({ name, className }: SceneProps) {
  const SceneComponent = sceneMap[name] ?? ClassroomScene
  return (
    <span className={`block ${className ?? ''}`} aria-hidden="true">
      <SceneComponent />
    </span>
  )
}
