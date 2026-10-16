export default function MetricsPage() {
  return (
    <div className="ct-page">
      <div className="ct-page-header">
        <span className="ct-page-title">Metrics</span>
      </div>

      <div className="ct-card ct-empty-state">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20h16" />
          <path d="M7 16v-4M12 16V7M17 16v-6" />
        </svg>
        <div className="ct-empty-state-cap">No trends yet</div>
        <div className="ct-empty-state-text">Weekly and monthly trends are coming soon.</div>
      </div>
    </div>
  )
}
