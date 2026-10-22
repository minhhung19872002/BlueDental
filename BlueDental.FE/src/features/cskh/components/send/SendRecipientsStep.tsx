import { useMemo, useState } from "react";
import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/SegmentedTabs";
import { foldForSearch } from "@/utils/foldForSearch";
import type { MessageRecipient } from "../../api/sendApi";
import type { MessageChannel } from "../../api/templateApi";
import type { IndividualPicks } from "../../hooks/useIndividualPicks";
import type { RecipientRemoval } from "../../hooks/useRecipientRemoval";
import type { SendRecipients } from "../../hooks/useSendRecipients";
import type { SendParams, SendSource } from "../../hooks/useSendParams";
import { matchesRecipient } from "../../sendRecipients";
import { EditorCard } from "../template-editor/EditorCard";
import { RecipientTable } from "./RecipientTable";
import { SendSourcePanel } from "./SendSourcePanel";
import { SendStatsBar } from "./SendStatsBar";

interface SendRecipientsStepProps {
  params: SendParams;
  channel: MessageChannel;
  contactName: string;
  recipients: SendRecipients;
  picks: IndividualPicks;
  removal: RecipientRemoval;
  skipRecent: boolean;
  onSkipRecentChange: (on: boolean) => void;
}

/** Step 3 — Gửi tới: the source, the stats of the rows in play, the rows, the 30-day guard. */
export function SendRecipientsStep(props: SendRecipientsStepProps) {
  const { params, channel, contactName, recipients, picks, removal, skipRecent, onSkipRecentChange } = props;
  const isList = params.source === "list";
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<MessageRecipient | null>(null);

  const rows = useMemo(() => {
    const folded = foldForSearch(query.trim());
    return recipients.rows.filter((row) => matchesRecipient(row, folded));
  }, [recipients.rows, query]);

  const sources: SegmentedTabItem<SendSource>[] = [
    { key: "list", label: t("CSKH:Send:Source:CareList") },
    { key: "individual", label: t("CSKH:Send:Source:Individual") },
  ];

  const handleRemove = () => {
    if (removing) removal.remove(removing.key);
    setRemoving(null);
  };

  return (
    <EditorCard
      step={3}
      title={t("CSKH:Send:To")}
      className="snd-to"
      extra={
        !params.lockedPatientId && (
          <SegmentedTabs<SendSource> items={sources} activeKey={params.source} onChange={params.setSource} />
        )
      }
    >
      <SendSourcePanel params={params} onAddCustomer={picks.add} />
      <SendStatsBar stats={recipients.stats} contactName={contactName} query={query} onQueryChange={setQuery} />
      <RecipientTable
        rows={rows}
        channel={channel}
        contactName={contactName}
        loading={recipients.loading}
        emptyText={!isList && picks.addedIds.length === 0 ? t("CSKH:Send:NoPicked") : t("CSKH:Send:NoRows")}
        isChecked={isList ? null : picks.isChecked}
        onToggle={picks.toggle}
        onRemove={isList ? setRemoving : null}
      />
      <div className="snd-to-foot">
        <Checkbox checked={skipRecent} onChange={(event) => onSkipRecentChange(event.target.checked)}>
          {t("CSKH:Send:SkipRecent")}
        </Checkbox>
        {removal.count > 0 && (
          <button type="button" className="snd-undo" onClick={removal.undo}>
            {t("CSKH:Send:Undo", removal.count)}
          </button>
        )}
      </div>
      <ConfirmDeleteDialog
        open={removing !== null}
        noun={t("CSKH:Send:Col:Customer")}
        title={t("CSKH:Send:RemoveTitle")}
        question={t("CSKH:Send:RemoveConfirm")}
        note={t("CSKH:Send:RemoveNote")}
        confirmLabel={t("CSKH:Send:Remove")}
        onConfirm={handleRemove}
        onClose={() => setRemoving(null)}
      />
    </EditorCard>
  );
}
