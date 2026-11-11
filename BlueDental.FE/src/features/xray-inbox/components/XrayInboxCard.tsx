import { memo } from "react";
import { Button } from "antd";
import { UserCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { XrayInboxItemViewModel } from "../api/xrayInboxAdapters";

interface Props {
  item: XrayInboxItemViewModel;
  canAssign: boolean;
  canDiscard: boolean;
  onAssign: (item: XrayInboxItemViewModel) => void;
  onDiscard: (item: XrayInboxItemViewModel) => void;
}

/** What the file name said, joined for one line under it; empty when it said nothing. */
function hintLine(item: XrayInboxItemViewModel): string {
  return [item.hintCode, item.hintName, item.hintBirthYear?.toString()]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/** One picture waiting for a record: the film, where it came from, and the two actions. */
export const XrayInboxCard = memo(function XrayInboxCard({
  item,
  canAssign,
  canDiscard,
  onAssign,
  onDiscard,
}: Props) {
  const t = useT();
  const hint = hintLine(item);

  return (
    <article className="xi-card" aria-label={item.fileName}>
      <a className="xi-card-thumb" href={item.url} target="_blank" rel="noreferrer">
        <img src={item.url} alt={item.fileName} loading="lazy" draggable={false} />
      </a>
      <div className="xi-card-body">
        <div className="xi-card-name" title={item.fileName}>
          {item.fileName}
        </div>
        <div className="xi-card-meta">
          {item.receivedLabel}
          {item.deviceName && ` · ${item.deviceName}`}
        </div>
        <div className={hint ? "xi-card-hint" : "xi-card-hint xi-card-hint--none"}>
          {hint || t("XrayInbox:NoHint")}
        </div>
      </div>
      {(canAssign || canDiscard) && (
        <div className="xi-card-actions">
          {canDiscard && (
            <Button size="small" onClick={() => onDiscard(item)}>
              {t("XrayInbox:Discard")}
            </Button>
          )}
          {canAssign && (
            <Button
              size="small"
              type="primary"
              icon={<UserCheck size={14} aria-hidden="true" />}
              onClick={() => onAssign(item)}
            >
              {t("XrayInbox:Assign")}
            </Button>
          )}
        </div>
      )}
    </article>
  );
});
