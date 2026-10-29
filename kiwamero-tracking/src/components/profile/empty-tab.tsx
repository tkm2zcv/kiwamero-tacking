/** Honest placeholder for tracker.gg tabs this project has no data for. */
export function EmptyTab({ title, messageTitle, messageBody }: { title: string; messageTitle: string; messageBody: string }) {
  return (
    <section className="kt-card" aria-label={title}>
      <header className="kt-card-head">
        <h3 className="kt-card-title">{title}</h3>
      </header>
      <div className="kt-card-body kt-emptytab">
        <p className="kt-emptytab-title">{messageTitle}</p>
        <p className="kt-emptytab-text">{messageBody}</p>
      </div>
    </section>
  );
}
