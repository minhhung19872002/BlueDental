import { message } from "antd";
import { useEffect, useState } from "react";
import {
  useCreateTaxonomyGroup,
  useUpdateTaxonomyGroup,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** null creates a new group, otherwise edits this one. */
  group: TaxonomyDto | null;
  /** Taxonomy group slug of the active tab. */
  taxonomyGroup: string;
  onClose: () => void;
  onCreated: (group: TaxonomyDto) => void;
}

/** What the reference offers a new group, and what the list sorts by. */
const DEFAULT_PRIORITY = "0";

export function TaxonomyGroupModal({ open, group, taxonomyGroup, onClose, onCreated }: Props) {
  const branchId = useCurrentBranchId();
  const createGroup = useCreateTaxonomyGroup();
  const updateGroup = useUpdateTaxonomyGroup();

  const [name, setName] = useState("");
  /** "Mức độ ưu tiên" — the sort order the panel lists groups by. */
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setPriority(group ? String(group.sortOrder) : DEFAULT_PRIORITY);
    setError(null);
  }, [open, group]);

  const pending = createGroup.isPending || updateGroup.isPending;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên phân loại"));
      return;
    }

    // An empty box means "no priority", which is the same as the default.
    const sortOrder = Number.parseInt(priority, 10);
    if (priority.trim() !== "" && (Number.isNaN(sortOrder) || sortOrder < 0)) {
      setError(t("Mức độ ưu tiên phải là số không âm"));
      return;
    }

    const resolvedSortOrder = Number.isNaN(sortOrder) ? 0 : sortOrder;

    try {
      if (group) {
        await updateGroup.mutateAsync({
          id: group.id,
          input: {
            name: trimmed,
            alias: group.alias ?? undefined,
            color: group.color ?? undefined,
            description: group.description ?? undefined,
            sortOrder: resolvedSortOrder,
          },
        });
        message.success(t("Đã cập nhật nhóm"));
      } else {
        const created = await createGroup.mutateAsync({
          clinicBranchId: branchId,
          group: taxonomyGroup,
          name: trimmed,
          sortOrder: resolvedSortOrder,
        });
        message.success(t("Đã thêm nhóm"));
        // Closed before the parent is told, so a hiccup while it moves the
        // selection can never leave this dialog stuck open over the result.
        onClose();
        onCreated(created);
        return;
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      // The reference titles the edit dialog "Cập nhật nhóm", not "Sửa".
      title={group ? t("Cập nhật nhóm") : t("Tạo nhóm")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-grid">
        <LabeledField
          id="taxonomy-group-name"
          label={t("Tên phân loại")}
          required
          autoFocus
          value={name}
          error={error ?? undefined}
          onChange={(next) => {
            setName(next);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        <LabeledField
          id="taxonomy-group-priority"
          label={t("Mức độ ưu tiên")}
          type="number"
          min={0}
          value={priority}
          onChange={setPriority}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
      </div>
    </AppDialog>
  );
}
