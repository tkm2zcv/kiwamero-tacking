import { getRosterPage } from "./henrikdev.ts";
import { rememberMatch } from "./match-archive.ts";
import {
  claimRosterHistory, failRosterPage, finishRosterPage, queueRosterGaps,
  releaseCompletedRosterHistories,
  nextRosterRequest,
} from "./roster-history.ts";
import { HenrikDevError } from "./henrik-errors.ts";

export async function runRosterQueue(options: { maxPages?: number; until?: number } = {}) {
  const until = options.until ?? Date.now() + 30_000;
  const cap = Math.max(0, Math.min(20, options.maxPages ?? 10));
  const summary = { pages: 0, rosters: 0, unavailable: 0, failed: 0, deferred: 0 };
  await releaseCompletedRosterHistories();
  for (let i = 0; i < cap && Date.now() < until; i++) {
    const job = await claimRosterHistory();
    if (!job) break;
    try {
      const request = await nextRosterRequest(job);
      if (!request) {
        await finishRosterPage(job, 0, "");
        continue;
      }
      const page = await getRosterPage(job.region, job.puuid, request.start, request.size);
      // A cursor advances only after all usable rosters have been persisted.
      for (const match of page.matches) await rememberMatch(match);
      await finishRosterPage(job, page.received, page.fingerprint, request.start);
      summary.pages++;
      summary.rosters += page.matches.length;
      summary.unavailable += page.unavailable;
      await releaseCompletedRosterHistories();
    } catch (error) {
      await failRosterPage(job, error);
      if (error instanceof HenrikDevError && error.status === 429) { summary.deferred++; break; }
      summary.failed++;
    }
  }
  await queueRosterGaps();
  await releaseCompletedRosterHistories();
  return summary;
}
