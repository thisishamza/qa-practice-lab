import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { findSecurityExercise } from '../data/securityExercises'
import { LabExerciseWorkspace } from '../features/labs/LabExerciseWorkspace'

export function SecurityExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findSecurityExercise(exerciseId) : undefined
  useDocumentTitle(exercise ? `Security exercise · ${exercise.title}` : 'Exercise not found')

  if (!exercise) {
    return (
      <div className="stack">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Security Testing', to: '/security' }, { label: 'Not found' }]} />
        <Callout tone="danger" title="No such practice exercise">
          The link may be outdated.{' '}
          <Link className="text-link" to="/security">Back to the exercise catalogue</Link>
        </Callout>
      </div>
    )
  }

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Security Testing', to: '/security' }, { label: exercise.title }]} />
      <PageHeader
        eyebrow={`Practice · ${exercise.difficulty} · ${exercise.estimatedMinutes} min`}
        title={exercise.title}
        description={exercise.summary}
      />
      <LabExerciseWorkspace exercise={exercise} />
    </div>
  )
}
