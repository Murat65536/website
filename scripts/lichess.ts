import { fetchWithTimeout, runStandalone } from './utils';
import type { ChessStats } from './types';

export async function fetchLichess(existing?: ChessStats): Promise<ChessStats | undefined> {
  const username = 'Bobbybob65536';
  try {
    const res = await fetchWithTimeout(`https://lichess.org/api/user/${username}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const formatRating = (perf?: { games?: number; rating?: number; prov?: boolean }) => {
        if (!perf || !perf.games || perf.games === 0) return '-';
        return `${perf.rating}${perf.prov ? '?' : ''}`;
      };

      const result: ChessStats = {
        username: data.username || username,
        url: data.url || `https://lichess.org/@/${username}`,
        rapid: formatRating(data.perfs?.rapid),
        blitz: formatRating(data.perfs?.blitz),
        bullet: formatRating(data.perfs?.bullet),
      };
      console.log('[stats] Successfully updated Lichess stats');
      return result;
    }
  } catch (err: any) {
    console.warn(`[stats] Failed to fetch Lichess: ${err.message}; keeping existing stats`);
  }
  return existing;
}

runStandalone(import.meta.url, 'chess', fetchLichess);
