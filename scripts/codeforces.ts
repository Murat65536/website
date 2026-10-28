import { fetchWithTimeout, loadExistingStats, saveStats } from './utils';
import type { CodeforcesStats } from './types';

function capitalize(s?: string): string {
  if (!s || s === '-') return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function fetchCodeforces(existing?: CodeforcesStats): Promise<CodeforcesStats | undefined> {
  const handle = 'Murat65536';
  try {
    const [infoRes, statusRes] = await Promise.all([
      fetchWithTimeout(`https://codeforces.com/api/user.info?handles=${handle}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Personal-Website' },
      }),
      fetchWithTimeout(`https://codeforces.com/api/user.status?handle=${handle}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Personal-Website' },
      }),
    ]);

    if (!infoRes.ok && !statusRes.ok) {
      throw new Error('Codeforces API returned error status');
    }

    const prev = existing || {
      handle,
      url: `https://codeforces.com/profile/${handle}`,
      rating: '-',
      maxRating: '-',
      rank: '-',
      maxRank: '-',
      problemsSolved: '-',
    };

    let rating: number | string = prev.rating;
    let maxRating: number | string = prev.maxRating;
    let rank: string = prev.rank;
    let maxRank: string = prev.maxRank;
    let problemsSolved: number | string = prev.problemsSolved;

    if (infoRes.ok) {
      const json = await infoRes.json();
      if (json.status === 'OK' && Array.isArray(json.result) && json.result[0]) {
        const u = json.result[0];
        rating = u.rating;
        maxRating = u.maxRating;
        rank = capitalize(u.rank);
        maxRank = capitalize(u.maxRank);
      }
    }

    if (statusRes.ok) {
      const json = await statusRes.json();
      if (json.status === 'OK' && Array.isArray(json.result)) {
        const solved = new Set<string>();
        for (const sub of json.result) {
          if (sub.verdict === 'OK' && sub.problem) {
            const id = `${sub.problem.contestId || ''}-${sub.problem.index}`;
            solved.add(id);
          }
        }
        problemsSolved = solved.size;
      }
    }

    const result: CodeforcesStats = {
      handle,
      url: `https://codeforces.com/profile/${handle}`,
      rating: rating ?? '-',
      maxRating: maxRating ?? '-',
      rank: rank ?? '-',
      maxRank: maxRank ?? '-',
      problemsSolved: problemsSolved ?? '-',
    };
    console.log('[stats] Successfully updated Codeforces stats');
    return result;
  } catch (err: any) {
    console.warn(`[stats] Failed to fetch Codeforces: ${err.message}; keeping existing stats`);
  }
  return existing;
}

// Standalone execution support
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))) {
  (async () => {
    const current = loadExistingStats();
    const cf = await fetchCodeforces(current.codeforces);
    if (cf) {
      current.codeforces = cf;
      saveStats(current);
    }
  })();
}
