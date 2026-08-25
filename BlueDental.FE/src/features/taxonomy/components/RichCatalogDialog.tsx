import { Checkbox, message } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  useCreateCatalogEntry,
  useDeleteCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { FloatingSelect } from "@/components/FloatingSelect";
import { RichTextField } from "@/components/RichTextField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** Lowercase noun of the catalog, e.g. "chẩn đoán". */
  noun: string;
  onClose: () => void;
}

/**
 * Chẩn đoán and Dữ liệu tư vấn: the same form on the reference — a name, its
 * group, a rich-text body, a note, the two state checkboxes and a priority.
 */
export function RichCatalogDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  noun,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();
  const deleteEntry = useDeleteCatalogEntry();

  const [name, setName] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [priority, setPriority] = useState("0");
  const [error, setError] = useState<string | null>(null);

  // React Query hands back a new array on every refetch, so these are read
  // through a ref: a refetch landing while the dialog is open must not reset
  // the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    setName(entry?.name ?? "");
    setTaxonomyId(entry?.taxonomyId ?? fallback);
    setContent(entry?.content ?? "");
    setNote(entry?.note ?? "");
    setIsActive(entry?.isActive ?? true);
    setIsDeleted(false);
    setPriority(String(entry?.sortOrder ?? 0));
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên {0}", noun));
      return;
    }

    const sortOrder = Number.parseInt(priority, 10) || 0;
    // Quill leaves this behind for an empty document; storing it would make an
    // empty body look like content everywhere else.
    const body = content === "<p><br></p>" ? null : content || null;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId,
            name: trimmed,
            code: entry.code ?? undefined,
            price: entry.price,
            content: body,
            note: note.trim() || null,
            description: entry.description ?? undefined,
            isActive,
            sortOrder,
          },
        });

        if (isDeleted) {
          await deleteEntry.mutateAsync(entry.id);
          message.success(t("Đã xoá"));
          onClose();
          return;
        }

        message.success(t("Đã cập nhật"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId,
          name: trimmed,
          content: body,
          note: note.trim() || null,
          sortOrder,
        });
        message.success(t("Đã thêm"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật {0}", noun) : t("Thêm {0}", noun)}
      width={820}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-stack">
        <div className="bd-dialog-grid">
          <LabeledField
            id="catalog-rich-name"
            label={t("Tên {0}", noun)}
            required
            autoFocus
            value={name}
            error={error ?? undefined}
            onChange={(next) => {
              setName(next);
              if (error) setError(null);
            }}
          />

          <FloatingSelect
            id="catalog-rich-group"
            label={t("Chọn nhóm {0}", noun)}
            required
            value={taxonomyId}
            onChange={setTaxonomyId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
          />
        </div>

        <RichTextField
          value={content}
          onChange={setContent}
          placeholder={t("Nhập nội dung tư vấn...")}
        />

        <LabeledField
          id="catalog-rich-note"
          label={t("Ghi chú")}
          value={note}
          onChange={setNote}
        />

        <div className="bd-dialog-row">
<Checkbox
              id="catalog-rich-active"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}>
            {t("Đang hoạt động")}
          </Checkbox>

<Checkbox
              id="catalog-rich-deleted"
              checked={isDeleted}
              disabled={!entry}
              onChange={(event) => setIsDeleted(event.target.checked)}>
            {t("Đã xoá")}
          </Checkbox>
        </div>

        <LabeledField
          id="catalog-rich-priority"
          label={t("Mức độ ưu tiên")}
          type="number"
          min={0}
          value={priority}
          onChange={setPriority}
        />
      </div>
    </AppDialog>
  );
}
