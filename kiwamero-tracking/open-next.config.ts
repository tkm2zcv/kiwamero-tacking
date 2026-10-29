import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 * Docs: node_modules/@opennextjs/cloudflare/README.md
 *
 * No R2/KV incremental cache is configured yet: pages are dynamic (ƒ) and the
 * data layer is a live HenrikDev fetch, so the default in-memory cache is enough
 * for the first release. Add `incrementalCache: r2IncrementalCache` together
 * with an R2 bucket binding if ISR/SSG caching is introduced.
 */
export default defineCloudflareConfig();
