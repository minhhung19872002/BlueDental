import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spin } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { toStatsChart, type StatsBar } from "../../api/statsAdapters";
import type { StatsDay } from "../../api/statsApi";
import { formatCount } from "./statsFormat";
import { StatsDayTooltip } from "./StatsDayTooltip";

interface Props {
  days: StatsDay[];
  /** The period as the picker prints it, so the card says what it covers. */
  periodLabel: string;
  loading: boolean;
}

interface ChartRow extends StatsBar {
  /** A number over the bar only for the tallest one and today's: never one on every bar. */
  mark: string;
}

/** Room one "22/10" or "10/2026" takes under the bars, gap included. */
const TICK_WIDTH = 52;
/** Until the chart has measured itself: a desktop card's worth. */
const DEFAULT_TICKS = 14;

/**
 * Every n-th date counted back from the last bar, as many as the width holds,
 * so today (or this month) always keeps its date and the gaps stay even;
 * Recharts' own thinning skips unevenly.
 */
function tickFormatterFor(count: number, width: number) {
  const fits = width > 0 ? Math.max(2, Math.floor(width / TICK_WIDTH)) : DEFAULT_TICKS;
  const step = Math.max(1, Math.ceil(count / fits));
  return (label: string, index: number) => ((count - 1 - index) % step === 0 ? label : "");
}

function withMarks(bars: StatsBar[]): ChartRow[] {
  const peak = Math.max(0, ...bars.map((bar) => bar.sent));
  return bars.map((bar) => ({
    ...bar,
    mark: bar.sent > 0 && (bar.current || bar.sent === peak) ? formatCount(bar.sent) : "",
  }));
}

/** Tin đã gửi theo ngày — by month once the period runs past two months. */
export function StatsDayChart({ days, periodLabel, loading }: Props) {
  const chart = useMemo(() => toStatsChart(days, dayjs()), [days]);
  const rows = useMemo(() => withMarks(chart.bars), [chart.bars]);
  const [width, setWidth] = useState(0);
  const empty = rows.every((row) => row.sent === 0);
  const darkHint = chart.grain === "day" ? t("CSKH:Stats:TodayDark") : t("CSKH:Stats:ThisMonthDark");

  return (
    <section className="page-card cskh-stats-card" aria-busy={loading}>
      <div className="dash-card-head">
        <h2 className="dash-card-title">{t(chart.grain === "day" ? "CSKH:Stats:ByDay" : "CSKH:Stats:ByMonth")}</h2>
        <span className="dash-card-sub">{chart.hasCurrent ? `${periodLabel} · ${darkHint}` : periodLabel}</span>
      </div>
      <Spin spinning={loading}>
        {empty ? (
          <p className="cskh-stats-empty">{t("CSKH:Stats:NoData")}</p>
        ) : (
          <div className="cskh-stats-chart">
            <ResponsiveContainer width="100%" height={240} onResize={setWidth}>
              <BarChart data={rows} margin={{ top: 20, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} className="cskh-stats-grid" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={0}
                  tickFormatter={tickFormatterFor(rows.length, width)}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ className: "cskh-stats-cursor" }} content={StatsDayTooltip} />
                <Bar dataKey="sent" maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {rows.map((row) => (
                    <Cell
                      key={row.key}
                      className={["cskh-stats-bar", row.current && "cskh-stats-bar--current"].filter(Boolean).join(" ")}
                    />
                  ))}
                  <LabelList dataKey="mark" position="top" className="cskh-stats-bar-label" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Spin>
    </section>
  );
}
