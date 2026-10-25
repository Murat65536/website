import fallbackData from '../data/codeforces.json';

export interface CodeforcesStats {
  handle: string;
  url: string;
  rating: number | string;
  maxRating: number | string;
  rank: string;
  maxRank: string;
}

const HANDLE = 'Murat65536';

function capitalize(s?: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function getCodeforcesStats(): Promise<CodeforcesStats> {
  let data = fallbackData;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://codeforces.com/api/user.info?handles=${HANDLE}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Personal-Website',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'OK' && Array.isArray(json.result) && json.result[0]) {
        const u = json.result[0];
        data = {
          handle: u.handle || HANDLE,
          rating: u.rating ?? '—',
          maxRating: u.maxRating ?? '—',
          rank: capitalize(u.rank),
          maxRank: capitalize(u.maxRank),
        };
      }
    }
  } catch {
    // Graceful fallback to cached snapshot on network error or timeout
  }

  return {
    handle: data.handle || HANDLE,
    url: `https://codeforces.com/profile/${HANDLE}`,
    rating: data.rating ?? '—',
    maxRating: data.maxRating ?? '—',
    rank: typeof data.rank === 'string' ? capitalize(data.rank) : '—',
    maxRank: typeof data.maxRank === 'string' ? capitalize(data.maxRank) : '—',
  };
}
