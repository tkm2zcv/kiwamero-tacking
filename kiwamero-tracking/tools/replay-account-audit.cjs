// Replay a local durable-profile snapshot without DB, credentials or network.
const fs = require("node:fs");
const assert = require("node:assert/strict");

(async () => {
  const [snapshotPath, previousReportPath] = process.argv.slice(2);
  if (!snapshotPath) throw new Error("Usage: node tools/replay-account-audit.cjs snapshot.json [previous-report.json]");
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  assert.ok(snapshot.bundle?.profile && Array.isArray(snapshot.storedMatches), "Expected a decoded profile snapshot");
  const { buildAccountReport } = await import("../src/lib/account-report.ts");
  const { normalizeStoredMatches } = await import("../src/lib/stored-stats.ts");
  const report = buildAccountReport({ profile: snapshot.bundle.profile, seasons: snapshot.bundle.seasons,
    storedAll: normalizeStoredMatches(snapshot.storedMatches), rosterMatches: snapshot.bundle.matches,
    locale: "ja", generatedAt: snapshot.bundle.capturedAt });
  const previous = previousReportPath ? JSON.parse(fs.readFileSync(previousReportPath, "utf8")) : null;
  if (previous) {
    assert.equal(previous.generatedAt, report.generatedAt, "Compare reports captured at the same time");
    assert.deepEqual(previous.verdict, report.verdict, "Smurf diagnosis must stay unchanged");
  }
  console.log(JSON.stringify({
    capturedAt: snapshot.bundle.capturedAt, storedMatches: snapshot.storedMatches.length,
    previous: previous ? { score: previous.audit.score, grade: previous.audit.grade } : undefined,
    current: { score: report.audit.score, grade: report.audit.grade, breakdown: report.audit.breakdown,
      mode: report.audit.boundary ? "local" : "historical/current", capability: report.audit.capability,
      origin: report.audit.originShift },
    diagnosisUnchanged: previous ? true : undefined, externalRequests: 0,
  }, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
