import type { ReactNode } from "react";
import { WarningOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { EditorCard } from "../template-editor/EditorCard";

/** The lines of "Tóm tắt lần gửi", already worded. */
export interface SendSummary {
  channelTemplate: string;
  people: string;
  messages: string;
  cost: string;
  /** Customers of the list this send leaves out. */
  skipped: number;
}

interface SendSummaryCardProps {
  summary: SendSummary;
  contactName: string;
  /** The schedule fields and the buttons, for those who may send. */
  children?: ReactNode;
}

export function SendSummaryCard({ summary, contactName, children }: SendSummaryCardProps) {
  const rows = [
    { key: "channel", label: t("CSKH:Send:Sum:ChannelTemplate"), value: summary.channelTemplate },
    { key: "people", label: t("CSKH:Send:Sum:Recipients"), value: summary.people },
    { key: "messages", label: t("CSKH:Send:Sum:Messages"), value: summary.messages },
    { key: "cost", label: t("CSKH:Send:Sum:Cost"), value: summary.cost },
  ];
  return (
    <EditorCard className="snd-summary" title={t("CSKH:Send:Summary")}>
      <dl className="snd-summary-rows">
        {rows.map((row) => (
          <div key={row.key} className={`snd-summary-row snd-summary-row--${row.key}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {summary.skipped > 0 && (
        <p className="tpe-warn snd-skipped">
          <WarningOutlined />
          {t("CSKH:Send:Sum:Skipped", summary.skipped, contactName)}
        </p>
      )}
      {children}
    </EditorCard>
  );
}
