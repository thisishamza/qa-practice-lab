import type { IconName } from '../data/types'

export interface NavItem {
  label: string
  to: string
  icon: IconName
  description: string
  end?: boolean
  /** Extra path prefixes that also mark this entry active (nested store routes). */
  alsoMatch?: string[]
}

export interface NavGroup {
  id: 'start' | 'practise' | 'labs' | 'practice-app' | 'my-work'
  label: string
  /** One plain line explaining what the group is — shown in sidebar and drawer. */
  note: string
  icon?: IconName
  items: NavItem[]
}

/**
 * Primary navigation, grouped by the learner's journey (R2 / redesign
 * recommendations §B). Labels were renamed label-only — routes and deep links
 * are unchanged. Keep groups to two levels (group → entry) and descriptions
 * plain enough for beginners while keeping direct access for experienced QA.
 */
export const navGroups: readonly NavGroup[] = [
  {
    id: 'start',
    label: 'Start',
    note: 'Orient yourself',
    items: [
      {
        label: 'Overview',
        to: '/',
        icon: 'home',
        description: 'Your next step in the lab',
        end: true,
      },
      {
        label: 'Learning paths',
        to: '/tracks',
        icon: 'tracks',
        description: 'Twelve testing disciplines',
      },
    ],
  },
  {
    id: 'practise',
    label: 'Practise',
    note: 'Guides and exercises',
    items: [
      {
        label: 'Exercises',
        to: '/scenarios',
        icon: 'scenarios',
        description: 'The scenario catalogue and every lab exercise',
      },
      {
        label: 'Guides',
        to: '/guides',
        icon: 'guides',
        description: 'Concepts, examples, and walkthroughs',
      },
    ],
  },
  {
    id: 'labs',
    label: 'Labs',
    note: 'The technical QA workbenches',
    items: [
      {
        label: 'API console',
        to: '/api-lab',
        icon: 'api',
        description: 'Send requests to the practice API',
      },
      {
        label: 'API reference',
        to: '/api-reference',
        icon: 'contract',
        description: 'The documented API contract',
      },
      {
        label: 'SQL playground',
        to: '/database',
        icon: 'database',
        description: 'Query the practice dataset in your browser',
      },
      {
        label: 'Contract testing',
        to: '/contract',
        icon: 'contract',
        description: 'Validate and diff API contracts',
      },
      {
        label: 'Performance testing',
        to: '/performance',
        icon: 'performance',
        description: 'Measured load testing, safely bounded',
      },
      {
        label: 'Security testing',
        to: '/security',
        icon: 'security',
        description: 'Synthetic security practice',
      },
      {
        label: 'Microservices & events',
        to: '/microservices',
        icon: 'microservices',
        description: 'Event-driven simulation and testing',
      },
    ],
  },
  {
    id: 'practice-app',
    label: 'Practice App',
    note: 'The fictional app under test — Meridian Outfitters',
    icon: 'shop',
    items: [
      {
        label: 'Meridian Storefront',
        to: '/shop',
        icon: 'shop',
        description: 'The app under test — browse the fictional catalogue',
      },
      {
        label: 'Cart',
        to: '/cart',
        icon: 'cart',
        description: 'Review your practice basket',
      },
      {
        label: 'Checkout',
        to: '/checkout',
        icon: 'cart',
        description: 'Simulated checkout — nothing is really paid',
      },
      {
        label: 'Customer account',
        to: '/account/orders',
        icon: 'user',
        alsoMatch: ['/orders'],
        description: 'The fictional shopper’s order history',
      },
    ],
  },
  {
    id: 'my-work',
    label: 'My work',
    note: 'Your learning record',
    items: [
      {
        label: 'Bug hunts',
        to: '/practice',
        icon: 'practice',
        description: 'Start a hunt and track your attempts',
      },
      {
        label: 'Progress',
        to: '/progress',
        icon: 'progress',
        description: 'Your attempts, scores and discoveries',
      },
      {
        label: 'Account',
        to: '/account',
        icon: 'user',
        end: true,
        description: 'Demo sign-in and your learning profile',
      },
    ],
  },
]

/** Flat list kept for places that need every primary destination (e.g. tests). */
export const primaryNav: NavItem[] = navGroups.flatMap((group) => group.items)

/** Deliberately separated utility destination — rendered at the foot of the shell. */
export const utilityNavItem: NavItem = {
  label: 'About & scoring',
  to: '/about',
  icon: 'info',
  description: 'How scoring works, and how the lab is built',
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const matches = (prefix: string) =>
    item.end ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`)

  if (matches(item.to)) {
    return true
  }

  return (item.alsoMatch ?? []).some((prefix) => matches(prefix))
}

/** Staff-only navigation entry — rendered only when the signed-in account has the staff role. */
export const staffNavItem: NavItem = {
  label: 'Inventory',
  to: '/admin/inventory',
  icon: 'grid',
  description: 'Staff-only stock controls',
}
