import { Button, Empty, Input, Spin } from "antd";
import { useState, type UIEvent } from "react";
import { CloseOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useComboServiceSearch, type CatalogEntryDto } from "../api/taxonomyApi";

interface Props {
  branchId: string | undefined;
  enabled: boolean;
  /** How many of each service the combo already holds. */
  quantities: ReadonlyMap<string, number>;
  onPick: (service: CatalogEntryDto) => void;
  onRemove: (serviceId: string) => void;
}

/** Load the next page this close to the bottom of the list. */
const LOAD_MORE_THRESHOLD_PX = 48;

/**
 * The combo dialog's left column: the branch's single services from Danh mục,
 * searched on the server. A service already in the combo is highlighted and its
 * button turns into ×, which takes it out again; its quantity lives in the table.
 */
export function ComboServicePicker({ branchId, enabled, quantities, onPick, onRemove }: Props) {
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 300);
  const query = useComboServiceSearch(branchId, term, enabled);
  const services = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.totalCount ?? 0;

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < LOAD_MORE_THRESHOLD_PX) loadMore();
  };

  return (
    <aside className="bd-combo-picker" aria-label={t("Taxonomy:Combo:PickerTitle")}>
      <p className="bd-combo-picker-title">{t("Taxonomy:Combo:PickerTitle")}</p>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder={t("Taxonomy:Combo:SearchPlaceholder")}
        aria-label={t("Taxonomy:Combo:SearchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="bd-combo-chips">
        <span className="bd-combo-chip bd-combo-chip--active">
          {t("Taxonomy:Combo:ServiceChip", total)}
        </span>
      </div>

      <div className="bd-combo-picker-list" onScroll={handleScroll}>
        <PickerItems
          loading={enabled && query.isPending}
          services={services}
          quantities={quantities}
          onPick={onPick}
          onRemove={onRemove}
        />
        {query.hasNextPage && (
          <Button type="link" block loading={query.isFetchingNextPage} onClick={loadMore}>
            {t("Taxonomy:Combo:LoadMore")}
          </Button>
        )}
      </div>
    </aside>
  );
}

type PickerItemsProps = Omit<Props, "branchId" | "enabled"> & {
  loading: boolean;
  services: CatalogEntryDto[];
};

function PickerItems({ loading, services, quantities, onPick, onRemove }: PickerItemsProps) {
  if (loading)
    return (
      <div className="bd-combo-picker-empty">
        <Spin />
      </div>
    );
  if (services.length === 0)
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Taxonomy:Combo:PickerEmpty")} />
    );
  return services.map((service) => (
    <PickerItem
      key={service.id}
      service={service}
      inCombo={quantities.get(service.id) ?? 0}
      onPick={onPick}
      onRemove={onRemove}
    />
  ));
}

function PickerItem({
  service,
  inCombo,
  onPick,
  onRemove,
}: {
  service: CatalogEntryDto;
  inCombo: number;
  onPick: (service: CatalogEntryDto) => void;
  onRemove: (serviceId: string) => void;
}) {
  const picked = inCombo > 0;
  const handleClick = () => (picked ? onRemove(service.id) : onPick(service));
  return (
    <div className={picked ? "bd-combo-item bd-combo-item--picked" : "bd-combo-item"}>
      <div className="bd-min0">
        <p className="bd-combo-item-name">{service.name}</p>
        <p className="bd-combo-item-sub">
          {[service.taxonomyName, t("Taxonomy:Combo:Amount", formatVND(service.price ?? 0))]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {picked && (
          <span className="bd-combo-item-badge">{t("Taxonomy:Combo:InCombo", inCombo)}</span>
        )}
      </div>
      <Button
        type={picked ? "default" : "primary"}
        ghost={!picked}
        danger={picked}
        size="small"
        icon={picked ? <CloseOutlined /> : <PlusOutlined />}
        aria-label={t(picked ? "Taxonomy:Combo:RemoveAria" : "Taxonomy:Combo:AddAria", service.name)}
        onClick={handleClick}
      />
    </div>
  );
}
