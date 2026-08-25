import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { MedicalRecordSheet, type MedicalRecordFields } from "./MedicalRecordSheet";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;

/** A template that predates the JSON shape, or a corrupt one, opens empty. */
function parseFields(content: string | null): MedicalRecordFields {
  if (!content) return {};

  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as MedicalRecordFields) : {};
  } catch {
    return {};
  }
}

/**
 * Bệnh án mẫu — a title and the A4 sheet itself, with the reference's zoom
 * control above it.
 *
 * The filled-in cells are stored as JSON on the entry's content, so the sheet
 * can be re-laid-out (and later printed through QuestPDF) without a migration.
 */
export function MedicalRecordTemplateDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [name, setName] = useState("");
  const [fields, setFields] = useState<MedicalRecordFields>({});
  const [priority, setPriority] = useState("0");
  const [zoom, setZoom] = useState(0.9);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? "");
    setFields(parseFields(entry?.content ?? null));
    setPriority(String(entry?.sortOrder ?? 0));
    setZoom(0.9);
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending;

  // Read through a ref for the same reason the other dialogs do: a refetch
  // must not change what a save is about to write.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên mẫu bệnh án"));
      return;
    }

    const taxonomy =
      entry?.taxonomyId ??
      defaults.current.defaultTaxonomyId ??
      defaults.current.groups[0]?.id ??
      "";
    const sortOrder = Number.parseInt(priority, 10) || 0;
    const content = JSON.stringify(fields);

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: taxonomy,
            name: trimmed,
            content,
            price: entry.price,
            isActive: entry.isActive,
            sortOrder,
          },
        });
        message.success(t("Đã cập nhật mẫu bệnh án"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: taxonomy,
          name: trimmed,
          content,
          sortOrder,
        });
        message.success(t("Đã thêm mẫu bệnh án"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  const zoomButton =
    "flex size-8 cursor-pointer items-center justify-center rounded-md border border-app-line text-app-label outline-none hover:bg-app-surface focus-visible:ring-2 focus-visible:ring-app-primary/40";

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật mẫu bệnh án") : t("Thêm mẫu bệnh án")}
      width={1040}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-stack">
        <div className="bd-cat-inline">
          <span className="bd-cat-strong">{t("Tiêu đề bệnh án:")}</span>
          <LabeledField
            id="medical-record-name"
            label={t("Nhập tên mẫu bệnh án...")}
            required
            autoFocus
            value={name}
            error={error ?? undefined}
            onChange={(next) => {
              setName(next);
              if (error) setError(null);
            }}
            className="bd-flex1 bd-min280"
          />
        </div>

        <div className="bd-cat-headrow">
          <p className="bd-zoom">
            {/* The reference marks "nền vàng" with a sample of the shading it
                is talking about. */}
            <span aria-hidden="true">💡</span>
            {t("Nhấp vào các ô")}
            <span className="bd-a4-swatch">
              {t("nền vàng")}
            </span>
            {t("để chỉnh sửa trực tiếp trên bệnh án")}
          </p>
          <div className="bd-cat-inline2">
            <button
              type="button"
              aria-label={t("Thu nhỏ")}
              onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
              className={zoomButton}
            >
              <Minus className="bd-icon" aria-hidden="true" />
            </button>
            <span className="bd-zoom-value">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(0.9)}
              className="bd-zoom-btn"
            >
              {t("Fit")}
            </button>
            <button
              type="button"
              aria-label={t("Phóng to")}
              onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
              className={zoomButton}
            >
              <Plus className="bd-icon" aria-hidden="true" />
            </button>
          </div>
        </div>

        <MedicalRecordSheet value={fields} onChange={setFields} zoom={zoom} />

        <LabeledField
          id="medical-record-priority"
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
