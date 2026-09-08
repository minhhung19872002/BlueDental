import { useMemo, useRef, useState, type ReactElement } from "react";
import { Form, Select, Tooltip } from "antd";
import type { RefSelectProps } from "antd";
import { ArrowLeft, BookOpen, Folder } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import type { CatalogOption, TaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { moneyText } from "./planTypes";

type PickerMode = "service" | "group";

interface Props {
  services: CatalogOption[];
  groups: TaxonomyGroupOption[];
  loading?: boolean;
  /** Editing a slip: the service is shown but cannot be swapped. */
  disabled?: boolean;
  /** A service was chosen, from the list or from a group's table. */
  onPickService?: (service: CatalogOption) => void;
}

interface ServiceOption {
  value: string;
  label: string;
  price: number;
}

interface GroupListProps {
  groups: TaxonomyGroupOption[];
  onOpen: (group: TaxonomyGroupOption) => void;
}

/** Group mode, nothing opened yet: the groups, a folder in front of each. */
function GroupList({ groups, onOpen }: GroupListProps) {
  if (groups.length === 0) {
    return <div className="tp-group-list-empty">{t("Không tìm thấy nhóm dịch vụ")}</div>;
  }
  return (
    // Mouse-down inside the popup would blur the field and close it before the click lands.
    <div className="tp-group-list" role="listbox" onMouseDown={(event) => event.preventDefault()}>
      {groups.map((group) => (
        <button
          type="button"
          key={group.id}
          role="option"
          aria-selected={false}
          className="tp-group-item"
          onClick={() => onOpen(group)}
        >
          <Folder size={16} aria-hidden="true" />
          {group.name}
        </button>
      ))}
    </div>
  );
}

interface GroupPanelProps {
  group: TaxonomyGroupOption;
  services: CatalogOption[];
  onBack: () => void;
  onPick: (service: CatalogOption) => void;
}

/**
 * Group mode, after a group is clicked: the popover swaps the list for a
 * round back button with the group's name and a bordered table of its
 * services. Clicking a row picks that service.
 */
function GroupServicesPanel({ group, services, onBack, onPick }: GroupPanelProps) {
  return (
    <div className="tp-group-panel" onMouseDown={(event) => event.preventDefault()}>
      <div className="tp-group-head">
        <button type="button" className="tp-group-back" aria-label={t("Quay lại")} onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
        <span className="tp-group-title">{group.name}</span>
      </div>
      <div className="tp-group-table-wrap">
        <table className="tp-group-table">
          <thead>
            <tr>
              <th>{t("Dịch vụ")}</th>
              <th className="tp-num">{t("Giá gốc")}</th>
              <th className="tp-num">{t("Giảm giá")}</th>
              <th className="tp-num">{t("Thành tiền")}</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 && (
              <tr>
                <td colSpan={4} className="tp-group-empty">
                  {t("Không tìm thấy dịch vụ")}
                </td>
              </tr>
            )}
            {services.map((service) => (
              <tr key={service.id} role="button" tabIndex={0} onClick={() => onPick(service)}>
                <td>{service.name}</td>
                <td className="tp-num">{moneyText(service.price ?? 0)}</td>
                <td className="tp-num">{moneyText(0)}</td>
                <td className="tp-num">{moneyText(service.price ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function matches(name: string, search: string): boolean {
  return name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"));
}

/**
 * "Thêm dịch vụ mới": the service/group picker, single-select. Book-open
 * mode lists every service with its price. Folder mode lists the groups;
 * clicking one shows that group's services as a table inside the popover.
 *
 * Only services are ever options of the Select. The groups are drawn by hand
 * inside the popup, so opening one never touches the field's value, never
 * closes the popover and never trips the "required" rule. Bound to the
 * surrounding Form's `serviceId`; `onPickService` fires with the catalog
 * entry whichever way it was chosen.
 */
export function PlanServicePicker({ services, groups, loading, disabled, onPickService }: Props) {
  const form = Form.useFormInstance();
  const [mode, setMode] = useState<PickerMode>("service");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectRef = useRef<RefSelectProps>(null);

  const options = useMemo<ServiceOption[]>(
    () =>
      services.map((service) => ({
        value: service.id,
        label: service.name,
        price: service.price ?? 0,
      })),
    [services],
  );

  const openGroup = groupId ? (groups.find((group) => group.id === groupId) ?? null) : null;
  const visibleGroups = useMemo(
    () => groups.filter((group) => matches(group.name, search)),
    [groups, search],
  );
  const groupServices = useMemo(
    () => (groupId ? services.filter((service) => service.taxonomyId === groupId) : []),
    [services, groupId],
  );

  const toggleMode = () => {
    setMode((current) => (current === "service" ? "group" : "service"));
    setGroupId(null);
    setOpen(true);
    // The reference hands focus to the field, so the label floats and the
    // border turns blue as soon as the mode flips.
    selectRef.current?.focus();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setGroupId(null);
      setSearch("");
    }
  };

  const handlePanelPick = (service: CatalogOption) => {
    form.setFieldValue("serviceId", service.id);
    onPickService?.(service);
    setGroupId(null);
    setOpen(false);
  };

  const renderPopup = (menu: ReactElement) => {
    if (mode === "service") return menu;
    if (openGroup) {
      return (
        <GroupServicesPanel
          group={openGroup}
          services={groupServices}
          onBack={() => setGroupId(null)}
          onPick={handlePanelPick}
        />
      );
    }
    return <GroupList groups={visibleGroups} onOpen={(group) => setGroupId(group.id)} />;
  };

  return (
    <div className="tp-service-picker">
      <FloatingField
        name="serviceId"
        label={t("Thêm dịch vụ mới")}
        rules={[{ required: true, message: t("Vui lòng chọn dịch vụ") }]}
      >
        <Select<string, ServiceOption>
          ref={selectRef}
          showSearch
          allowClear={!disabled}
          disabled={disabled}
          loading={loading}
          open={open}
          onOpenChange={handleOpenChange}
          onSearch={setSearch}
          options={options}
          optionFilterProp="label"
          popupMatchSelectWidth={!openGroup}
          notFoundContent={t("Không tìm thấy dịch vụ")}
          classNames={{ popup: { root: "tp-service-dropdown" } }}
          popupRender={renderPopup}
          onSelect={(value) => {
            const service = services.find((item) => item.id === value);
            if (service) onPickService?.(service);
            setOpen(false);
          }}
          optionRender={({ data }) => (
            <span className="tp-opt-service">
              <span className="tp-opt-name">{data.label}</span>
              <span className="tp-opt-price">{formatMoneyUnit(data.price)}</span>
            </span>
          )}
        />
      </FloatingField>
      {!disabled && (
        <Tooltip
          title={mode === "service" ? t("Chuyển sang nhóm dịch vụ") : t("Chuyển sang dịch vụ")}
        >
          <button
            type="button"
            className="tp-service-toggle"
            aria-label={
              mode === "service" ? t("Chuyển sang nhóm dịch vụ") : t("Chuyển sang dịch vụ")
            }
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
      )}
    </div>
  );
}
