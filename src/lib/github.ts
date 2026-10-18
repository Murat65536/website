export interface GitHubStats {
  username: string;
  url: string;
  contributions: number;
}

const USERNAME = "Murat65536";

export async function getGitHubStats(): Promise<GitHubStats> {
  const token =
    import.meta.env.GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    import.meta.env.GH_TOKEN ||
    process.env.GH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN environment variable is required.");
  }

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Personal-Website",
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
      variables: { username: USERNAME },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `GitHub GraphQL API error: ${res.status} ${res.statusText}`,
    );
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  const total =
    json?.data?.user?.contributionsCollection?.contributionCalendar
      ?.totalContributions;

  return {
    username: USERNAME,
    url: `https://github.com/${USERNAME}`,
    contributions: total ?? 0,
  };
}
