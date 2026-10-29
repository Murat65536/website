export interface WakaTimeItem {
  name: string;
  percent: number;
  hours: number;
  color: string;
}

import type { ChartData } from '../src/lib/chart';

/** The chart data shape is shared with the page that draws it. */
export type { ChartItem } from '../src/lib/chart';
export type WakaTimeChart = ChartData;

export interface WakaTimeStats {
  totalHours: number;
  dailyAverageHours: number;
  last30DaysHours: number;
  since: string;
  languages: WakaTimeItem[];
  editors: WakaTimeItem[];
  os: WakaTimeItem[];
  chart?: WakaTimeChart;
}

export interface ChessStats {
  username: string;
  url: string;
  rapid: string;
  blitz: string;
  bullet: string;
}

export interface GitHubStats {
  username: string;
  url: string;
  contributions: number;
}

export interface CodeforcesStats {
  handle: string;
  url: string;
  rating: number | string;
  maxRating: number | string;
  rank: string;
  maxRank: string;
  problemsSolved: number | string;
}

export interface SiteStats {
  wakatime?: WakaTimeStats;
  chess?: ChessStats;
  github?: GitHubStats;
  codeforces?: CodeforcesStats;
}
