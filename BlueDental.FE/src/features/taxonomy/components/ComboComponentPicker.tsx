import { useMemo, useState } from "react";
import { Button, Input, Spin } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useComboComponentOptions, type CatalogEntryDto, type TaxonomyDto } from "../api/taxonomyApi";
import type { ComboRowDraft } from "../api/comboPricing";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";

interface Props {
  branchId: string;
  groups: TaxonomyDto[];
  rows: ComboRowDraft[];
  onAdd: (service: CatalogEntryDto) => void;
}

/**
 * "Danh mục" beside the combo form (review P0510): the single services of
 * the catalogue, searched on the server and narrowed by group. "+" puts a
 * service in the combo — or one more of it, which the "+N trong combo"
 * badge counts.
 */
export function ComboComponentPicker({ branchId, groups, rows, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [taxonomyId, setTaxonomyId] = useState<string | null>(null);
  const term = useDebounce(search, 300);
  const options = useComboComponentOptions(branchId, taxonomyId, term, true);
  const items = options.data?.items ?? [];

  const inCombo = useMemo(
    () => new Map(rows.map((row) => [row.componentEntryId, row.quantity])),
    [rows],
  );

  return (
    <aside className="bd-combo-picker" aria-label={t("Taxonomy:Combo:PickerTitle")}>
      <p className="bd-combo-picker-title">{t("Taxonomy:Combo:PickerTitle")}</p>
      <span className="bd-combo-picker-tab">
        {t("Taxonomy:Combo:PickerServices", options.data?.totalCount ?? 0)}
      </span>

      <Input
        className="bd-combo-picker-search"
        prefix={<SearchOutlined />}
        allowClear
        placeholder={t("Taxonomy:Combo:PickerSearch")}
        aria-label={t("Taxonomy:Combo:PickerSearch")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="bd-combo-picker-groups" role="group" aria-label={t("Taxonomy:Group:Title", t("Taxonomy:Combo:ServiceNoun"))}>
        <button
          type="button"
          className={taxonomyId === null ? "active" : undefined}
          aria-pressed={taxonomyId === null}
          onClick={() => setTaxonomyId(null)}
        >
          {t("Taxonomy:Combo:PickerAll")}
        </button>
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            title={group.name}
            className={taxonomyId === group.id ? "active" : undefined}
            aria-pressed={taxonomyId === group.id}
            onClick={() => setTaxonomyId(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>

      <ul className="bd-combo-picker-list">
        {options.isLoading && (
          <li className="bd-combo-picker-empty">
            <Spin size="small" />
          </li>
        )}
        {!options.isLoading && items.length === 0 && (
          <li className="bd-combo-picker-empty">{t("Common:NoResults")}</li>
        )}
        {items.map((service) => {
          const count = inCombo.get(service.id);
          return (
            <li key={service.id} className="bd-combo-picker-item">
              <div className="bd-min0">
                <p className="bd-combo-picker-name">{service.name}</p>
                <p className="bd-cat-subtle">
                  {service.taxonomyName} · {formatMoneyUnit(service.price ?? 0)}
                </p>
              </div>
              {count ? <span className="bd-combo-picker-badge">{t("Taxonomy:Combo:InCombo", count)}</span> : null}
              <Button
                size="small"
                icon={<PlusOutlined />}
                aria-label={t("Taxonomy:Combo:AddComponent", service.name)}
                onClick={() => onAdd(service)}
              />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
