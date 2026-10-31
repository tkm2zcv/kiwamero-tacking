import type { CSSProperties } from "react";

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`kt-skel ${className}`} style={style} aria-hidden="true" />;
}

function SkeletonCard({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <section className="kt-card kt-skel-card">
      {title ? (
        <div className="kt-card-head">
          <Bone className="kt-skel--card-title" />
          <Bone className="kt-skel--card-desc" />
        </div>
      ) : null}
      <div className="kt-card-body">
        {Array.from({ length: rows }, (_, i) => (
          <div className="kt-skel-row" key={i}>
            <Bone className="kt-skel--thumb" />
            <Bone className="kt-skel--grow" />
            <Bone className="kt-skel--value" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="kt-skel-section" role="status" aria-busy="true" aria-label="Loading section">
      <span className="sr-only">Loading section…</span>
      <SkeletonCard rows={rows} />
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="v3-report kt-skel-report" role="status" aria-busy="true" aria-label="Loading report">
      <span className="sr-only">Loading report…</span>
      <div className="kt-skel-report-side">
        <section className="v3-card">
          <Bone className="kt-skel--card-title" />
          <Bone className="kt-skel--score" />
          <Bone className="kt-skel--line" />
          <Bone className="kt-skel--line kt-skel--short" />
        </section>
        <section className="v3-card">
          <Bone className="kt-skel--card-title" />
          <Bone className="kt-skel--bar" />
          <Bone className="kt-skel--bar" />
          <Bone className="kt-skel--bar" />
        </section>
      </div>
      <div className="kt-skel-report-main">
        {Array.from({ length: 3 }, (_, i) => (
          <section className="v3-card" key={i}>
            <Bone className="kt-skel--card-title" />
            <Bone className="kt-skel--table" />
          </section>
        ))}
      </div>
    </div>
  );
}

export function ProfileRouteSkeleton() {
  return (
    <div className="kt-container kt-loading" role="status" aria-busy="true" aria-label="Loading profile">
      <span className="sr-only">Loading profile…</span>
      <div className="kt-hero-wrap kt-hero-wrap--loading">
        <div className="kt-hero kt-hero--loading">
          <div className="kt-hero-extra" aria-hidden="true">
            <Bone className="kt-skel--peak" />
          </div>
          <div className="kt-hero-body">
            <div className="kt-hero-identity">
              <Bone className="kt-hero-avatar kt-skel--avatar" />
              <div className="kt-hero-names">
                <Bone className="kt-skel--views" />
                <div className="kt-hero-name-row">
                  <Bone className="kt-skel--name" />
                  <Bone className="kt-skel--tag" />
                </div>
                <div className="kt-hero-chips">
                  {Array.from({ length: 3 }, (_, i) => <Bone className="kt-skel--chip" key={i} />)}
                </div>
              </div>
              <div className="kt-hero-actions">
                <Bone className="kt-skel--action" />
                <Bone className="kt-skel--action" />
              </div>
            </div>
            <nav className="kt-tabs" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => <Bone className="kt-skel--tab" key={i} />)}
            </nav>
          </div>
        </div>
      </div>

      <div className="kt-filters" aria-hidden="true">
        <div className="kt-seg kt-seg--outline kt-skel-seg">
          <Bone className="kt-skel--seg-btn" />
          <Bone className="kt-skel--seg-btn" />
        </div>
        <div className="kt-seg kt-seg--outline kt-skel-seg">
          <Bone className="kt-skel--seg-btn" />
          <Bone className="kt-skel--seg-btn" />
          <Bone className="kt-skel--seg-btn" />
        </div>
        <div className="kt-col-3">
          <div className="kt-seg kt-seg--outline kt-skel-seg">
            {Array.from({ length: 5 }, (_, i) => <Bone className="kt-skel--seg-btn" key={i} />)}
          </div>
        </div>
      </div>

      <div className="kt-columns">
        <aside className="kt-sidebar" aria-hidden="true">
          <section className="kt-card kt-skel-card kt-skel-rating">
            <div className="kt-card-head"><Bone className="kt-skel--card-title" /></div>
            <div className="kt-card-body">
              <div className="kt-skel-rating-row"><Bone className="kt-skel--rank" /><Bone className="kt-skel--rating" /></div>
              <div className="kt-skel-rating-row"><Bone className="kt-skel--rank" /><Bone className="kt-skel--rating" /></div>
            </div>
          </section>
          <SkeletonCard rows={5} />
          <SkeletonCard rows={4} />
        </aside>
        <div className="kt-maincol" aria-hidden="true">
          <section className="kt-card kt-skel-card kt-skel-highlight">
            <div className="kt-card-head">
              <Bone className="kt-skel--card-title" />
              <Bone className="kt-skel--card-desc" />
            </div>
            <div className="kt-card-body">
              <Bone className="kt-skel--kicker" />
              <div className="kt-skel-stat-grid">
                {Array.from({ length: 7 }, (_, i) => (
                  <div className="kt-skel-stat" key={i}><Bone className="kt-skel--label" /><Bone className="kt-skel--number" /></div>
                ))}
              </div>
            </div>
          </section>
          <div className="kt-skel-tile-grid">
            {Array.from({ length: 6 }, (_, i) => <Bone className="kt-skel--tile" key={i} />)}
          </div>
          <SkeletonCard rows={8} />
        </div>
      </div>
    </div>
  );
}
