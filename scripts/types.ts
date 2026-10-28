export interface WakaTimeItem {
  name: string;
  percent: number;
  hours: number;
  color: string;
}

export interface StackedLayer {
  name: string;
  color: string;
  totalHours: number;
  percent: number;
  path: string;
}

export interface WakaTimeChart {
  width: number;
  height: number;
  xTicks: Array<{ label: string; x: number; anchor?: string }>;
  yTicks: Array<{ label: string; y: number }>;
  dates?: string[];
  series?: {
    languages: number[][];
    editors: number[][];
    os: number[][];
  };
  categories: {
    languages: StackedLayer[];
    editors: StackedLayer[];
    os: StackedLayer[];
  };
}

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
