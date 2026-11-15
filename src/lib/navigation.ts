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
    label: 'Overview',
    to: '/',
    icon: 'home',
    description: 'What to do next in the lab',
    end: true,
  },
  {
    label: 'Tracks',
    to: '/tracks',
    icon: 'tracks',
    description: 'Twelve testing disciplines',
  },
  {
    label: 'Catalog',
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
    label: 'Practice',
    to: '/practice',
    icon: 'practice',
    description: 'Runtime status and upcoming targets',
  },
  {
    label: 'Progress',
    to: '/progress',
    icon: 'progress',
    description: 'Demo progress and learning goals',
  },
  {
    label: 'Shop',
    to: '/shop',
    icon: 'shop',
    description: 'Meridian Outfitters practice storefront',
  },
  {
    label: 'Account',
    to: '/account',
    icon: 'user',
    description: 'Demo sign-in, profile and order history',
  },
]

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.end) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** Staff-only navigation entry — rendered only when the signed-in account has the staff role. */
export const staffNavItem: NavItem = {
  label: 'Inventory',
  to: '/admin/inventory',
  icon: 'grid',
  description: 'Staff-only stock controls',
}
