import fallbackData from '../data/lichess.json';

export interface LichessRatings {
  username: string;
  url: string;
  rapid: string;
  blitz: string;
  bullet: string;
}

const USERNAME = 'Bobbybob65536';

export async function getLichessStats(): Promise<LichessRatings> {
  let data = fallbackData;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://lichess.org/api/user/${USERNAME}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      data = await res.json();
    }
  } catch {
    // Graceful fallback to cached snapshot on network error or timeout
  }

  const formatRating = (perf?: { games?: number; rating?: number; prov?: boolean }) => {
    if (!perf || !perf.games || perf.games === 0) return '—';
    return `${perf.rating}${perf.prov ? '?' : ''}`;
  };

  return {
    username: data.username || USERNAME,
    url: data.url || `https://lichess.org/@/${USERNAME}`,
    rapid: formatRating(data.perfs?.rapid),
    blitz: formatRating(data.perfs?.blitz),
    bullet: formatRating(data.perfs?.bullet),
  };
}
