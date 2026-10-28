import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchWithTimeout, loadExistingStats, saveStats } from './utils';
import type {
  WakaTimeStats,
  WakaTimeItem,
  WakaTimeChart,
  StackedLayer,
} from './types';

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

export async function fetchWakaTime(existing?: WakaTimeStats): Promise<WakaTimeStats | undefined> {
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

      // Top languages with 'Other'
      const rawLangs: Array<{ name: string; percent: number; color?: string }> = lang.data || [];
      const topLangs: WakaTimeItem[] = rawLangs.slice(0, 5).map((item) => {
        const pct = Number(item.percent.toFixed(1));
        return {
          name: item.name,
          percent: pct,
          hours: Math.round((pct / 100) * totalHours),
          color: item.color || '#6b7280',
        };
      });
      const langSum = topLangs.reduce((acc, item) => acc + item.percent, 0);
      const otherLangPct = Number(Math.max(0, 100 - langSum).toFixed(1));
      const topHoursSum = topLangs.reduce((acc, item) => acc + item.hours, 0);
      const otherHours = Math.max(0, totalHours - topHoursSum);
      const languages: WakaTimeItem[] = [
        ...topLangs,
        ...(otherLangPct > 0 ? [{ name: 'Other', percent: otherLangPct, hours: otherHours, color: '#6b7280' }] : []),
      ];

      // Top editors with 'Other'
      const rawEditors: Array<{ name: string; percent: number; color?: string }> = edit.data || [];
      const topEditors: WakaTimeItem[] = rawEditors.slice(0, 4).map((item) => {
        const pct = Number(item.percent.toFixed(1));
        return {
          name: item.name,
          percent: pct,
          hours: Math.round((pct / 100) * totalHours),
          color: item.color || '#6b7280',
        };
      });
      const editSum = topEditors.reduce((acc, item) => acc + item.percent, 0);
      const otherEditPct = Number(Math.max(0, 100 - editSum).toFixed(1));
      const topEditHoursSum = topEditors.reduce((acc, item) => acc + item.hours, 0);
      const otherEditHours = Math.max(0, totalHours - topEditHoursSum);
      const editors: WakaTimeItem[] = [
        ...topEditors,
        ...(otherEditPct > 0 ? [{ name: 'Other', percent: otherEditPct, hours: otherEditHours, color: '#6b7280' }] : []),
      ];

      const rawOs: Array<{ name: string; percent: number; color?: string }> = os.data || [];
      const topOsItems: WakaTimeItem[] = rawOs.slice(0, 2).map((item) => {
        const pct = Number(item.percent.toFixed(1));
        return {
          name: item.name,
          percent: pct,
          hours: Math.round((pct / 100) * totalHours),
          color: item.color || '#6b7280',
        };
      });
      const osSum = topOsItems.reduce((acc, item) => acc + item.percent, 0);
      const otherOsPct = Number(Math.max(0, 100 - osSum).toFixed(1));
      const topOsHoursSum = topOsItems.reduce((acc, item) => acc + item.hours, 0);
      const otherOsHours = Math.max(0, totalHours - topOsHoursSum);
      const topOs: WakaTimeItem[] = [
        ...topOsItems,
        ...(otherOsPct > 0 ? [{ name: 'Other', percent: otherOsPct, hours: otherOsHours, color: '#6b7280' }] : []),
      ];

      let since = 'May 2024';
      if (days[0]?.date) {
        const d = new Date(days[0].date + 'T00:00:00');
        since = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (act.human_readable_range) {
        since = act.human_readable_range.replace(/^since\s+/i, '');
      }

      const categoryConfigs = [
        {
          key: 'languages' as const,
          field: 'languages',
          targets: languages,
        },
        {
          key: 'editors' as const,
          field: 'editors',
          targets: editors,
        },
        {
          key: 'os' as const,
          field: 'operating_systems',
          targets: topOs,
        },
      ];

      const existingCategories = existing?.chart?.categories || {
        languages: [],
        editors: [],
        os: [],
      };
      const existingSeries = existing?.chart?.series || {
        languages: [],
        editors: [],
        os: [],
      };

      const categoriesResult: {
        languages: StackedLayer[];
        editors: StackedLayer[];
        os: StackedLayer[];
      } = {
        languages: [...existingCategories.languages],
        editors: [...existingCategories.editors],
        os: [...existingCategories.os],
      };

      const seriesResult: {
        languages: number[][];
        editors: number[][];
        os: number[][];
      } = {
        languages: [...existingSeries.languages],
        editors: [...existingSeries.editors],
        os: [...existingSeries.os],
      };

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

      const width = 680;
      const height = 260;
      const pad = { top: 15, right: 15, bottom: 25, left: 45 };
      const plotWidth = width - pad.left - pad.right;
      const plotHeight = height - pad.top - pad.bottom;

      // Downsample to ~250 points for smooth SVG
      const sampleRate = Math.max(1, Math.floor(days.length / 250));
      const sampleIndices: number[] = [];
      for (let i = 0; i < days.length; i += sampleRate) {
        sampleIndices.push(i);
      }
      if (sampleIndices[sampleIndices.length - 1] !== days.length - 1) {
        sampleIndices.push(days.length - 1);
      }

      const totalCumBySample: number[] = [];
      let totalCumSecs = 0;
      let samplePointer = 0;

      for (let i = 0; i < days.length; i++) {
        totalCumSecs += days[i].total || 0;
        if (i === sampleIndices[samplePointer]) {
          totalCumBySample.push(totalCumSecs / 3600);
          samplePointer++;
        }
      }

      const finalTotalHours = totalCumSecs / 3600;
      const maxVal = Math.ceil(finalTotalHours / 500) * 500 || 3000;

      const numSamples = sampleIndices.length;
      const xCoords = sampleIndices.map((_, idx) =>
        Number((pad.left + (idx / (numSamples - 1)) * plotWidth).toFixed(1))
      );

      const getY = (val: number) =>
        Number((pad.top + plotHeight - (val / maxVal) * plotHeight).toFixed(1));

      // Build stacked layers for each category
      if (summaryDaysMap) {
        for (const cat of categoryConfigs) {
          const catCumHours = cat.targets.map(() => 0);
          const sampledLayerStack: number[][] = [];
          let sPtr = 0;

          for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const sDay = summaryDaysMap.get(day.date);
            const items: Array<{ name: string; total_seconds: number }> = (sDay as any)?.[cat.field] || [];
            let topSum = 0;
            const numTop = cat.targets.length - 1;

            for (let l = 0; l < numTop; l++) {
              const match = items.find((item) => item.name === cat.targets[l].name);
              const secs = match ? match.total_seconds : 0;
              topSum += secs;
              catCumHours[l] += secs / 3600;
            }
            const grandTotal = sDay?.grand_total?.total_seconds ?? day.total ?? 0;
            const otherSecs = Math.max(0, grandTotal - topSum);
            catCumHours[numTop] += otherSecs / 3600;

            if (i === sampleIndices[sPtr]) {
              let currentStack = 0;
              const levels = [0];
              for (let l = 0; l < cat.targets.length; l++) {
                currentStack += catCumHours[l];
                levels.push(currentStack);
              }
              sampledLayerStack.push(levels);
              sPtr++;
            }
          }

          if (sampledLayerStack.length === numSamples) {
            seriesResult[cat.key] = sampledLayerStack.map((levels) =>
              levels.map((v) => Number(v.toFixed(1)))
            );
            categoriesResult[cat.key] = cat.targets.map((target, lIdx) => {
              // Upper curve
              const upperPoints: string[] = [];
              for (let j = 0; j < numSamples; j++) {
                const x = xCoords[j];
                const y = getY(sampledLayerStack[j][lIdx + 1]);
                upperPoints.push(`${x} ${y}`);
              }

              // Lower curve in reverse
              const lowerPoints: string[] = [];
              for (let j = numSamples - 1; j >= 0; j--) {
                const x = xCoords[j];
                const y = getY(sampledLayerStack[j][lIdx]);
                lowerPoints.push(`${x} ${y}`);
              }

              const pathStr = `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
              const targetTotal = catCumHours[lIdx];
              const pct = Number(((targetTotal / (finalTotalHours || 1)) * 100).toFixed(1));

              return {
                name: target.name,
                color: target.color,
                totalHours: Math.round(targetTotal),
                percent: pct,
                path: pathStr,
              };
            });
          }
        }

        // Match exact hours from summaries to top items if available
        languages.forEach((l) => {
          const m = categoriesResult.languages.find((c) => c.name === l.name);
          if (m) l.hours = m.totalHours;
        });
        editors.forEach((e) => {
          const m = categoriesResult.editors.find((c) => c.name === e.name);
          if (m) e.hours = m.totalHours;
        });
        topOs.forEach((o) => {
          const m = categoriesResult.os.find((c) => c.name === o.name);
          if (m) o.hours = m.totalHours;
        });
      }

      // X ticks
      const xTickIndices = [
        0,
        Math.floor(days.length * 0.33),
        Math.floor(days.length * 0.66),
        days.length - 1,
      ];
      const formatDateTick = (dStr?: string) => {
        if (!dStr) return '';
        const date = new Date(dStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      };
      const xTicks = xTickIndices.map((idx, i) => {
        const x = Number((pad.left + (idx / (days.length - 1)) * plotWidth).toFixed(1));
        const anchor = i === 0 ? 'start' : (i === xTickIndices.length - 1 ? 'end' : 'middle');
        return {
          label: formatDateTick(days[idx]?.date),
          x,
          anchor,
        };
      });

      // Y ticks
      const yStep = maxVal >= 2500 ? 1000 : 500;
      const yTicks: Array<{ label: string; y: number }> = [];
      for (let v = 0; v <= maxVal; v += yStep) {
        yTicks.push({ label: `${v}h`, y: getY(v) });
      }

      const dates = sampleIndices.map((idx) => days[idx]?.date || '');

      const chart: WakaTimeChart = {
        width,
        height,
        dates,
        series: seriesResult,
        categories: categoriesResult,
        xTicks,
        yTicks,
      };

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

// Standalone execution support
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))) {
  const current = loadExistingStats();
  const wk = await fetchWakaTime(current.wakatime);
  if (wk) {
    current.wakatime = wk;
    saveStats(current);
  }
}
