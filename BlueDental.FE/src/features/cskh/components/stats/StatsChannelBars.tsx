import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { ratePercent } from "../../api/statsAdapters";
import type { StatsChannel } from "../../api/statsApi";
import { channelLabels } from "../../api/templateApi";
import { formatCount, formatPercent } from "./statsFormat";
import { StatsMeter } from "./StatsMeter";

interface Props {
  channels: readonly StatsChannel[];
  loading: boolean;
}

/**
 * Theo kênh: how many went out on each channel and how many of them arrived
 * (BA img_31). Bars are measured against the busiest channel, so the longest
 * one always fills its track.
 */
export function StatsChannelBars({ channels, loading }: Props) {
  const labels = channelLabels();
  const peak = Math.max(0, ...channels.map((item) => item.sent));

  return (
    <section className="page-card cskh-stats-card" aria-busy={loading}>
      <div className="dash-card-head">
        <h2 className="dash-card-title">{t("CSKH:Stats:ByChannel")}</h2>
      </div>
      <Spin spinning={loading}>
        <ul className="cskh-stats-channel-list">
          {channels.map((item) => (
            <li key={item.channel} className="cskh-stats-channel">
              <div className="cskh-stats-channel-head">
                <span className="cskh-stats-channel-name">{labels[item.channel]}</span>
                <span className="cskh-stats-channel-count">
                  {t("CSKH:Stats:Card:Messages", formatCount(item.sent))}
                </span>
              </div>
              <StatsMeter value={item.sent} max={peak} tone="primary" label={labels[item.channel]} />
              <span className="cskh-stats-channel-sub">
                {t("CSKH:Stats:ChannelSuccess", formatPercent(ratePercent(item.succeeded, item.sent)))}
              </span>
            </li>
          ))}
        </ul>
      </Spin>
    </section>
  );
}
