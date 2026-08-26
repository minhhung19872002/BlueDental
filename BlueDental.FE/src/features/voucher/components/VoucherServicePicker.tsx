import { useCallback, useMemo, useState } from "react";
import { Form, Select, Tooltip } from "antd";
import type { FormInstance } from "antd";
import { BookOpen, Folder, FolderTree, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import {
  useCatalogEntries,
  useTaxonomyGroups,
  TAXONOMY_GROUP,
  type CatalogEntryQuery,
} from "@/features/taxonomy/api/taxonomyApi";
import type { VoucherFormValues } from "../types/voucherForm";

const ENTRIES_QUERY: CatalogEntryQuery = {
  scope: "catalog",
  skipCount: 0,
  maxResultCount: 500,
};

interface ServiceOption {
  value: string;
  label: string;
  price: number | null;
  kind: "group" | "service";
}

interface Props {
  form: FormInstance<VoucherFormValues>;
}

/**
 * The ref's picker browses either service groups (folder rows) or individual
 * services (price on the right); the icon button inside the field flips
 * between the two lists. Selections from the hidden list stay valid — the
 * chips below the field resolve their names from both lists, so the dropdown
 * only ever shows the active mode's options.
 */
export function VoucherServicePicker({ form }: Props) {
  const branchId = useCurrentBranchId();
  const [mode, setMode] = useState<"group" | "service">("group");
  const [open, setOpen] = useState(false);
  const selected = Form.useWatch("targetIds", form) ?? [];

  const { data: groups } = useTaxonomyGroups(branchId, TAXONOMY_GROUP.CareService);
  const { data: entries } = useCatalogEntries(
    branchId,
    TAXONOMY_GROUP.CareService,
    ENTRIES_QUERY,
  );

  const groupOptions = useMemo<ServiceOption[]>(
    () =>
      (groups?.items ?? []).map((g) => ({
        value: g.id,
        label: g.name,
        price: null,
        kind: "group",
      })),
    [groups],
  );

  const serviceOptions = useMemo<ServiceOption[]>(
    () =>
      (entries?.items ?? []).map((e) => ({
        value: e.id,
        label: e.name,
        price: e.price,
        kind: "service",
      })),
    [entries],
  );

  const options = mode === "group" ? groupOptions : serviceOptions;

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "group" ? "service" : "group"));
    setOpen(true);
  }, []);

  const removeSelected = useCallback(
    (id: string) => {
      const current: string[] = form.getFieldValue("targetIds") ?? [];
      form.setFieldsValue({ targetIds: current.filter((v) => v !== id) });
    },
    [form],
  );

  const optionByValue = useMemo(
    () =>
      new Map(
        [...groupOptions, ...serviceOptions].map((o) => [o.value, o]),
      ),
    [groupOptions, serviceOptions],
  );

  return (
    <div className="voucher-service-picker">
      {/* The ref keeps the search field looking empty — selections render as
          chips below it, so the field neither shows tags nor floats its label. */}
      <FloatingField
        name="targetIds"
        label={t("Tìm dịch vụ hoặc nhóm dịch vụ...")}
        floatOnValue={false}
      >
        <Select<string[], ServiceOption>
          mode="multiple"
          options={options}
          open={open}
          onOpenChange={setOpen}
          suffixIcon={null}
          tagRender={() => <></>}
          classNames={{ popup: { root: "voucher-service-dropdown" } }}
          filterOption={(input, option) =>
            option?.label.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          optionRender={(option) =>
            option.data.kind === "group" ? (
              <span className="voucher-opt-group">
                <Folder size={16} />
                {option.data.label}
              </span>
            ) : (
              <span className="voucher-opt-service">
                <span className="voucher-opt-name">{option.data.label}</span>
                {option.data.price !== null && (
                  <span className="voucher-opt-price">{formatVND(option.data.price)} đ</span>
                )}
              </span>
            )
          }
        />
      </FloatingField>
      <Tooltip title={mode === "service" ? t("Dịch vụ") : t("Nhóm dịch vụ")}>
        <button
          type="button"
          className={`voucher-service-toggle voucher-service-toggle--${mode}`}
          aria-label={mode === "service" ? t("Dịch vụ") : t("Nhóm dịch vụ")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleMode}
        >
          {mode === "service" ? <BookOpen size={16} /> : <Folder size={16} />}
        </button>
      </Tooltip>
      {selected.length > 0 && (
        <div className="voucher-service-chips">
          {selected.map((id) => {
            const option = optionByValue.get(id);
            if (!option) return null;
            return (
              <span
                key={id}
                className={[
                  "voucher-service-chip",
                  option.kind === "group" && "voucher-service-chip--group",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {option.kind === "group" && (
                  <FolderTree size={16} className="voucher-service-chip-icon" />
                )}
                <span className="voucher-service-chip-name">{option.label}</span>
                {option.price !== null && (
                  <span className="voucher-service-chip-price">
                    {formatVND(option.price)} đ
                  </span>
                )}
                <button
                  type="button"
                  className="voucher-service-chip-remove"
                  aria-label={t("Bỏ chọn {0}", option.label)}
                  onClick={() => removeSelected(id)}
                >
                  <X size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
