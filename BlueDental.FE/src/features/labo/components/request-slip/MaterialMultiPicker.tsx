import { useState } from "react";
import { Checkbox, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { LaboMaterialOption } from "@/hooks/useLaboPickers";
import { matchesSearch } from "@/utils/foldForSearch";
import { MaterialChips } from "./MaterialChips";
import { SectionBadge } from "./SectionBadge";

interface Props {
  /** The Vật liệu of the picked Dịch vụ; empty while none is picked. */
  options: LaboMaterialOption[];
  serviceId: string | undefined;
  value: string[];
  editable: boolean;
  onChange: (materialIds: string[]) => void;
}

type Filter = "all" | "picked";
const FILTERS: readonly Filter[] = ["all", "picked"];

/** Why the list is empty, in the mock's words. */
function emptyText(serviceId: string | undefined, total: number, filter: Filter, query: string): string {
  if (!serviceId) return t("Patient:Stage:SelectServiceFirst");
  if (total === 0) return t("Patient:Labo:NoMaterial");
  if (filter === "picked" && !query.trim()) return t("Labo:Slip:NoPickedMaterial");
  return t("Labo:Slip:MaterialNotFound", query.trim());
}

/**
 * Vật liệu * of the Phiếu yêu cầu (P1311): any of the picked Dịch vụ's
 * materials, ticked in a list searched accent-blind, the picks as chips with
 * Bỏ chọn tất cả, and Tất cả / Đã chọn to narrow the list. The parent mounts
 * a fresh one per Dịch vụ, so search and filter start over with it.
 */
export function MaterialMultiPicker({ options, serviceId, value, editable, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((one) => one !== id) : [...value, id]);
  const picked = value.flatMap((id) => options.filter((option) => option.value === id));
  const rows = options.filter(
    (option) => (filter === "all" || value.includes(option.value)) && matchesSearch(option.label, query),
  );

  return (
    <section className="rs-sec">
      <div className="rs-sech">
        <span>
          {t("Labo:Slip:Material")} <span className="rs-req">*</span>
        </span>
        <SectionBadge tone={value.length ? "ok" : "miss"}>
          {value.length ? t("Labo:Slip:PickedCount", String(value.length)) : t("Labo:Slip:NotPicked")}
        </SectionBadge>
      </div>
      <div className="rs-mtools">
        <Input
          className="rs-msearch"
          prefix={<SearchOutlined aria-hidden="true" />}
          value={query}
          allowClear
          maxLength={100}
          disabled={!serviceId}
          placeholder={t("Labo:Slip:MaterialSearch", String(options.length))}
          aria-label={t("Labo:Slip:MaterialSearchAria")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <MaterialChips picked={picked} editable={editable} onRemove={toggle} onClear={() => onChange([])} />
        <div className="rs-mfilter" role="group" aria-label={t("Labo:Slip:FilterAria")}>
          {FILTERS.map((one) => (
            <button
              key={one}
              type="button"
              className={filter === one ? "rs-on" : undefined}
              aria-pressed={filter === one}
              onClick={() => setFilter(one)}
            >
              {one === "all"
                ? t("Labo:Slip:FilterAll", String(options.length))
                : t("Labo:Slip:FilterPicked", String(picked.length))}
            </button>
          ))}
        </div>
      </div>
      <div className="rs-mlist">
        {rows.map((option) => {
          const on = value.includes(option.value);
          return (
            <label key={option.value} className={on ? "rs-krow rs-on" : "rs-krow"}>
              <span className="rs-grow">{option.label}</span>
              <Checkbox checked={on} disabled={!editable} onChange={() => toggle(option.value)} />
            </label>
          );
        })}
        {rows.length === 0 && <p className="rs-empty">{emptyText(serviceId, options.length, filter, query)}</p>}
      </div>
    </section>
  );
}
