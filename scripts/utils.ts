import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteStats } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STATS_FILE = path.resolve(__dirname, '../src/data/stats.json');

// Try loading local .env if available
try {
  if (typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile();
  }
} catch {
  // .env file might not exist in CI/Cloudflare Pages
}

// Node gives each address only 250ms to connect before trying the next one. WakaTime has a single
// IPv4 address and no reachable IPv6 here, so a handshake slower than 250ms failed with ETIMEDOUT.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

/** `fetch` with a timeout, retrying connection-level failures (not timeouts or HTTP errors). */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000,
  retries = 1
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (attempt >= retries || controller.signal.aborted) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function loadExistingStats(): SiteStats {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveStats(stats: SiteStats): void {
  fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + '\n', 'utf-8');
}

/**
 * When `moduleUrl` is the script being run directly (e.g. `tsx scripts/github.ts`),
 * refreshes just that one section of the stats file.
 */
export function runStandalone<K extends keyof SiteStats>(
  moduleUrl: string,
  key: K,
  fetcher: (existing?: SiteStats[K]) => Promise<SiteStats[K] | undefined>
): void {
  if (!process.argv[1] || fileURLToPath(moduleUrl) !== path.resolve(process.argv[1])) return;
  const current = loadExistingStats();
  fetcher(current[key]).then((result) => {
    if (result) {
      current[key] = result;
      saveStats(current);
    }
  });
}
