import { learningTracks } from '../data/tracks'
import { getGuidesForTrack, guides } from '../data/guides'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { Callout } from '../components/ui/Callout'
import { SectionHeader } from '../components/ui/PageChrome'
import { Badge } from '../components/ui/Badge'
import { GuideCard } from '../features/guides/GuideCard'

export function GuidesPage() {
  useDocumentTitle('Guides')

  const groups = learningTracks
    .map((track) => ({
      track,
      trackGuides: getGuidesForTrack(track.id),
    }))
    .filter((group) => group.trackGuides.length > 0)

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Learning library"
        title="Guides"
        description="Practical introductions to each discipline: concepts, worked examples, step-by-step instructions, and the mistakes worth avoiding."
      />

      <Callout tone="info" title="Six introductory guides are available">
        Guides are grouped by discipline. More advanced guides will be added with the
        exercises they support; the structure already supports introduction, concepts,
        examples, steps, expected results, common mistakes, and related exercises.
      </Callout>

      <div className="guide-index-meta">
        <Badge tone="accent">{guides.length} guides</Badge>
        <Badge tone="neutral">{groups.length} disciplines covered</Badge>
      </div>

      {groups.map(({ track, trackGuides }) => (
        <section
          key={track.id}
          className="content-section"
          aria-labelledby={`guides-${track.id}`}
        >
          <SectionHeader
            id={`guides-${track.id}`}
            title={track.name}
            description={track.tagline}
          />
          <div className="guide-grid">
            {trackGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
