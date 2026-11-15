import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionHeader } from '../components/ui/PageChrome'
import { Callout } from '../components/ui/Callout'

export function AboutPage() {
  useDocumentTitle('About this build')

  return (
    <div className="stack">
      <PageHeader
        eyebrow="About"
        title="About this build"
        description="QA Practice Lab is a learner-facing environment for practising software testing end to end. This page records what is real, what is planned, and how the lab is built."
      />

      <div className="split-grid">
        <section className="content-section" aria-labelledby="real-title">
          <SectionHeader
            id="real-title"
            title="What works today"
            description="The structure is real. The exercises are not."
          />
          <div className="panel">
            <p className="panel-note">
              Navigation, search, tracks, the scenario catalog, and the written guides
              are implemented and usable. The catalog supports filtering and carries a
              query in the URL, so a search can be linked or shared.
            </p>
            <p className="panel-note">
              Every catalog entry is a placeholder. Progress is not tracked or saved;
              the figures shown on the progress page are labelled sample data.
            </p>
          </div>
        </section>

        <section className="content-section" aria-labelledby="planned-title">
          <SectionHeader
            id="planned-title"
            title="What comes next"
            description="Runnable practice arrives in later phases."
          />
          <div className="panel">
            <p className="panel-note">
              Future phases add an original commerce application, API and database
              targets, accessibility and performance exercises, and scoring. Each target
              will be first-party, synthetic, and bounded by the project safety rules.
            </p>
            <div className="button-row">
              <Link className="button button-small" to="/tracks">
                Browse tracks
              </Link>
              <Link className="button button-secondary button-small" to="/scenarios">
                Open the catalog
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Callout tone="info" title="No AI service is required">
        The learning content, navigation, and scoring model are designed to work without
        an AI call. The only live API request in the current build is the platform
        health check.
      </Callout>
    </div>
  )
}
