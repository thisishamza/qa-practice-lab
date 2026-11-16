import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Breadcrumbs } from '../components/ui/PageChrome'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { findSqlExercise } from '../data/sqlExercises'
import { ExerciseWorkspace } from '../features/database/ExerciseWorkspace'

export function DatabaseExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const exercise = exerciseId ? findSqlExercise(exerciseId) : null
  useDocumentTitle(exercise ? exercise.title : 'Exercise not found')

  if (!exercise) {
    return (
      <div className="stack">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Database Testing', to: '/database' },
            { label: 'Exercise not found' },
          ]}
        />
        <Callout tone="danger" title="No such practice exercise">
          The link may be outdated.{' '}
          <Link className="text-link" to="/database">
            Back to the exercise catalogue
          </Link>
        </Callout>
      </div>
    )
  }

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Database Testing', to: '/database' },
          { label: exercise.title },
        ]}
      />
      <PageHeader
        eyebrow={`Practice · ${exercise.difficulty}`}
        title={exercise.title}
        description={exercise.summary}
      />
      <ExerciseWorkspace exercise={exercise} />
    </div>
  )
}
