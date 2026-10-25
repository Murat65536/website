import fallbackData from '../data/codeforces.json';

export interface CodeforcesStats {
  handle: string;
  url: string;
  rating: number | string;
  maxRating: number | string;
  rank: string;
  maxRank: string;
  problemsSolved: number | string;
}

const HANDLE = 'Murat65536';

function capitalize(s?: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function getCodeforcesStats(): Promise<CodeforcesStats> {
  const stats: CodeforcesStats = {
    handle: fallbackData.handle || HANDLE,
    url: `https://codeforces.com/profile/${HANDLE}`,
    rating: fallbackData.rating ?? '—',
    maxRating: fallbackData.maxRating ?? '—',
    rank: typeof fallbackData.rank === 'string' ? capitalize(fallbackData.rank) : '—',
    maxRank: typeof fallbackData.maxRank === 'string' ? capitalize(fallbackData.maxRank) : '—',
    problemsSolved: fallbackData.problemsSolved ?? '—',
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const [infoRes, statusRes] = await Promise.all([
      fetch(`https://codeforces.com/api/user.info?handles=${HANDLE}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'Personal-Website' },
      }).catch(() => null),
      fetch(`https://codeforces.com/api/user.status?handle=${HANDLE}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'Personal-Website' },
      }).catch(() => null),
    ]);
    clearTimeout(timer);

    if (infoRes && infoRes.ok) {
      const json = await infoRes.json();
      if (json.status === 'OK' && Array.isArray(json.result) && json.result[0]) {
        const u = json.result[0];
        stats.rating = u.rating ?? stats.rating;
        stats.maxRating = u.maxRating ?? stats.maxRating;
        stats.rank = capitalize(u.rank);
        stats.maxRank = capitalize(u.maxRank);
      }
    }

    if (statusRes && statusRes.ok) {
      const json = await statusRes.json();
      if (json.status === 'OK' && Array.isArray(json.result)) {
        const solved = new Set<string>();
        for (const sub of json.result) {
          if (sub.verdict === 'OK' && sub.problem) {
            const id = `${sub.problem.contestId || ''}-${sub.problem.index}`;
            solved.add(id);
          }
        }
        stats.problemsSolved = solved.size;
      }
    }
  } catch {
    // Graceful fallback to cached snapshot on network error or timeout
  }

  return stats;
}
