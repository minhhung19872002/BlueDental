import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyApiError, notifyError } from "@/lib/notify";
import { useDebounce } from "@/hooks/useDebounce";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import type { CareType } from "../../api/careApi";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  useMessageTemplates,
  useSyncZaloStatus,
  type MessageChannel,
  type MessageTemplateDto,
} from "../../api/templateApi";
import { TemplateFilterBar } from "./TemplateFilterBar";
import { TemplatePreviewCard } from "./TemplatePreviewCard";
import { TemplateTable } from "./TemplateTable";

interface TemplateListTabProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (id: string) => void;
  onUseToSend?: (id: string) => void;
}

/** Reads Zalo's review verdicts once per visit, so Chờ duyệt turns into Sẵn sàng without a manual refresh. */
function useZaloStatusOnOpen() {
  const { mutate } = useSyncZaloStatus();
  useEffect(() => {
    mutate(undefined, {
      onSuccess: (result) => {
        if (result.error) notifyError(t("CSKH:Template:ZaloSyncFailed", result.error));
      },
      onError: notifyApiError,
    });
  }, [mutate]);
}

/** "Xoá" on a row: asks first; a send still waiting on the template makes the server refuse. */
function useTemplateDelete(onDeleted: (id: string) => void) {
  const [target, setTarget] = useState<MessageTemplateDto | null>(null);
  const remove = useDeleteTemplate();

  const confirm = () => {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: (id) => {
        onDeleted(id);
        toast.success(t("CSKH:Template:Deleted"));
      },
      onError: notifyApiError,
      onSettled: () => setTarget(null),
    });
  };

  return { target, pending: remove.isPending, ask: setTarget, close: () => setTarget(null), confirm };
}

/** CSKH ▸ Template tin nhắn: filters on top, the list left, the picked template's preview right. */
export function TemplateListTab({ canCreate, canUpdate, canDelete, onEdit, onUseToSend }: TemplateListTabProps) {
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [purpose, setPurpose] = useState<CareType | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filter = useDebounce(search.trim());

  useZaloStatusOnOpen();
  const list = useMessageTemplates({ channel, purpose, filter });
  const duplicate = useDuplicateTemplate();
  const deletion = useTemplateDelete((id) => setSelectedId((current) => (current === id ? null : current)));

  const items = list.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const handleDuplicate = () => {
    if (!selected) return;
    duplicate.mutate(selected.id, {
      onSuccess: (copy) => {
        setSelectedId(copy.id);
        toast.success(t("CSKH:Template:Duplicated"));
      },
      onError: notifyApiError,
    });
  };

  return (
    <div className="tpl-tab">
      <div className="reception-card tpl-filter-card">
        <TemplateFilterBar
          counts={list.data}
          channel={channel}
          search={search}
          purpose={purpose}
          onChannelChange={setChannel}
          onSearchChange={setSearch}
          onPurposeChange={setPurpose}
        />
      </div>
      <div className="tpl-body">
        <TemplateTable
          items={items}
          loading={list.isLoading}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onDelete={canDelete ? deletion.ask : undefined}
        />
        <TemplatePreviewCard
          template={selected}
          duplicating={duplicate.isPending}
          onEdit={canUpdate && selected ? () => onEdit(selected.id) : undefined}
          onDuplicate={canCreate ? handleDuplicate : undefined}
          onUseToSend={onUseToSend && selected ? () => onUseToSend(selected.id) : undefined}
        />
      </div>
      <ConfirmDeleteDialog
        open={deletion.target !== null}
        noun={t("CSKH:Template:Noun")}
        name={deletion.target?.name}
        note={t("CSKH:Template:DeleteNote")}
        pending={deletion.pending}
        onConfirm={deletion.confirm}
        onClose={deletion.close}
      />
    </div>
  );
}
