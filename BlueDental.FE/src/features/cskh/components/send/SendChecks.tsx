import { t } from "@/lib/i18n";
import type { MessageTemplateDto } from "../../api/templateApi";
import { missingLabel } from "../../messageVariables";
import type { RecipientStats } from "../../sendRecipients";
import { EditorCard } from "../template-editor/EditorCard";

interface SendChecksProps {
  channelName: string;
  contactName: string;
  connected: boolean;
  template: MessageTemplateDto | null;
  stats: RecipientStats;
  skipRecent: boolean;
}

interface Check {
  key: string;
  ok: boolean;
  title: string;
  detail: string;
}

function recipientsDetail(stats: RecipientStats, contactName: string): string {
  const parts = [
    stats.received > 0 && t("CSKH:Send:Check:Received", stats.received),
    stats.noContact > 0 && t("CSKH:Send:Check:NoContact", stats.noContact, contactName),
    stats.invalidPhone > 0 && t("CSKH:Send:Check:InvalidPhone", stats.invalidPhone),
    stats.missing > 0 && t("CSKH:Send:Check:Missing", stats.missing),
    stats.merged > 0 && t("CSKH:Send:Check:Merged", stats.merged),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : t("CSKH:Send:Check:AllReach");
}

function checksOf({ channelName, contactName, connected, template, stats, skipRecent }: SendChecksProps): Check[] {
  const missing = stats.missingByVariable.map(([key, count]) => `${missingLabel(key)} (${count})`).join(", ");
  return [
    {
      key: "channel",
      ok: connected,
      title: t("CSKH:Send:Check:Channel", channelName),
      detail: connected ? t("CSKH:Send:Check:ChannelDetail") : t("CSKH:Send:Check:ChannelOff", channelName),
    },
    {
      key: "template",
      ok: template !== null,
      title: t("CSKH:Send:Check:Template", channelName),
      detail: template?.name ?? t("CSKH:Send:Check:NoTemplate", channelName),
    },
    {
      key: "recipients",
      ok: stats.sendable > 0 && stats.sendable === stats.total,
      title: t("CSKH:Send:Check:Recipients", stats.sendable),
      detail: recipientsDetail(stats, contactName),
    },
    {
      key: "variables",
      ok: missing === "",
      title: t("CSKH:Send:Check:Variables"),
      detail: missing ? t("CSKH:Send:Check:VariablesMissing", missing) : t("CSKH:Send:Check:VariablesOk"),
    },
    {
      key: "dedupe",
      ok: skipRecent,
      title: t("CSKH:Send:Check:Dedupe"),
      detail: skipRecent ? t("CSKH:Send:Check:DedupeOn") : t("CSKH:Send:Check:DedupeOff"),
    },
  ];
}

/** "Kiểm tra trước khi gửi": what holds this send back, or who it leaves out (owner decision 3). */
export function SendChecks(props: SendChecksProps) {
  return (
    <EditorCard title={t("CSKH:Send:Checks")}>
      <ul className="snd-checks">
        {checksOf(props).map((check) => (
          <li key={check.key} className={`snd-check-row snd-check-row--${check.ok ? "ok" : "warn"}`}>
            <span className="snd-check-mark" aria-hidden="true">
              {check.ok ? "✓" : "!"}
            </span>
            <span className="snd-check-text">
              <strong>{check.title}</strong>
              <span>{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </EditorCard>
  );
}
