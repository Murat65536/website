// Shared geometry and formatting for the coding activity chart. Used both at
// build time (initial SVG) and in the browser (date range slider, hover).

export const CHART_WIDTH = 680;
export const CHART_HEIGHT = 260;
export const CHART_PAD = { top: 15, right: 15, bottom: 25, left: 45 };

const PLOT_WIDTH = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
const DAY_MS = 1000 * 60 * 60 * 24;

export const CHART_CATEGORIES = ['languages', 'editors', 'os'] as const;
export type ChartCategory = (typeof CHART_CATEGORIES)[number];

export interface ChartItem {
  name: string;
  color: string;
}

/** `series[sample][item]` holds each item's cumulative hours at that sample date. */
export type CumulativeSeries = number[][];

/** The chart data stored in `src/data/stats.json` (written by `scripts/wakatime.ts`). */
export interface ChartData {
  dates: string[];
  /** Cumulative total coding hours at each sample date. */
  totals: number[];
  /** Per category, cumulative hours of each item at each sample date. */
  series: Record<ChartCategory, CumulativeSeries>;
  /** Per category, the charted items in order of all-time hours. */
  categories: Record<ChartCategory, ChartItem[]>;
}

export interface ChartTick {
  x: number;
  y: number;
  label: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface ChartView {
  /** Hours each item accumulated inside the window, indexed like the category's items. */
  itemHours: number[];
  /** All coding time inside the window, including time outside the charted items. */
  totalHours: number;
  maxVal: number;
  /** SVG line per item, each measured from zero; empty for hidden items. */
  paths: string[];
  xTicks: ChartTick[];
  yTicks: ChartTick[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Hours each item accumulated between samples `sIdx` and `j`. */
export function itemHoursBetween(series: CumulativeSeries, numItems: number, sIdx: number, j: number): number[] {
  const start = series[sIdx] ?? [];
  const end = series[j] ?? [];
  const hours: number[] = [];
  for (let i = 0; i < numItems; i++) {
    hours.push(Math.max(0, (end[i] ?? 0) - (start[i] ?? 0)));
  }
  return hours;
}

export function totalHoursBetween(totals: number[], sIdx: number, j: number): number {
  return Math.max(0, (totals[j] ?? 0) - (totals[sIdx] ?? 0));
}

export function xForSample(j: number, sIdx: number, eIdx: number): number {
  return round1(CHART_PAD.left + ((j - sIdx) / Math.max(1, eIdx - sIdx)) * PLOT_WIDTH);
}

export function yForHours(hours: number, maxVal: number): number {
  return round1(CHART_PAD.top + PLOT_HEIGHT - (hours / maxVal) * PLOT_HEIGHT);
}

/** Maps a pointer position (in SVG units) to the nearest sample index, or null outside the plot. */
export function sampleAtX(svgX: number, sIdx: number, eIdx: number): number | null {
  if (svgX < CHART_PAD.left || svgX > CHART_WIDTH - CHART_PAD.right) return null;
  const fraction = (svgX - CHART_PAD.left) / PLOT_WIDTH;
  return Math.max(sIdx, Math.min(eIdx, Math.round(sIdx + fraction * (eIdx - sIdx))));
}

/** Rounds a step up to the nearest 1, 2, 2.5 or 5 × 10ⁿ. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = [1, 2, 2.5, 5, 10].find((n) => fraction <= n) ?? 10;
  return nice * magnitude;
}

/** Axis top and gridline spacing for values up to `max`; the top always lands on a gridline. */
export function yScale(max: number): { maxVal: number; yStep: number } {
  const safeMax = Math.max(1, max);
  // About five gridlines, never closer than one hour apart
  const yStep = Math.max(1, niceStep(safeMax / 5));
  return { maxVal: Math.ceil(safeMax / yStep) * yStep, yStep };
}

function parseDate(dStr: string): Date {
  return new Date(dStr + 'T00:00:00');
}

export function formatMonthYear(dStr: string | undefined, year: 'numeric' | '2-digit' = 'numeric'): string {
  if (!dStr) return '';
  return parseDate(dStr).toLocaleDateString('en-US', { month: 'short', year });
}

/** Ranges up to this long label the x-axis with days instead of months. */
const DAY_LABELS_MAX_DAYS = 120;

function formatMonthDay(dStr: string | undefined): string {
  if (!dStr) return '';
  return parseDate(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(dStr: string): string {
  return parseDate(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatHours(hours: number): string {
  return `${Math.round(hours).toLocaleString('en-US')} hrs`;
}

export function formatHoursWithPercent(hours: number, totalHours: number): string {
  const pct = totalHours > 0 ? ((hours / totalHours) * 100).toFixed(1) : '0.0';
  return `${formatHours(hours)} (${pct}%)`;
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((parseDate(toDate).getTime() - parseDate(fromDate).getTime()) / DAY_MS);
}

export function formatRangeMeta(dates: string[], sIdx: number, eIdx: number, totalHours: number): string {
  const numDays = Math.max(1, daysBetween(dates[sIdx], dates[eIdx]));
  return `${formatHours(totalHours)} (~${(totalHours / numDays).toFixed(1)} hrs/day)`;
}

/**
 * Everything needed to draw one category's items as a line chart for the window `[sIdx, eIdx]`.
 * `hidden` items get no line, and the y-axis scales to the visible ones.
 */
export function computeChartView(
  dates: string[],
  totals: number[],
  series: CumulativeSeries,
  numItems: number,
  sIdx: number,
  eIdx: number,
  hidden: ReadonlySet<number> = new Set()
): ChartView {
  const itemHours = itemHoursBetween(series, numItems, sIdx, eIdx);
  const totalHours = totalHoursBetween(totals, sIdx, eIdx);
  const { maxVal, yStep } = yScale(Math.max(0, ...itemHours.filter((_, i) => !hidden.has(i))));

  const yTicks: ChartTick[] = [];
  for (let v = 0; v <= maxVal; v += yStep) {
    yTicks.push({ x: CHART_PAD.left - 7, y: yForHours(v, maxVal), label: `${v.toLocaleString('en-US')}h`, anchor: 'end' });
  }

  const tickIndices = [
    sIdx,
    sIdx + Math.floor((eIdx - sIdx) * 0.33),
    sIdx + Math.floor((eIdx - sIdx) * 0.66),
    eIdx,
  ];
  // Month labels would repeat on short ranges ("Sep 26, Sep 26, Oct 26"), so those get days
  const useDays = daysBetween(dates[sIdx], dates[eIdx]) <= DAY_LABELS_MAX_DAYS;
  const xTicks: ChartTick[] = tickIndices.map((idx, i) => ({
    x: xForSample(idx, sIdx, eIdx),
    y: CHART_HEIGHT - 6,
    label: useDays ? formatMonthDay(dates[idx]) : formatMonthYear(dates[idx], '2-digit'),
    anchor: i === 0 ? 'start' : i === tickIndices.length - 1 ? 'end' : 'middle',
  }));

  // This runs on every slider move, so it reads the series directly instead of allocating per day
  const start = series[sIdx] ?? [];
  const visible = Array.from({ length: numItems }, (_, i) => i).filter((i) => !hidden.has(i));
  const points: string[][] = Array.from({ length: numItems }, () => []);
  for (let j = sIdx; j <= eIdx; j++) {
    const x = xForSample(j, sIdx, eIdx);
    const row = series[j] ?? [];
    for (const i of visible) {
      points[i].push(`${x} ${yForHours(Math.max(0, (row[i] ?? 0) - (start[i] ?? 0)), maxVal)}`);
    }
  }
  const paths = points.map((p) => (p.length ? `M ${p.join(' L ')}` : ''));

  return { itemHours, totalHours, maxVal, paths, xTicks, yTicks };
}

/** SVG markup for the grid lines and labels of the y axis. */
export function yTicksSvg(ticks: ChartTick[]): string {
  return ticks
    .map(
      (t) =>
        `<g class="y-tick-row"><line x1="${CHART_PAD.left}" y1="${t.y}" x2="${CHART_WIDTH - CHART_PAD.right}" y2="${t.y}" stroke="var(--border-muted)" stroke-width="1" /><text x="${t.x}" y="${t.y + 3}" text-anchor="${t.anchor}" class="chart-tick-text">${t.label}</text></g>`
    )
    .join('');
}

/** SVG markup for the date labels of the x axis. */
export function xTicksSvg(ticks: ChartTick[]): string {
  return ticks
    .map((t) => `<text x="${t.x}" y="${t.y}" text-anchor="${t.anchor}" class="chart-tick-text">${t.label}</text>`)
    .join('');
}
