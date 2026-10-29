import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchWithTimeout, runStandalone } from './utils';
import type { ChartItem, WakaTimeStats, WakaTimeItem, WakaTimeChart } from './types';

function getWakaTimeApiKey(): string | undefined {
  if (process.env.WAKATIME_API_KEY) return process.env.WAKATIME_API_KEY;
  try {
    const cfgPath = path.join(os.homedir(), '.wakatime.cfg');
    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf-8');
      const match = content.match(/api_key\s*=\s*(.+)/);
      if (match) return match[1].trim();
    }
  } catch {}
  return undefined;
}

const OTHER_COLOR = '#6b7280';
/** How many items per category the chart shows. */
const MAX_CHART_ITEMS = 5;

/** WakaTime's own catch-all buckets, which the chart leaves out. */
function isCatchAll(name: string): boolean {
  return name === 'Other' || name.startsWith('Unknown');
}

interface ShareItem {
  name: string;
  percent: number;
  color?: string;
}

/** The top `n` items of a WakaTime share, plus an 'Other' item covering the rest (including WakaTime's catch-alls). */
function topWithOther(raw: ShareItem[] = [], n: number, totalHours: number): { items: WakaTimeItem[]; numTop: number } {
  const top: WakaTimeItem[] = raw.filter((item) => !isCatchAll(item.name)).slice(0, n).map((item) => {
    const pct = Number(item.percent.toFixed(1));
    return {
      name: item.name,
      percent: pct,
      hours: Math.round((pct / 100) * totalHours),
      color: item.color || OTHER_COLOR,
    };
  });
  const otherPct = Number(Math.max(0, 100 - top.reduce((acc, item) => acc + item.percent, 0)).toFixed(1));
  const otherHours = Math.max(0, totalHours - top.reduce((acc, item) => acc + item.hours, 0));
  const items = otherPct > 0 ? [...top, { name: 'Other', percent: otherPct, hours: otherHours, color: OTHER_COLOR }] : top;
  return { items, numTop: top.length };
}

