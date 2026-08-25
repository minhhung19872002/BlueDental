import { message } from "antd";
import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { useCreatePatientTag, useUpdatePatientTag, type PatientTagDto } from "../api/patientTagApi";
import { cn } from "@/lib/cn";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

/** The eight swatches the reference offers before the custom colour picker. */
const PRESET_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#64748B",
] as const;

const DEFAULT_COLOR = "#3B82F6";

interface Props {
  open: boolean;
  tag: PatientTagDto | null;
  onClose: () => void;
}

export function PatientTagModal({ open, tag, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createTag = useCreatePatientTag();
  const updateTag = useUpdatePatientTag();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? "");
    setColor(tag?.color ?? DEFAULT_COLOR);
    setError(null);
  }, [open, tag]);

  const pending = createTag.isPending || updateTag.isPending;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên thẻ hồ sơ"));
      return;
    }

    try {
      if (tag) {
        await updateTag.mutateAsync({
          id: tag.id,
          input: {
            name: trimmed,
            color,
            description: tag.description ?? undefined,
            isActive: tag.isActive,
          },
        });
        message.success(t("Đã cập nhật thẻ hồ sơ"));
      } else {
        await createTag.mutateAsync({ clinicBranchId: branchId, name: trimmed, color });
        message.success(t("Đã thêm thẻ hồ sơ"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      title={tag ? t("Cập nhật thẻ hồ sơ") : t("Thêm thẻ hồ sơ mới")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-stack">
        <LabeledField
          id="tag-name"
          label={t("Tên thẻ hồ sơ")}
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

        <fieldset className="bd-dialog-stack bd-dialog-stack--tight">
          <legend className="bd-cat-strong">{t("Màu")}</legend>
          <div className="bd-cat-inline">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={t("Chọn màu {0}", preset)}
                aria-pressed={color.toUpperCase() === preset}
                onClick={() => setColor(preset)}
                style={{ backgroundColor: preset }}
                className={cn(
                  "bd-tag-color",
                  color.toUpperCase() === preset && "bd-tag-color--picked",
                )}
              />
            ))}

            <div className="bd-rel">
              <span
                aria-hidden="true"
                className="bd-tag-swatch"
              >
                <Pipette className="bd-icon" />
              </span>
              <input
                type="color"
                aria-label={t("Chọn màu tuỳ chỉnh")}
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                className="bd-color-input"
              />
            </div>
          </div>
        </fieldset>

        <div className="bd-tag-preview">
          <p className="bd-cat-hint">{t("Xem trước")}</p>
          <span
            style={{ backgroundColor: color }}
            className="bd-tag-chip"
          >
            {name.trim() || t("Khách hàng mới")}
          </span>
        </div>
      </div>
    </AppDialog>
  );
}
