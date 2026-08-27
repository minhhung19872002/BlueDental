import { useMemo, useState } from "react";
import { Checkbox } from "antd";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * "Tiểu sử bệnh" — the Lịch sử bệnh catalog as collapsible groups of tickboxes.
 *
 * The reference opens every group closed and keeps the ticks in one flat list
 * of entry ids, so a group being renamed or moved does not lose what was
 * recorded against a patient.
 */
export function PatientDiseaseHistoryPanel({ value, onChange }: Props) {
  const groups = useTaxonomyGroupOptions(CATALOG_GROUP.DiseaseHistory);
  const entries = useCatalogOptions(CATALOG_GROUP.DiseaseHistory);
  const [expanded, setExpanded] = useState<string | null>(null);

  const entriesByGroup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const entry of entries.data ?? []) {
      const bucket = map.get(entry.taxonomyId);
      if (bucket) bucket.push(entry);
      else map.set(entry.taxonomyId, [entry]);
    }
    return map;
  }, [entries.data]);

  const toggle = (entryId: string, checked: boolean) => {
    onChange(checked ? [...value, entryId] : value.filter((id) => id !== entryId));
  };

  const rows = groups.data ?? [];

  if (rows.length === 0) {
    return <p className="bd-patient-dim">{t("Danh mục lịch sử bệnh chưa có nhóm nào")}</p>;
  }

  return (
    <div className="bd-patient-history">
      <p className="bd-patient-history-title">{t("TIỂU SỬ BỆNH")}</p>

      {rows.map((group) => {
        const items = entriesByGroup.get(group.id) ?? [];
        const isOpen = expanded === group.id;
        const ticked = items.filter((item) => value.includes(item.id)).length;

        return (
          <div key={group.id} className="bd-patient-history-group">
            <button
              type="button"
              className="bd-patient-history-head"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : group.id)}
            >
              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
              {group.name}
              {ticked > 0 && <span className="bd-patient-history-count">{ticked}</span>}
            </button>

            {isOpen && (
              <div className="bd-patient-history-body">
                {/* The groups and their entries are two queries. Until the
                    second lands every group looks empty, and saying so would be
                    a lie the user acts on. */}
                {items.length === 0 && entries.isPending ? (
                  <span className="bd-patient-dim">{t("Đang tải…")}</span>
                ) : items.length === 0 ? (
                  <span className="bd-patient-dim">{t("Nhóm này chưa có mục nào")}</span>
                ) : (
                  items.map((item) => (
                    <Checkbox
                      key={item.id}
                      checked={value.includes(item.id)}
                      onChange={(event) => toggle(item.id, event.target.checked)}
                    >
                      {item.name}
                    </Checkbox>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