export async function fetchWakaTime(existing?: WakaTimeStats): Promise<WakaTimeStats | undefined> {
  const username = 'Murat65536';
  const shareIds = {
    languages: '96ceb506-0b7f-4b42-96a3-066ae1520e96',
    editors: '81539639-5de2-4428-9b2d-873a41e84357',
    os: '97e9bb7c-364b-4b70-bba4-e64a6c7c1cea',
    activity: '83e15580-d61a-411a-99df-a97b9707e3ad',
  };

  try {
    const fetchShare = async (id: string) => {
      const r = await fetchWithTimeout(`https://wakatime.com/share/@${username}/${id}.json`);
      if (!r.ok) throw new Error(`Share ${id} returned ${r.status} ${r.statusText}`);
      return r.json();
    };
    const [act, langShare, editorShare, osShare] = await Promise.all([
      fetchShare(shareIds.activity),
      fetchShare(shareIds.languages),
      fetchShare(shareIds.editors),
      fetchShare(shareIds.os),
    ]);

    const days: Array<{ date: string; total: number }> = act.days || [];
    if (days.length > 0) {
      const totalSeconds = days.reduce((sum, d) => sum + (d.total || 0), 0);
      const totalHours = Math.round(totalSeconds / 3600);
      const dailyAverageHours = days.length
        ? Number((totalSeconds / days.length / 3600).toFixed(1))
        : 0;
      const last30DaysSeconds = days
        .slice(-30)
        .reduce((sum, d) => sum + (d.total || 0), 0);
      const last30DaysHours = Math.round(last30DaysSeconds / 3600);

      const since = new Date(days[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const categoryConfigs = [
        { key: 'languages' as const, field: 'languages', share: langShare.data, ...topWithOther(langShare.data, 5, totalHours) },
        { key: 'editors' as const, field: 'editors', share: editorShare.data, ...topWithOther(editorShare.data, 4, totalHours) },
        { key: 'os' as const, field: 'operating_systems', share: osShare.data, ...topWithOther(osShare.data, 2, totalHours) },
      ];
      const [languages, editors, topOs] = categoryConfigs.map((cat) => cat.items);

      const apiKey = getWakaTimeApiKey();
      let summaryDaysMap: Map<string, any> | null = null;

      if (apiKey) {
        try {
          const auth = Buffer.from(apiKey).toString('base64');
          const today = new Date().toISOString().slice(0, 10);
          const years = [...new Set(days.map((d) => d.date.slice(0, 4)))];
          const responses = await Promise.all(
            years.map((y) =>
              fetchWithTimeout(
                `https://wakatime.com/api/v1/users/current/summaries?start=${y}-01-01&end=${y === today.slice(0, 4) ? today : `${y}-12-31`}`,
                { headers: { Authorization: `Basic ${auth}` } },
                10000
              ).then((r) => r.ok ? r.json() : null).catch(() => null)
            )
          );
          const allSummaries = responses.flatMap((r) => r?.data || []);
          if (allSummaries.length) {
            summaryDaysMap = new Map(allSummaries.map((s) => [s.range.date, s]));
            console.log(`[stats] Fetched WakaTime summaries for ${allSummaries.length} days`);
          }
        } catch (e: any) {
          console.warn(`[stats] Failed to fetch WakaTime summaries: ${e.message}`);
        }
      }

      // Without per-day summaries there is no breakdown to chart, so keep the previous chart
      // (as long as it's in the current format)
      let chart = existing?.chart?.totals ? existing.chart : undefined;
      if (summaryDaysMap) {
        // One point per day
        const totals: number[] = [];
        let cumTotalHours = 0;
        for (const day of days) {
          cumTotalHours += (summaryDaysMap.get(day.date)?.grand_total?.total_seconds ?? day.total ?? 0) / 3600;
          totals.push(Number(cumTotalHours.toFixed(1)));
        }

        const series: WakaTimeChart['series'] = { languages: [], editors: [], os: [] };
        const categories: WakaTimeChart['categories'] = { languages: [], editors: [], os: [] };

        for (const cat of categoryConfigs) {
          // The chart shows each item separately rather than lumping the rest into "Other", so it gets its own item list
          const chartItems: ChartItem[] = (cat.share || [])
            .filter((item: ShareItem) => !isCatchAll(item.name))
            .slice(0, MAX_CHART_ITEMS)
            .map((item: ShareItem) => ({ name: item.name, color: item.color || OTHER_COLOR }));
          const chartCumHours = chartItems.map(() => 0);
          const statsCumHours = cat.items.map(() => 0);
          const daily: number[][] = [];

          for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const sDay = summaryDaysMap.get(day.date);
            const secsByName = new Map<string, number>(
              ((sDay as any)?.[cat.field] || []).map((item: { name: string; total_seconds: number }) => [item.name, item.total_seconds])
            );

            chartItems.forEach((item, l) => {
              chartCumHours[l] += (secsByName.get(item.name) ?? 0) / 3600;
            });

            let topSum = 0;
            for (let l = 0; l < cat.numTop; l++) {
              const secs = secsByName.get(cat.items[l].name) ?? 0;
              topSum += secs;
              statsCumHours[l] += secs / 3600;
            }
            if (cat.items.length > cat.numTop) {
              const grandTotal = sDay?.grand_total?.total_seconds ?? day.total ?? 0;
              statsCumHours[cat.numTop] += Math.max(0, grandTotal - topSum) / 3600;
            }

            daily.push(chartCumHours.map((h) => Number(h.toFixed(1))));
          }

          series[cat.key] = daily;
          categories[cat.key] = chartItems;
          // Prefer exact hours from the summaries over hours derived from share percentages
          cat.items.forEach((item, l) => {
            item.hours = Math.round(statsCumHours[l]);
          });
        }

        chart = {
          dates: days.map((day) => day.date),
          totals,
          series,
          categories,
        };
      }

      const result: WakaTimeStats = {
        totalHours,
        dailyAverageHours,
        last30DaysHours,
        since,
        languages,
        editors,
        os: topOs,
        chart,
      };
      console.log('[stats] Successfully updated WakaTime stats');
      return result;
    }
  } catch (err: any) {
    console.warn(`[stats] Failed to fetch WakaTime: ${err.message}; keeping existing stats`);
  }
  return existing;
}

runStandalone(import.meta.url, 'wakatime', fetchWakaTime);
