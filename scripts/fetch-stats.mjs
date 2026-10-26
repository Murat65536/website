import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_FILE = path.resolve(__dirname, '../src/data/stats.json');

if (process.env.SKIP_FETCH_STATS) {
  console.log('[stats] SKIP_FETCH_STATS is set. Skipping stats fetch.');
  process.exit(0);
}

// Try loading local .env if available
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // .env file might not exist in CI/Cloudflare Pages
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Load existing stats for fallback
let existingStats = {};
try {
  existingStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
} catch {
  existingStats = {};
}

const updatedStats = { ...existingStats };

async function fetchWakaTime() {
  const username = 'Murat65536';
  const shareIds = {
    languages: '96ceb506-0b7f-4b42-96a3-066ae1520e96',
    editors: '81539639-5de2-4428-9b2d-873a41e84357',
    os: '97e9bb7c-364b-4b70-bba4-e64a6c7c1cea',
    activity: '83e15580-d61a-411a-99df-a97b9707e3ad',
  };

  try {
    const [act, lang, edit, os] = await Promise.all([
      fetchWithTimeout(`https://wakatime.com/share/@${username}/${shareIds.activity}.json`).then((r) => r.json()),
      fetchWithTimeout(`https://wakatime.com/share/@${username}/${shareIds.languages}.json`).then((r) => r.json()),
      fetchWithTimeout(`https://wakatime.com/share/@${username}/${shareIds.editors}.json`).then((r) => r.json()),
      fetchWithTimeout(`https://wakatime.com/share/@${username}/${shareIds.os}.json`).then((r) => r.json()),
    ]);

    if (act?.days && lang?.data) {
      const days = act.days || [];
      const totalSeconds = days.reduce((sum, d) => sum + (d.total || 0), 0);
      const totalHours = Math.round(totalSeconds / 3600);
      const dailyAverageHours = days.length
        ? Number((totalSeconds / days.length / 3600).toFixed(1))
        : 0;
      const last30DaysSeconds = days
        .slice(-30)
        .reduce((sum, d) => sum + (d.total || 0), 0);
      const last30DaysHours = Math.round(last30DaysSeconds / 3600);

      // Top languages with 'Other'
      const rawLangs = lang.data || [];
      const topLangs = rawLangs.slice(0, 5).map((item) => ({
        name: item.name,
        percent: Number(item.percent.toFixed(1)),
        color: item.color,
      }));
      const langSum = topLangs.reduce((acc, item) => acc + item.percent, 0);
      const otherLangPct = Number(Math.max(0, 100 - langSum).toFixed(1));
      const languages = [
        ...topLangs,
        ...(otherLangPct > 0 ? [{ name: 'Other', percent: otherLangPct, color: '#6b7280' }] : []),
      ];

      // Top editors with 'Other'
      const rawEditors = edit.data || [];
      const topEditors = rawEditors.slice(0, 4).map((item) => ({
        name: item.name,
        percent: Number(item.percent.toFixed(1)),
        color: item.color,
      }));
      const editSum = topEditors.reduce((acc, item) => acc + item.percent, 0);
      const otherEditPct = Number(Math.max(0, 100 - editSum).toFixed(1));
      const editors = [
        ...topEditors,
        ...(otherEditPct > 0 ? [{ name: 'Other', percent: otherEditPct, color: '#6b7280' }] : []),
      ];

      const topOs = (os.data || []).slice(0, 3).map((item) => ({
        name: item.name,
        percent: Number(item.percent.toFixed(1)),
        color: item.color,
      }));

      let since = 'May 2024';
      if (days[0]?.date) {
        const d = new Date(days[0].date + 'T00:00:00');
        since = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (act.human_readable_range) {
        since = act.human_readable_range.replace(/^since\s+/i, '');
      }

      updatedStats.wakatime = {
        totalHours,
        dailyAverageHours,
        last30DaysHours,
        since,
        languages,
        editors,
        os: topOs,
      };
      console.log('[stats] Successfully updated WakaTime stats');
    }
  } catch (err) {
    console.warn(`[stats] Failed to fetch WakaTime: ${err.message}; keeping existing stats`);
  }
}

async function fetchLichess() {
  const username = 'Bobbybob65536';
  try {
    const res = await fetchWithTimeout(`https://lichess.org/api/user/${username}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const formatRating = (perf) => {
        if (!perf || !perf.games || perf.games === 0) return '—';
        return `${perf.rating}${perf.prov ? '?' : ''}`;
      };

      updatedStats.chess = {
        username: data.username || username,
        url: data.url || `https://lichess.org/@/${username}`,
        rapid: formatRating(data.perfs?.rapid),
        blitz: formatRating(data.perfs?.blitz),
        bullet: formatRating(data.perfs?.bullet),
      };
      console.log('[stats] Successfully updated Lichess stats');
    }
  } catch (err) {
    console.warn(`[stats] Failed to fetch Lichess: ${err.message}; keeping existing stats`);
  }
}

