import type { TestingCategory } from './types'

export const testingCategories: TestingCategory[] = [
  {
    id: 'functional',
    name: 'Functional correctness',
    description: 'Verify that user journeys and business rules behave as specified.',
    icon: 'check',
  },
  {
    id: 'exploratory',
    name: 'Exploratory & bug hunting',
    description: 'Investigate deliberately seeded defects with evidence-led sessions.',
    icon: 'bug',
  },
  {
    id: 'automation',
    name: 'Automation engineering',
    description: 'Design maintainable UI and API automation with reliable assertions.',
    icon: 'practice',
  },
  {
    id: 'data',
    name: 'Data & persistence',
    description: 'Check stored state, consistency, and recovery across records.',
    icon: 'database',
  },
  {
    id: 'integration',
    name: 'Contracts & integration',
    description: 'Keep services and consumers compatible as the system evolves.',
    icon: 'contract',
  },
  {
    id: 'nonfunctional',
    name: 'Performance & reliability',
    description: 'Measure latency, resilience, and graceful degradation under load.',
    icon: 'performance',
  },
  {
    id: 'security-access',
    name: 'Security & access',
    description: 'Test authentication, authorisation, and defensive input handling.',
    icon: 'security',
  },
  {
    id: 'accessibility',
    name: 'Accessibility & inclusion',
    description: 'Validate keyboard, screen-reader, and visual accessibility.',
    icon: 'accessibility',
  },
]

export const testingCategoriesById = new Map(
  testingCategories.map((category) => [category.id, category]),
)
