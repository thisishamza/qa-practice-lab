import { learningTracks } from '../data/tracks'
import { getGuidesForTrack, guides } from '../data/guides'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
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
        description="Practical introductions to each testing discipline: concepts, worked examples, step-by-step instructions, and the mistakes worth avoiding. Read in any order — each guide is self-contained."
      />

      <p className="guides-note">
        {guides.length} guides across {groups.length} disciplines — all readable today.
        The exercises they support are labelled with their own availability on the
        scenarios page.
      </p>

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
          <div className="guide-list">
            {trackGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
