import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { MessageRecipient } from "../../api/sendApi";
import { MESSAGE_CHANNEL, type MessageChannel } from "../../api/templateApi";
import { missingLabel } from "../../messageVariables";
import { isUnreachable, recipientKind } from "../../sendRecipients";

/** Khách lẻ ticks rows in and out; a care list numbers them and "Xóa" drops one. */
export type RowLead = { kind: "number"; index: number } | { kind: "tick"; checked: boolean };

interface RecipientRowProps {
  recipient: MessageRecipient;
  channel: MessageChannel;
  contactName: string;
  lead: RowLead;
  onToggle: (patientId: string) => void;
  onRemove: ((recipient: MessageRecipient) => void) | null;
}

function contactOf(recipient: MessageRecipient, channel: MessageChannel): string | null {
  return channel === MESSAGE_CHANNEL.Email ? recipient.email : recipient.phone;
}

function Lead({ recipient, lead, onToggle }: Pick<RecipientRowProps, "recipient" | "lead" | "onToggle">) {
  if (lead.kind === "number") return <span className="snd-row-index">{lead.index + 1}</span>;
  const unreachable = isUnreachable(recipientKind(recipient)) || recipient.patientId === null;
  return (
    <input
      type="checkbox"
      className="snd-check"
      checked={lead.checked && !unreachable}
      disabled={unreachable}
      aria-label={t("CSKH:Send:PickRow", recipient.name)}
      onChange={() => recipient.patientId && onToggle(recipient.patientId)}
    />
  );
}

/** One customer of "Gửi tới": who, where the message goes, their dentist and the last receipt. */
export function RecipientRow(props: RecipientRowProps) {
  const { recipient, channel, contactName, lead, onToggle, onRemove } = props;
  const kind = recipientKind(recipient);
  const contact = contactOf(recipient, channel);
  const picked = lead.kind === "tick" && lead.checked && !isUnreachable(kind);
  const tone = picked ? "picked" : kind === "ok" ? "ok" : "skip";

  return (
    <div role="row" className={`snd-row snd-row--${tone}`}>
      <span role="cell" className="snd-cell snd-cell--lead">
        <Lead recipient={recipient} lead={lead} onToggle={onToggle} />
      </span>
      <span role="cell" className="snd-cell">
        <span className="snd-row-name">{recipient.name}</span>
        {recipient.code && <span className="snd-row-code">{recipient.code}</span>}
        {kind === "missing" && (
          <span className="snd-row-missing">
            {t("CSKH:Send:MissingVars", recipient.missing.map(missingLabel).join(", "))}
          </span>
        )}
        {kind === "invalid" && <span className="snd-row-missing">{t("CSKH:Send:InvalidPhoneRow")}</span>}
        {kind === "merged" && (
          <span className="snd-row-merged">{t("CSKH:Send:MergedInto", recipient.mergedIntoName ?? "")}</span>
        )}
      </span>
      <span role="cell" className="snd-cell">
        {contact ?? <em className="snd-row-none">{t("CSKH:Send:NoContactValue", contactName)}</em>}
      </span>
      <span role="cell" className="snd-cell">
        {recipient.dentistName ?? "—"}
      </span>
      <span role="cell" className="snd-cell">
        {recipient.receivedAt ? (
          <span className="snd-row-received">
            {t(
              recipient.receivedPending ? "CSKH:Send:PendingOn" : "CSKH:Send:ReceivedOn",
              formatDate(recipient.receivedAt),
            )}
          </span>
        ) : (
          <span className="snd-row-fresh">{t("CSKH:Send:NotReceived")}</span>
        )}
      </span>
      {onRemove && (
        <span role="cell" className="snd-cell snd-cell--action">
          <button
            type="button"
            className="snd-remove"
            aria-label={`${t("CSKH:Send:Remove")} ${recipient.name}`}
            onClick={() => onRemove(recipient)}
          >
            {t("CSKH:Send:Remove")}
          </button>
        </span>
      )}
    </div>
  );
}
