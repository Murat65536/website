import path from 'node:path';
import { loadExistingStats, saveStats, STATS_FILE } from './utils';
import { fetchWakaTime } from './wakatime';
import { fetchLichess } from './lichess';
import { fetchCodeforces } from './codeforces';
import { fetchGitHub } from './github';

if (process.env.SKIP_FETCH_STATS) {
  console.log('[stats] SKIP_FETCH_STATS is set. Skipping stats fetch.');
  process.exit(0);
}

async function main(): Promise<void> {
  console.log('[stats] Fetching latest stats from external APIs...');
  const start = Date.now();
  const stats = loadExistingStats();

  const [wakaRes, lichessRes, cfRes, ghRes] = await Promise.allSettled([
    fetchWakaTime(stats.wakatime),
    fetchLichess(stats.chess),
    fetchCodeforces(stats.codeforces),
    fetchGitHub(stats.github),
  ]);

  if (wakaRes.status === 'fulfilled' && wakaRes.value) stats.wakatime = wakaRes.value;
  if (lichessRes.status === 'fulfilled' && lichessRes.value) stats.chess = lichessRes.value;
  if (cfRes.status === 'fulfilled' && cfRes.value) stats.codeforces = cfRes.value;
  if (ghRes.status === 'fulfilled' && ghRes.value) stats.github = ghRes.value;

  saveStats(stats);
  console.log(`[stats] Saved stats to ${path.relative(process.cwd(), STATS_FILE)} in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

main().catch((err) => {
  console.error('[stats] Unexpected error in fetch-stats:', err);
  process.exit(0);
});
