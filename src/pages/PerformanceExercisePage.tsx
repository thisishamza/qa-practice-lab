import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { findPerformanceExercise } from '../data/performanceExercises'
import { LabExerciseWorkspace } from '../features/labs/LabExerciseWorkspace'

export function PerformanceExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findPerformanceExercise(exerciseId) : undefined
  useDocumentTitle(exercise ? `Performance exercise · ${exercise.title}` : 'Exercise not found')

  if (!exercise) {
    return (
      <div className="stack">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Performance Testing', to: '/performance' }, { label: 'Not found' }]} />
        <h1 className="sr-only">Exercise not found</h1>
        <Callout tone="danger" title="No such practice exercise">
          The link may be outdated.{' '}
          <Link className="text-link" to="/performance">Back to the exercise catalogue</Link>
        </Callout>
      </div>
    )
  }

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Performance Testing', to: '/performance' }, { label: exercise.title }]} />
      <PageHeader
        eyebrow={`Practice · ${exercise.difficulty} · ${exercise.estimatedMinutes} min`}
        title={exercise.title}
        description={exercise.summary}
      />
      <LabExerciseWorkspace exercise={exercise} />
    </div>
  )
}
