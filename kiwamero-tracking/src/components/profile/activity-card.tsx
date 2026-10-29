/** tracker.gg matches-tab ACTIVITY card: GitHub-style matches-per-day heatmap. */
export function ActivityCard({
  counts,
  capturedAt,
}: {
  counts: Map<string, number>;
  capturedAt: string;
}) {
  const end = new Date(capturedAt);
  end.setUTCHours(0, 0, 0, 0);
  // Show the last 8 weeks (56 days) ending on the most recent Saturday.
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 62);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday

  const weeks: { key: string; count: number; month: string }[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: { key: string; count: number; month: string }[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        week.push({
          key,
          count: counts.get(key) ?? 0,
          month: cursor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  const months: { label: string; span: number }[] = [];
  for (const week of weeks) {
    const label = week[0]?.month ?? "";
    const lastM = months[months.length - 1];
    if (lastM && lastM.label === label) lastM.span += 1;
    else months.push({ label, span: 1 });
  }

  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Activity</h2>
        <p className="v3-card__description">Last 60 days.</p>
      </header>
      <div className="v3-card__body kt-activity">
        <div className="kt-heat-months">
          {months.map((m, i) => (
            <span key={`${m.label}-${i}`} style={{ gridColumn: `span ${m.span}` }}>{m.label}</span>
          ))}
        </div>
        <div className="kt-heat">
          <div className="kt-heat-days">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="kt-heat-grid">
            {weeks.map((week, i) => (
              <div className="kt-heat-col" key={i}>
                {week.map((cell) => (
                  <span
                    key={cell.key}
                    className={`kt-heat-cell kt-heat-${intensity(cell.count)}`}
                    title={`${cell.key}: ${cell.count} matches`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="kt-heat-legend">
          <span>Matches Played</span>
          <span className="kt-heat-scale">
            <i className="kt-heat-cell kt-heat-0" /><i className="kt-heat-cell kt-heat-2" /><i className="kt-heat-cell kt-heat-3" /><i className="kt-heat-cell kt-heat-4" /><i className="kt-heat-cell kt-heat-5" />
          </span>
          <span className="kt-heat-nums">0&nbsp;&nbsp;3&nbsp;&nbsp;5&nbsp;&nbsp;8&nbsp;&nbsp;11</span>
        </div>
      </div>
    </div>
  );
}

function intensity(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 4;
  return 5;
}
