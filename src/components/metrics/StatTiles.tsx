import type { RangeStats } from '../../utils/metrics'
import { comma } from '../../utils/metrics'

const DASH = '—'

function Tile({ label, value, cap }: { label: string; value: string; cap: string }) {
  return (
    <div className="ct-stat">
      <div className="ct-stat-label">{label}</div>
      <div className="ct-stat-num">{value}</div>
      <div className="ct-stat-cap">{cap}</div>
    </div>
  )
}

/** Four LCD readouts summarising the selected week or month. */
export default function StatTiles({ stats }: { stats: RangeStats }) {
  const empty = stats.logged === 0
  return (
    <div className="ct-stats">
      <Tile
        label="Avg / day"
        value={empty || stats.avg === null ? DASH : comma(stats.avg)}
        cap={stats.avgGoal ? `vs ${comma(stats.avgGoal)} goal` : 'kcal'}
      />
      <Tile
        label="On target"
        value={empty ? DASH : `${stats.onTarget} / ${stats.logged}`}
        cap="days"
      />
      <Tile
        label="Logged"
        value={empty ? DASH : `${stats.logged} / ${stats.days}`}
        cap="days"
      />
      <Tile
        label="Total"
        value={empty ? DASH : comma(stats.total)}
        cap="kcal"
      />
    </div>
  )
}
