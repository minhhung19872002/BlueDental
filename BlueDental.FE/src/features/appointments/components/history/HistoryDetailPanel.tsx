import dayjs from "dayjs";
import { Globe, MonitorSmartphone, Server } from "lucide-react";
import { LetterAvatar } from "@/components/LetterAvatar";
import { t } from "@/lib/i18n";
import type { HistoryEntry } from "../../types/appointmentHistory";
import { ActionBadge, HistoryPill } from "./HistoryBadges";
import { HistoryDiffCard } from "./HistoryDiffCard";
import { dash, describeDevice, sourceLabel, statusLabel } from "./historyLabels";

/**
 * "Loại: Người dùng" is translated as one sentence: on its own, "Người dùng"
 * is the plural of the user-management screens ("Users"). The colon splits
 * it back so the value keeps its darker weight in either language.
 */
function ActorKind({ isSystem }: { isSystem: boolean }) {
  const text = isSystem ? t("Loại: Hệ thống") : t("Loại: Người dùng");
  const colon = text.indexOf(":");
  const label = colon === -1 ? "" : text.slice(0, colon + 1);
  const value = colon === -1 ? text : text.slice(colon + 1).trim();
  return (
    <div className="ah-person-kind">
      <span className="ah-person-kind-label">{label}</span>{" "}
      <span className="ah-person-kind-value">{value}</span>
    </div>
  );
}

interface MetaItem {
  label: string;
  value: string;
  code?: boolean;
}

/**
 * The expanded row: who did it, from where, what changed field by field,
 * and the raw facts at the bottom for anyone chasing a support ticket.
 */
export function HistoryDetailPanel({ entry }: { entry: HistoryEntry }) {
  const when = dayjs(entry.occurredAt);
  // Read left to right, top to bottom, this is the reference's two-column
  // order: Schedule / Trạng thái, Actor / IP, Trình duyệt / Hệ điều hành.
  // Unlike the table cell, this line always spells out both sides
  // ("Trễ hẹn → Trễ hẹn"), as the reference does.
  const meta: MetaItem[] = [
    { label: t("Mã số lịch"), value: entry.appointmentId, code: true },
    {
      label: t("Trạng thái"),
      value: `${statusLabel(entry.statusBefore)} → ${statusLabel(entry.statusAfter)}`,
    },
    { label: t("Người thao tác"), value: entry.actorName },
    { label: "IP", value: dash(entry.ipAddress) },
    { label: t("Trình duyệt"), value: dash(entry.browser) },
    { label: t("Hệ điều hành"), value: dash(entry.operatingSystem) },
  ];

  return (
    <div className="ah-detail" data-testid="ah-detail">
      <div className="ah-detail-head">
        <div className="ah-detail-badges">
          <ActionBadge action={entry.action} />
          <HistoryPill>{t("Thông tin")}</HistoryPill>
          <HistoryPill tone="blue">{t("Lịch hẹn")}</HistoryPill>
        </div>
        <span className="ah-detail-when">{when.format("HH:mm:ss D/M/YYYY")}</span>
      </div>

      <div className="ah-detail-grid">
        <section className="ah-card">
          <h4 className="ah-card-title">{t("Người thực hiện")}</h4>
          <div className="ah-person">
            <LetterAvatar name={entry.actorName} className="ah-avatar" />
            <div className="ah-person-text">
              <div className="ah-person-name">{entry.actorName}</div>
              <div className="ah-person-sub">{dash(entry.actorRole)}</div>
            </div>
          </div>
          <ActorKind isSystem={entry.isSystemActor} />
        </section>

        <section className="ah-card">
          <h4 className="ah-card-title">{t("Thông tin truy cập")}</h4>
          <ul className="ah-access">
            <li>
              <Globe size={14} strokeWidth={1.75} />
              <span className="ah-access-label">IP:</span>
              <span className="ah-access-value">{dash(entry.ipAddress)}</span>
            </li>
            <li>
              <MonitorSmartphone size={14} strokeWidth={1.75} />
              <span className="ah-access-label">{t("Thiết bị")}:</span>
              <span className="ah-access-value">{describeDevice(entry)}</span>
            </li>
            <li>
              <Server size={14} strokeWidth={1.75} />
              <span className="ah-access-label">{t("Nguồn")}:</span>
              <span className="ah-access-value">{sourceLabel(entry.source)}</span>
            </li>
          </ul>
        </section>
      </div>

      <HistoryDiffCard entry={entry} />

      <section className="ah-card ah-meta">
        {meta.map(({ label, value, code }) => (
          <div key={label} className="ah-meta-item">
            <span className="ah-meta-label">{label}:</span>
            {code ? <code>{value}</code> : <span className="ah-meta-value">{value}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
