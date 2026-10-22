import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyApiError, notifyError } from "@/lib/notify";
import { useDebounce } from "@/hooks/useDebounce";
import type { CareType } from "../../api/careApi";
import {
  useDuplicateTemplate,
  useMessageTemplates,
  useSyncZaloStatus,
  type MessageChannel,
} from "../../api/templateApi";
import { TemplateFilterBar } from "./TemplateFilterBar";
import { TemplatePreviewCard } from "./TemplatePreviewCard";
import { TemplateTable } from "./TemplateTable";

interface TemplateListTabProps {
  canCreate: boolean;
  canUpdate: boolean;
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

/** CSKH ▸ Template tin nhắn: filters on top, the list left, the picked template's preview right. */
export function TemplateListTab({ canCreate, canUpdate, onEdit, onUseToSend }: TemplateListTabProps) {
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [purpose, setPurpose] = useState<CareType | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filter = useDebounce(search.trim());

  useZaloStatusOnOpen();
  const list = useMessageTemplates({ channel, purpose, filter });
  const duplicate = useDuplicateTemplate();

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
        <TemplateTable items={items} loading={list.isLoading} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        <TemplatePreviewCard
          template={selected}
          duplicating={duplicate.isPending}
          onEdit={canUpdate && selected ? () => onEdit(selected.id) : undefined}
          onDuplicate={canCreate ? handleDuplicate : undefined}
          onUseToSend={onUseToSend && selected ? () => onUseToSend(selected.id) : undefined}
        />
      </div>
    </div>
  );
}
