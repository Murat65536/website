import { fetchWithTimeout, runStandalone } from './utils';
import type { GitHubStats } from './types';

export async function fetchGitHub(existing?: GitHubStats): Promise<GitHubStats | undefined> {
  const username = 'Murat65536';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token) {
    console.log('[stats] GITHUB_TOKEN not set; keeping existing GitHub stats');
    return existing;
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
      const result: GitHubStats = {
        username,
        url: `https://github.com/${username}`,
        contributions: total,
      };
      console.log('[stats] Successfully updated GitHub stats');
      return result;
    }
  } catch (err: any) {
    console.warn(`[stats] Failed to fetch GitHub: ${err.message}; keeping existing stats`);
  }
  return existing;
}

runStandalone(import.meta.url, 'github', fetchGitHub);
