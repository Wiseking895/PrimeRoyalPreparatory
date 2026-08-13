import {
  Award,
  Blocks,
  BookOpen,
  Compass,
  Dribbble,
  Eye,
  GraduationCap,
  HeartHandshake,
  Library,
  Lightbulb,
  MonitorSmartphone,
  School,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Target,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Maps string icon names (used in content data so records stay serializable)
 * to their Lucide component. Extend as new icons are needed.
 */
const iconMap: Record<string, LucideIcon> = {
  Award,
  Blocks,
  BookOpen,
  Compass,
  Dribbble,
  Eye,
  GraduationCap,
  HeartHandshake,
  Library,
  Lightbulb,
  MonitorSmartphone,
  School,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Target,
  Users,
}

interface DynamicIconProps {
  name: string
  className?: string
  strokeWidth?: number
  ariaHidden?: boolean
}

export function DynamicIcon({ name, className, strokeWidth = 2, ariaHidden = true }: DynamicIconProps) {
  const Icon = iconMap[name]
  if (!Icon) return null
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
}
