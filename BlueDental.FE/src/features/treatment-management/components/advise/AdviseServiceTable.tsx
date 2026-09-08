import { Checkbox, Input, Spin } from "antd";
import { Search } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { CatalogOption, TaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { AdviseServiceRow } from "./AdviseServiceRow";
import type { AdviseSelection } from "./useAdviseSelection";

interface Props {
  /** Services already narrowed by the active group and the search text. */
  services: CatalogOption[];
  groups: TaxonomyGroupOption[];
  loading: boolean;
  activeGroupId: string | null;
  selection: AdviseSelection;
  onGroupChange: (groupId: string | null) => void;
}

const COLUMNS = [
  { key: "service", label: "Dịch vụ" },
  { key: "price", label: "Đơn giá" },
  { key: "quantity", label: "Số lượng" },
  { key: "discount", label: "Giảm giá" },
  { key: "amount", label: "Thành tiền" },
  { key: "note", label: "Ghi chú" },
] as const;

/**
 * The service picker of "Chọn Dịch Vụ": one filter button per service group
 * with "Tất cả dịch vụ" first, a search box, then the table with a tick on
 * every row and a select-all in the header. Group buttons only filter — a
 * service is chosen by its tick, never by the group.
 */
export function AdviseServiceTable({
  services,
  groups,
  loading,
  activeGroupId,
  selection,
  onGroupChange,
}: Props) {
  const tickedOnScreen = services.filter((service) => selection.isSelected(service.id)).length;
  const allTicked = services.length > 0 && tickedOnScreen === services.length;

  return (
    <div className="am-services">
      <div className="am-toolbar">
        <div className="am-groups" role="group" aria-label={t("Nhóm dịch vụ")}>
          <button
            type="button"
            className={activeGroupId === null ? "am-group active" : "am-group"}
            aria-pressed={activeGroupId === null}
            onClick={() => onGroupChange(null)}
          >
            {t("Tất cả dịch vụ")}
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={activeGroupId === group.id ? "am-group active" : "am-group"}
              aria-pressed={activeGroupId === group.id}
              onClick={() => onGroupChange(group.id)}
            >
              {group.name}
            </button>
          ))}
        </div>
        <FloatingField name="search" label={t("Tìm kiếm dịch vụ...")} className="am-search">
          <Input allowClear prefix={<Search size={18} />} />
        </FloatingField>
      </div>

      <div className="am-table-card">
        <div className="am-table-scroll">
          <table className="am-table">
            <colgroup>
              <col className="am-col-check" />
              {COLUMNS.map((column) => (
                <col key={column.key} className={`am-col-${column.key}`} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="am-cell-check">
                  <Checkbox
                    checked={allTicked}
                    indeterminate={tickedOnScreen > 0 && !allTicked}
                    disabled={services.length === 0}
                    aria-label={t("Chọn tất cả dịch vụ")}
                    onChange={(event) => selection.toggleAll(services, event.target.checked)}
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.key}>{t(column.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="am-empty">
                    <Spin size="small" />
                  </td>
                </tr>
              )}
              {!loading && services.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="am-empty">
                    {t("Không có dịch vụ phù hợp")}
                  </td>
                </tr>
              )}
              {!loading &&
                services.map((service) => (
                  <AdviseServiceRow
                    key={service.id}
                    service={service}
                    draft={selection.rows.get(service.id) ?? null}
                    onToggle={selection.toggle}
                    onChange={selection.update}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
