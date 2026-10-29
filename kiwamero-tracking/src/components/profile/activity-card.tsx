/** tracker.gg ACTIVITY card — verbatim v3-card/heatmap DOM (Playtime only). */
export function ActivityCard({
  counts,
  capturedAt,
}: {
  counts: Map<string, number>;
  capturedAt: string;
}) {
  const end = new Date(capturedAt);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 62);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // back to Sunday

  const weeks: { key: string; count: number; month: string; inRange: boolean }[][] = [];
  const cursor = new Date(start);
  const windowStart = new Date(end);
  windowStart.setUTCDate(windowStart.getUTCDate() - 59);
  while (cursor <= end) {
    const week: { key: string; count: number; month: string; inRange: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().slice(0, 10);
      week.push({
        key,
        count: counts.get(key) ?? 0,
        month: cursor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        inRange: cursor >= windowStart && cursor <= end,
      });
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

  const max = Math.max(1, ...weeks.flat().map((cell) => cell.count));
  const opacityFor = (count: number) => (count > 0 ? 0.25 + 0.75 * (count / max) : 0.25);
  const dayBg = (count: number) => (count > 0 ? "var(--color-action)" : "rgb(204, 204, 204)");

  const legendStops = [0, ...new Set([max * 0.2, max * 0.5, max * 0.7, max].map((v) => Math.round(v)))];

  return (
    <div className="v3-card activity-heatmaps" title-slug="valorant">
      <header className="v3-card__header">
        <h2 className="v3-card__title"> Activity </h2>
        <span className="v3-card__description">Last 60 days.</span>
      </header>
      <div className="v3-card__body v3-card__body--v2.5">
        <div className="heatmap pb-8">
          <div className="heatmap__grid">
            <div className="grid">
              <div className="month-info" style={{ marginLeft: 32 }}>
                {months.map((m, i) => (
                  <div key={`${m.label}-${i}`} style={{ width: m.span * 24 }}>
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="container">
                <div className="day-info">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="blocks">
                  {weeks.map((week, i) => (
                    <div className="week" key={i}>
                      {week.map((cell) =>
                        cell.inRange ? (
                          <div
                            className="day"
                            key={cell.key}
                            title={`${cell.key}: ${cell.count} matches`}
                            style={{ background: dayBg(cell.count), opacity: opacityFor(cell.count) }}
                          />
                        ) : (
                          <div className="day day--empty" key={cell.key} />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="color-info">
            <span>Matches Played</span>
            {legendStops.map((stop) => (
              <div key={stop}>
                <div className="day" style={{ background: dayBg(stop), opacity: opacityFor(stop) }} />
                <span>{stop}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
