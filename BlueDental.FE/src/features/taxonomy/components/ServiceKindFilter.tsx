import { Segmented } from "antd";
import { Layers } from "lucide-react";
import type { CatalogEntryKindCounts, ServiceKindFilter as Kind } from "../api/taxonomyApi";
import { t } from "@/lib/i18n";

interface Props {
  value: Kind;
  counts: CatalogEntryKindCounts | undefined;
  onChange: (next: Kind) => void;
}

/** "Tất cả (8) · Dịch vụ lẻ (5) · Combo (3)" beside the Dịch vụ search (review P0510). */
export function ServiceKindFilter({ value, counts, onChange }: Props) {
  return (
    <Segmented<Kind>
      className="bd-kind-filter"
      aria-label={t("Taxonomy:Combo:Kind")}
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: t("Taxonomy:Combo:FilterAll", counts?.total ?? 0) },
        { value: "single", label: t("Taxonomy:Combo:FilterSingle", counts?.single ?? 0) },
        {
          value: "combo",
          label: (
            <span className="bd-kind-switch-combo">
              <Layers size={14} aria-hidden="true" />
              {t("Taxonomy:Combo:FilterCombo", counts?.combo ?? 0)}
            </span>
          ),
        },
      ]}
    />
  );
}
