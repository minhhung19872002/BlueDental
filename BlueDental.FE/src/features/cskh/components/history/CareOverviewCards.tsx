import type { ReactNode } from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit, formatVND } from "@/utils/format";
import { CONTACT_STATE, type CareOverview } from "../../api/careHistoryApi";
import { StatusPill } from "../inbox/StatusPill";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ch-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * The right column (BA P2210): "Trạng thái chăm sóc" — Đã liên hệ when a CSKH
 * message went out in the last 90 days, else Chưa liên hệ — and "Tóm tắt chi
 * phí trong 1 năm", what this calendar year's care of the customer cost.
 */
export function CareOverviewCards({ overview, loading }: { overview: CareOverview | undefined; loading: boolean }) {
  const contacted = overview?.contactState === CONTACT_STATE.Contacted;
  const year = overview?.year;

  return (
    <Spin spinning={loading}>
      <section className="ch-card" aria-label={t("CSKH:History:StatusTitle")}>
        <h3 className="ch-card-title ch-card-title--caps">{t("CSKH:History:StatusTitle")}</h3>
        {overview && (
          <>
            <span className={contacted ? "ch-pill ch-pill--good" : "ch-pill ch-pill--warn"}>
              {contacted ? t("CSKH:History:Contacted") : t("CSKH:History:NotContacted")}
            </span>
            <dl className="ch-rows">
              <Row label={t("CSKH:History:LastContact")} value={formatDateTime(overview.lastContactAt) || "—"} />
              <Row
                label={t("CSKH:History:ZaloChat")}
                value={overview.zaloStatus !== null ? <StatusPill status={overview.zaloStatus} /> : t("CSKH:History:NoZalo")}
              />
            </dl>
            <p className="ch-hint">{t("CSKH:History:ContactRule", overview.contactWindowDays)}</p>
          </>
        )}
      </section>
      <section className="ch-card" aria-label={t("CSKH:History:CostTitle", year?.year ?? "")}>
        <h3 className="ch-card-title ch-card-title--caps">{t("CSKH:History:CostTitle", year?.year ?? "")}</h3>
        {year && (
          <dl className="ch-rows">
            <Row label={t("CSKH:History:Cost:Zns")} value={`${formatVND(year.znsSent)} / ${formatVND(year.znsFailed)}`} />
            <Row label={t("CSKH:History:Cost:Sms")} value={formatVND(year.smsSent)} />
            <Row label={t("CSKH:History:Cost:Chat")} value={formatVND(year.zaloChatMessages)} />
            <Row label={t("CSKH:History:Cost:Calls")} value={formatVND(year.calls)} />
            <Row label={t("CSKH:History:Cost:Money")} value={<strong>{formatMoneyUnit(year.messageCost)}</strong>} />
          </dl>
        )}
      </section>
    </Spin>
  );
}
