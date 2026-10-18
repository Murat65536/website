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
  languages: WakaTimeItem[];
  editors: WakaTimeItem[];
  os: WakaTimeItem[];
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
    languages,
    editors,
    os,
  };
}
