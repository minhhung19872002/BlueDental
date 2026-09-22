import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { Form, Select, Spin, Tooltip } from "antd";
import type { RefSelectProps } from "antd";
import { ArrowLeft, BookOpen, Folder } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import {
  CATALOG_GROUP,
  useCatalogOptionSearch,
  useTaxonomyGroupSearch,
  type CatalogOption,
  type TaxonomyGroupOption,
} from "@/hooks/useCatalogOptions";
import { useDebounce } from "@/hooks/useDebounce";
import { useLoadMoreSentinel } from "@/hooks/useLoadMoreSentinel";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { moneyText } from "./planTypes";

type PickerMode = "service" | "group";

interface Props {
  /**
   * Options to show alongside whatever the search returns — the service a slip
   * already carries, so its name still renders once it has left the catalog.
   */
  extraServices?: CatalogOption[];
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
  loading: boolean;
  onOpen: (group: TaxonomyGroupOption) => void;
}

/** Group mode, nothing opened yet: the groups, a folder in front of each. */
function GroupList({ groups, loading, onOpen }: GroupListProps) {
  if (loading && groups.length === 0) {
    return (
      <div className="tp-group-list-empty">
        <Spin size="small" />
      </div>
    );
  }
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
  /** The group's own services, searched on the server like the flat list. */
  search: string;
  onBack: () => void;
  onPick: (service: CatalogOption) => void;
}

/**
 * Group mode, after a group is clicked: the popover swaps the list for a
 * round back button with the group's name and a bordered table of its
 * services. Clicking a row picks that service.
 */
function GroupServicesPanel({ group, search, onBack, onPick }: GroupPanelProps) {
  const query = useCatalogOptionSearch(CATALOG_GROUP.CareService, {
    search,
    taxonomyId: group.id,
  });
  const services = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const loadMore = useCallback(() => {
    void query.fetchNextPage();
  }, [query]);
  const sentinelRef = useLoadMoreSentinel(
    query.hasNextPage && !query.isFetchingNextPage,
    loadMore,
  );

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
                  {query.isFetching ? <Spin size="small" /> : t("Không tìm thấy dịch vụ")}
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
        <div ref={sentinelRef} className="tp-more-sentinel" />
        {query.isFetchingNextPage && (
          <div className="tp-more-spinner">
            <Spin size="small" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Thêm dịch vụ mới": the service/group picker, single-select. Book-open
 * mode lists services with their price. Folder mode lists the groups;
 * clicking one shows that group's services as a table inside the popover.
 *
 * **Both modes search on the server.** What is typed goes to the catalog
 * endpoint as `filter`, twenty rows at a time, and the popup asks for the next
 * page as it is scrolled — the reference does the same, and a catalog larger
 * than one page cannot be searched any other way.
 *
 * Only services are ever options of the Select. The groups are drawn by hand
 * inside the popup, so opening one never touches the field's value, never
 * closes the popover and never trips the "required" rule. Bound to the
 * surrounding Form's `serviceId`; `onPickService` fires with the catalog
 * entry whichever way it was chosen.
 */
export function PlanServicePicker({ extraServices, disabled, onPickService }: Props) {
  const form = Form.useFormInstance();
  const [mode, setMode] = useState<PickerMode>("service");
  const [group, setGroup] = useState<TaxonomyGroupOption | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const selectRef = useRef<RefSelectProps>(null);

  // Nothing is fetched until the popup is opened: a closed picker costs nothing.
  const flat = useCatalogOptionSearch(CATALOG_GROUP.CareService, {
    search: debouncedSearch,
    enabled: open && mode === "service",
  });
  const groups = useTaxonomyGroupSearch(
    CATALOG_GROUP.CareService,
    debouncedSearch,
    open && mode === "group" && group === null,
  );

  const services = useMemo(() => {
    const found = flat.data?.pages.flatMap((page) => page.items) ?? [];
    const extras = (extraServices ?? []).filter(
      (extra) => !found.some((item) => item.id === extra.id),
    );
    return [...found, ...extras];
  }, [flat.data, extraServices]);

  const options = useMemo<ServiceOption[]>(
    () =>
      services.map((service) => ({
        value: service.id,
        label: service.name,
        price: service.price ?? 0,
      })),
    [services],
  );

  const loadMore = useCallback(() => {
    void flat.fetchNextPage();
  }, [flat]);
  const sentinelRef = useLoadMoreSentinel(flat.hasNextPage && !flat.isFetchingNextPage, loadMore);

  // A picked service must stay named even after the search moves on, so the
  // last one is kept and merged back in when the current page lacks it.
  const [picked, setPicked] = useState<CatalogOption | null>(null);
  const remember = (service: CatalogOption) => {
    setPicked(service);
    onPickService?.(service);
  };

  const toggleMode = () => {
    setMode((current) => (current === "service" ? "group" : "service"));
    setGroup(null);
    setOpen(true);
    // The reference hands focus to the field, so the label floats and the
    // border turns blue as soon as the mode flips.
    selectRef.current?.focus();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setGroup(null);
      setSearch("");
    }
  };

  const handlePanelPick = (service: CatalogOption) => {
    form.setFieldValue("serviceId", service.id);
    remember(service);
    setGroup(null);
    setOpen(false);
  };

  const renderPopup = (menu: ReactElement) => {
    if (mode === "service") {
      return (
        <>
          {menu}
          <div ref={sentinelRef} className="tp-more-sentinel" />
          {flat.isFetchingNextPage && (
            <div className="tp-more-spinner">
              <Spin size="small" />
            </div>
          )}
        </>
      );
    }
    if (group) {
      return (
        <GroupServicesPanel
          group={group}
          search={debouncedSearch}
          onBack={() => setGroup(null)}
          onPick={handlePanelPick}
        />
      );
    }
    return (
      <GroupList
        groups={groups.data ?? []}
        loading={groups.isFetching}
        onOpen={(next) => setGroup(next)}
      />
    );
  };

  const pickedOptions = useMemo<ServiceOption[]>(
    () =>
      picked && !options.some((option) => option.value === picked.id)
        ? [...options, { value: picked.id, label: picked.name, price: picked.price ?? 0 }]
        : options,
    [options, picked],
  );

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
          loading={flat.isFetching && !flat.isFetchingNextPage}
          open={open}
          onOpenChange={handleOpenChange}
          searchValue={search}
          onSearch={setSearch}
          options={pickedOptions}
          // The server has already narrowed the list; matching again here would
          // drop rows whose match is on a code or a note rather than the name.
          filterOption={false}
          popupMatchSelectWidth={!group}
          notFoundContent={
            flat.isFetching ? <Spin size="small" /> : t("Không tìm thấy dịch vụ")
          }
          classNames={{ popup: { root: "tp-service-dropdown" } }}
          popupRender={renderPopup}
          onSelect={(value) => {
            const service = services.find((item) => item.id === value);
            if (service) remember(service);
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
