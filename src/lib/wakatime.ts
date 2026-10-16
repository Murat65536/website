import fallbackData from "../data/wakatime.json";

export interface WakaTimeDay {
  date: string;
  total: number;
}

export interface WakaTimeItem {
  name: string;
  percent: number;
  color: string;
}

export interface WakaTimeStats {
  totalHours: number;
  dailyAverageHours: number;
  last30DaysHours: number;
  since: string;
  rangeLabel: string;
  languages: WakaTimeItem[];
  editors: WakaTimeItem[];
  os: WakaTimeItem[];
  chart: {
    linePath: string;
    areaPath: string;
    width: number;
    height: number;
    xTicks: { label: string; x: number }[];
    yTicks: { label: string; y: number }[];
  };
}

const CONFIG = {
  USERNAME: "Murat65536",
  SHARE_IDS: {
    languages: "96ceb506-0b7f-4b42-96a3-066ae1520e96",
    editors: "81539639-5de2-4428-9b2d-873a41e84357",
    os: "97e9bb7c-364b-4b70-bba4-e64a6c7c1cea",
    activity: "83e15580-d61a-411a-99df-a97b9707e3ad",
  },
};

export async function getWakaTimeStats(): Promise<WakaTimeStats> {
  let rawData = fallbackData;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const [act, lang, edit, os] = await Promise.all([
      fetch(
        `https://wakatime.com/share/@${CONFIG.USERNAME}/${CONFIG.SHARE_IDS.activity}.json`,
        { signal: controller.signal },
      ).then((r) => r.json()),
      fetch(
        `https://wakatime.com/share/@${CONFIG.USERNAME}/${CONFIG.SHARE_IDS.languages}.json`,
        { signal: controller.signal },
      ).then((r) => r.json()),
      fetch(
        `https://wakatime.com/share/@${CONFIG.USERNAME}/${CONFIG.SHARE_IDS.editors}.json`,
        { signal: controller.signal },
      ).then((r) => r.json()),
      fetch(
        `https://wakatime.com/share/@${CONFIG.USERNAME}/${CONFIG.SHARE_IDS.os}.json`,
        { signal: controller.signal },
      ).then((r) => r.json()),
    ]);
    clearTimeout(timer);

    if (act?.days && lang?.data) {
      rawData = {
        fetchedAt: new Date().toISOString(),
        activity: act,
        languages: lang,
        editors: edit,
        os: os,
      };
    }
  } catch {}

  const days: WakaTimeDay[] = rawData.activity?.days || [];
  const totalSeconds = days.reduce((sum, d) => sum + (d.total || 0), 0);
  const totalHours = Math.round(totalSeconds / 3600);
  const dailyAverageHours = days.length
    ? Number((totalSeconds / days.length / 3600).toFixed(1))
    : 0;
  const last30DaysSeconds = days
    .slice(-30)
    .reduce((sum, d) => sum + (d.total || 0), 0);
  const last30DaysHours = Math.round(last30DaysSeconds / 3600);

  // Compute cumulative series
  let cum = 0;
  const points = days.map((d) => {
    cum += (d.total || 0) / 3600;
    return { date: d.date, cum };
  });

  // Downsample to ~250 points for a lightweight yet smooth SVG curve
  const sampleRate = Math.max(1, Math.floor(points.length / 250));
  const sampledPoints = points.filter(
    (_, i) => i % sampleRate === 0 || i === points.length - 1,
  );

  const width = 680;
  const height = 135;
  const pad = { top: 12, right: 15, bottom: 24, left: 45 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const maxVal = Math.ceil(cum / 500) * 500 || 2500;

  const coords = sampledPoints.map((p, i) => {
    const x = pad.left + (i / (sampledPoints.length - 1)) * plotWidth;
    const y = pad.top + plotHeight - (p.cum / maxVal) * plotHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const linePath = coords.length
    ? `M ${coords.map((c) => `${c.x} ${c.y}`).join(" L ")}`
    : "";
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x} ${pad.top + plotHeight} L ${coords[0].x} ${pad.top + plotHeight} Z`
    : "";

  // X ticks
  const xIndices = [
    0,
    Math.floor(points.length * 0.33),
    Math.floor(points.length * 0.66),
    points.length - 1,
  ];

  const formatDateTick = (dStr?: string) => {
    if (!dStr) return "";
    const date = new Date(dStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  const xTicks = xIndices.map((idx) => {
    const x = pad.left + (idx / (points.length - 1)) * plotWidth;
    return {
      label: formatDateTick(points[idx]?.date),
      x: Number(x.toFixed(1)),
    };
  });

  // Y ticks (0, half, max)
  const yTicks = [
    { label: "0", y: pad.top + plotHeight },
    { label: `${maxVal / 2}h`, y: pad.top + plotHeight / 2 },
    { label: `${maxVal}h`, y: pad.top },
  ];

  // Languages breakdown with 'Other' to ensure 100% coverage without gaps
  const rawLangs = rawData.languages?.data || [];
  const topLangs: WakaTimeItem[] = rawLangs.slice(0, 5).map((item) => ({
    name: item.name,
    percent: Number(item.percent.toFixed(1)),
    color: item.color,
  }));
  const langSum = topLangs.reduce((acc, item) => acc + item.percent, 0);
  const otherLangPct = Number(Math.max(0, 100 - langSum).toFixed(1));
  const languages: WakaTimeItem[] = [
    ...topLangs,
    ...(otherLangPct > 0
      ? [{ name: "Other", percent: otherLangPct, color: "#6b7280" }]
      : []),
  ];

  // Editors breakdown with 'Other'
  const rawEditors = rawData.editors?.data || [];
  const topEditors: WakaTimeItem[] = rawEditors.slice(0, 4).map((item) => ({
    name: item.name,
    percent: Number(item.percent.toFixed(1)),
    color: item.color,
  }));
  const editSum = topEditors.reduce((acc, item) => acc + item.percent, 0);
  const otherEditPct = Number(Math.max(0, 100 - editSum).toFixed(1));
  const editors: WakaTimeItem[] = [
    ...topEditors,
    ...(otherEditPct > 0
      ? [{ name: "Other", percent: otherEditPct, color: "#6b7280" }]
      : []),
  ];

  const os: WakaTimeItem[] = (rawData.os?.data || []).slice(0, 3);

  // Extract dynamic start date from WakaTime data
  let since = "May 2024";
  if (days[0]?.date) {
    const d = new Date(days[0].date + "T00:00:00");
    since = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (rawData.activity?.human_readable_range) {
    since = rawData.activity.human_readable_range.replace(/^since\s+/i, "");
  }

  return {
    totalHours,
    dailyAverageHours,
    last30DaysHours,
    since,
    rangeLabel: rawData.activity?.human_readable_range || `since ${since}`,
    languages,
    editors,
    os,
    chart: {
      linePath,
      areaPath,
      width,
      height,
      xTicks,
      yTicks,
    },
  };
}
