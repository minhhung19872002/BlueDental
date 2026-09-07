import { useMemo, useRef, useState } from "react";
import { Select, Tooltip } from "antd";
import type { RefSelectProps } from "antd";
import { BookOpen, Folder } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import type { CatalogOption, TaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

type PickerMode = "service" | "group";

interface Props {
  services: CatalogOption[];
  groups: TaxonomyGroupOption[];
  loading?: boolean;
}

type PickerOption =
  | { value: string; label: string; kind: "service"; price: number }
  | { value: string; label: string; kind: "group" };

/**
 * "Thêm dịch vụ mới": the voucher form's service/group picker, single-select.
 * Folder mode lists service groups; picking one narrows the list to that
 * group's services and hops back to service mode. Book-open mode lists every
 * service with its price. Bound to the surrounding Form's `serviceId`.
 */
export function PlanServicePicker({ services, groups, loading }: Props) {
  const [mode, setMode] = useState<PickerMode>("service");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selectRef = useRef<RefSelectProps>(null);

  const options = useMemo<PickerOption[]>(() => {
    if (mode === "group") {
      return groups.map((group) => ({ value: group.id, label: group.name, kind: "group" }));
    }
    return services
      .filter((service) => !groupId || service.taxonomyId === groupId)
      .map((service) => ({
        value: service.id,
        label: service.name,
        kind: "service",
        price: service.price ?? 0,
      }));
  }, [mode, groups, services, groupId]);

  const toggleMode = () => {
    setMode((current) => (current === "service" ? "group" : "service"));
    setGroupId(null);
    setOpen(true);
    // The reference hands focus to the field, so the label floats and the
    // border turns blue as soon as the mode flips.
    selectRef.current?.focus();
  };

  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);

  return (
    <div className="tp-service-picker">
      <FloatingField
        name="serviceId"
        label={t("Thêm dịch vụ mới")}
        rules={[{ required: true, message: t("Vui lòng chọn dịch vụ") }]}
        // A group id must never settle into the field; only a service is a value.
        getValueFromEvent={(value: string | undefined) =>
          value && groupIds.has(value) ? undefined : value
        }
      >
        <Select<string, PickerOption>
          ref={selectRef}
          showSearch
          allowClear
          loading={loading}
          open={open}
          onOpenChange={setOpen}
          options={options}
          optionFilterProp="label"
          notFoundContent={
            mode === "group" ? t("Không tìm thấy nhóm dịch vụ") : t("Không tìm thấy dịch vụ")
          }
          classNames={{ popup: { root: "tp-service-dropdown" } }}
          onSelect={(value, option) => {
            if (option.kind === "group") {
              setGroupId(value);
              setMode("service");
              setOpen(true);
            } else {
              setOpen(false);
            }
          }}
          optionRender={({ data }) =>
            data.kind === "group" ? (
              <span className="tp-opt-group">
                <Folder size={16} aria-hidden="true" />
                {data.label}
              </span>
            ) : (
              <span className="tp-opt-service">
                <span className="tp-opt-name">{data.label}</span>
                <span className="tp-opt-price">{formatVND(data.price)} đ</span>
              </span>
            )
          }
        />
      </FloatingField>
      <Tooltip title={mode === "service" ? t("Chuyển sang nhóm dịch vụ") : t("Chuyển sang dịch vụ")}>
        <button
          type="button"
          className="tp-service-toggle"
          aria-label={mode === "service" ? t("Chuyển sang nhóm dịch vụ") : t("Chuyển sang dịch vụ")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleMode}
        >
          {mode === "service" ? (
            <Folder size={16} aria-hidden="true" />
          ) : (
            <BookOpen size={16} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
