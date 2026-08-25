import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { toast } from "sonner";
import { useCreatePatientTag, useUpdatePatientTag, type PatientTagDto } from "../api/patientTagApi";
import { cn } from "@/lib/cn";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
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
        toast.success(t("Đã cập nhật thẻ hồ sơ"));
      } else {
        await createTag.mutateAsync({ clinicBranchId: branchId, name: trimmed, color });
        toast.success(t("Đã thêm thẻ hồ sơ"));
      }
      onClose();
    } catch (cause) {
      toast.error(extractApiError(cause));
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
      <div className="space-y-5">
        <FloatingField
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

        <fieldset className="space-y-2">
          <legend className="text-[14px] font-semibold text-app-ink">{t("Màu")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={t("Chọn màu {0}", preset)}
                aria-pressed={color.toUpperCase() === preset}
                onClick={() => setColor(preset)}
                style={{ backgroundColor: preset }}
                className={cn(
                  "size-10 cursor-pointer rounded-full transition-transform hover:scale-110",
                  color.toUpperCase() === preset && "ring-2 ring-app-ink ring-offset-2",
                )}
              />
            ))}

            <div className="relative">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-dashed border-app-line text-app-label"
              >
                <Pipette className="size-4" />
              </span>
              <input
                type="color"
                aria-label={t("Chọn màu tuỳ chỉnh")}
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </div>
          </div>
        </fieldset>

        <div className="space-y-2 rounded-xl bg-app-surface p-4">
          <p className="text-[12px] text-app-label">{t("Xem trước")}</p>
          <span
            style={{ backgroundColor: color }}
            className="inline-flex items-center rounded-md px-3 py-1 text-[12px] font-semibold text-white"
          >
            {name.trim() || t("Khách hàng mới")}
          </span>
        </div>
      </div>
    </AppDialog>
  );
}