function capitalize(s) {
  if (!s || s === '—') return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchCodeforces() {
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

    let rating = null;
    let maxRating = null;
    let rank = null;
    let maxRank = null;
    let problemsSolved = null;

    if (infoRes.ok) {
      const json = await infoRes.json();
      if (json.status === 'OK' && Array.isArray(json.result) && json.result[0]) {
        const u = json.result[0];
        rating = u.rating;
        maxRating = u.maxRating;
        rank = u.rank;
        maxRank = u.maxRank;
      }
    }

    if (statusRes.ok) {
      const json = await statusRes.json();
      if (json.status === 'OK' && Array.isArray(json.result)) {
        const solved = new Set();
        for (const sub of json.result) {
          if (sub.verdict === 'OK' && sub.problem) {
            const id = `${sub.problem.contestId || ''}-${sub.problem.index}`;
            solved.add(id);
          }
        }
        problemsSolved = solved.size;
      }
    }

    const prev = existingStats.codeforces || {};
    updatedStats.codeforces = {
      handle,
      url: `https://codeforces.com/profile/${handle}`,
      rating: rating ?? prev.rating ?? '—',
      maxRating: maxRating ?? prev.maxRating ?? '—',
      rank: rank ? capitalize(rank) : (prev.rank ?? '—'),
      maxRank: maxRank ? capitalize(maxRank) : (prev.maxRank ?? '—'),
      problemsSolved: problemsSolved ?? prev.problemsSolved ?? '—',
    };
    console.log('[stats] Successfully updated Codeforces stats');
  } catch (err) {
    console.warn(`[stats] Failed to fetch Codeforces: ${err.message}; keeping existing stats`);
  }
}

async function fetchGitHub() {
  const username = 'Murat65536';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    console.log('[stats] GITHUB_TOKEN not set; keeping existing GitHub stats');
    return;
  }

  try {
    const res = await fetchWithTimeout('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Personal-Website',
      },
      body: JSON.stringify({
        query: `
          query($username: String!) {
            user(login: $username) {
              contributionsCollection {
                contributionCalendar {
                  totalContributions
                }
              }
            }
          }
        `,
        variables: { username },
      }),
    });

    if (!res.ok) {
      throw new Error(`Status ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }

    const total =
      json?.data?.user?.contributionsCollection?.contributionCalendar
        ?.totalContributions;

    if (typeof total === 'number') {
      updatedStats.github = {
        username,
        url: `https://github.com/${username}`,
        contributions: total,
      };
      console.log('[stats] Successfully updated GitHub stats');
    }
  } catch (err) {
    console.warn(`[stats] Failed to fetch GitHub: ${err.message}; keeping existing stats`);
  }
}

async function main() {
  console.log('[stats] Fetching latest stats from external APIs...');
  const start = Date.now();
  await Promise.allSettled([
    fetchWakaTime(),
    fetchLichess(),
    fetchCodeforces(),
    fetchGitHub(),
  ]);

  // Ensure default structure if empty
  if (!updatedStats.github) {
    updatedStats.github = { username: 'Murat65536', url: 'https://github.com/Murat65536', contributions: 1375 };
  }
  if (!updatedStats.chess) {
    updatedStats.chess = { username: 'Bobbybob65536', url: 'https://lichess.org/@/Bobbybob65536', rapid: '1798', blitz: '1618', bullet: '1754' };
  }
  if (!updatedStats.codeforces) {
    updatedStats.codeforces = { handle: 'Murat65536', url: 'https://codeforces.com/profile/Murat65536', rating: 1018, maxRating: 1165, rank: 'Newbie', maxRank: 'Newbie', problemsSolved: 179 };
  }

  fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(updatedStats, null, 2) + '\n', 'utf-8');
  console.log(`[stats] Saved stats to ${path.relative(process.cwd(), STATS_FILE)} in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

main().catch((err) => {
  console.error('[stats] Unexpected error in fetch-stats:', err);
  process.exit(0);
});
