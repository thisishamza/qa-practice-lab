import type { IconName } from '../data/types'

export interface NavItem {
  label: string
  to: string
  icon: IconName
  description: string
  end?: boolean
}

export const primaryNav: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: 'home',
    description: 'Overview, tracks, and recent activity',
    end: true,
  },
  {
    label: 'Learning tracks',
    to: '/tracks',
    icon: 'tracks',
    description: 'Twelve testing disciplines',
  },
  {
    label: 'Scenario catalog',
    to: '/scenarios',
    icon: 'scenarios',
    description: 'Search and filter every exercise',
  },
  {
    label: 'Guides',
    to: '/guides',
    icon: 'guides',
    description: 'Concepts, examples, and walkthroughs',
  },
  {
    label: 'Progress',
    to: '/progress',
    icon: 'progress',
    description: 'Demo progress and learning goals',
  },
  {
    label: 'Practice environment',
    to: '/practice',
    icon: 'practice',
    description: 'Runtime status and upcoming targets',
  },
]

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.end) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
