import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { findEventExercise } from '../data/eventExercises'
import { LabExerciseWorkspace } from '../features/labs/LabExerciseWorkspace'

export function MicroservicesExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findEventExercise(exerciseId) : undefined
  useDocumentTitle(exercise ? `Microservices exercise · ${exercise.title}` : 'Exercise not found')

  if (!exercise) {
    return (
      <div className="stack">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Microservices & Event-Driven Testing', to: '/microservices' }, { label: 'Not found' }]} />
        <h1 className="sr-only">Exercise not found</h1>
        <Callout tone="danger" title="No such practice exercise">
          The link may be outdated.{' '}
          <Link className="text-link" to="/microservices">Back to the exercise catalogue</Link>
        </Callout>
      </div>
    )
  }

  return (
    <div className="stack">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Microservices & Event-Driven Testing', to: '/microservices' }, { label: exercise.title }]} />
      <PageHeader
        eyebrow={`Practice · ${exercise.difficulty} · ${exercise.estimatedMinutes} min`}
        title={exercise.title}
        description={exercise.summary}
      />
      <LabExerciseWorkspace exercise={exercise} />
    </div>
  )
}
