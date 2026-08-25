import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Spin } from "antd";
import type { CatalogEntryDto } from "../api/taxonomyApi";
import { LetterAvatar } from "@/components/LetterAvatar";
import { useDragReorder } from "@/hooks/useDragReorder";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";

const HEAD_CELL =
  "bd-cat-th";
const BODY_CELL = "bd-cat-td";
/** The actions column stays pinned while the table scrolls sideways. */
const STICKY_END = "bd-cat-sticky";

interface Props {
  entries: CatalogEntryDto[];
  /** Header of the name column, e.g. "Tên dịch vụ". */
  entityLabel: string;
  priced: boolean;
  /** Flat catalogs have no groups, so the group badge column is dropped. */
  showGroupColumn: boolean;
  isLoading: boolean;
  emptyText?: string;
  canReorder: boolean;
  onEdit: (entry: CatalogEntryDto) => void;
  onDelete: (entry: CatalogEntryDto) => void;
  onReorder: (fromIndex: number, toIndex: number) => void | Promise<void>;
}

/**
 * Entry table of a catalog group.
 *
 * The grip is a real button, not a decoration: rows swap under the pointer as
 * it drags, and the same move is available from the keyboard once the grip has
 * focus, so the order is not reachable by pointer alone.
 */
export function CatalogEntryTable({
  entries,
  entityLabel,
  priced,
  showGroupColumn,
  isLoading,
  emptyText,
  canReorder,
  onEdit,
  onDelete,
  onReorder,
}: Props) {
  const columnCount = 4 + (priced ? 1 : 0) + (showGroupColumn ? 1 : 0);

  const drag = useDragReorder({
    items: entries,
    getKey: (entry) => entry.id,
    enabled: canReorder,
    onCommit: onReorder,
  });

  return (
    <div className="bd-cat-scroll">
      {isLoading && (
        <div className="bd-cat-busy">
          <Spin size="large" />
        </div>
      )}

      <table className="bd-cat-table">
        <thead>
          <tr>
            <th className={cn(HEAD_CELL, "bd-w12")}>
              <span className="bd-sr-only">{t("Sắp xếp")}</span>
            </th>
            <th className={HEAD_CELL}>{entityLabel}</th>
            {showGroupColumn && <th className={HEAD_CELL}>{t("Nhóm phân loại")}</th>}
            {priced && <th className={cn(HEAD_CELL, "bd-text-right")}>{t("Giá")}</th>}
            <th className={HEAD_CELL}>{t("Cập nhật gần nhất")}</th>
            <th className={cn(HEAD_CELL, "bd-z20 bd-text-center", STICKY_END)}>{t("Thao tác")}</th>
          </tr>
        </thead>

        <tbody className="bd-cat-tbody">
          {drag.items.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="bd-cat-emptycell"
              >
                {emptyText ?? t("Không có dữ liệu")}
              </td>
            </tr>
          ) : (
            drag.items.map((entry, index) => (
              <tr
                key={entry.id}
                ref={drag.registerRow(entry.id)}
                className={cn(
                  "bd-cat-row",
                  drag.draggingKey === entry.id &&
                    "bd-cat-row--dragging",
                )}
              >
                <td className={BODY_CELL}>
                  <button
                    type="button"
                    disabled={!canReorder}
                    title={t("Kéo, hoặc dùng phím mũi tên lên/xuống, để sắp xếp")}
                    aria-label={t("Sắp xếp {0}", entry.name)}
                    {...drag.handleProps(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp" && index > 0) {
                        event.preventDefault();
                        void onReorder(index, index - 1);
                      }
                      if (event.key === "ArrowDown" && index < drag.items.length - 1) {
                        event.preventDefault();
                        void onReorder(index, index + 1);
                      }
                    }}
                    className={cn(
                      "bd-grip",
                      !canReorder && "bd-grip--off",
                    )}
                  >
                    <GripVertical className="bd-icon" aria-hidden="true" />
                  </button>
                </td>

                <td className={BODY_CELL}>
                  <div className="bd-cat-inline3">
                    <LetterAvatar name={entry.name} />
                    <div className="bd-min0">
                      <p className="bd-cat-name">{entry.name}</p>
                      {entry.code && (
                        <p className="bd-cat-subtle">{entry.code}</p>
                      )}
                    </div>
                  </div>
                </td>

                {showGroupColumn && (
                  <td className={BODY_CELL}>
                    {entry.taxonomyName ? (
                      <span className="bd-cat-chip">
                        {entry.taxonomyName}
                      </span>
                    ) : (
                      <span className="bd-muted-text">—</span>
                    )}
                  </td>
                )}

                {priced && (
                  <td className={cn(BODY_CELL, "bd-text-right")}>
                    <span className="bd-cat-price">
                      {entry.price == null ? "—" : `${formatVND(entry.price)} đ`}
                    </span>
                  </td>
                )}

                <td className={BODY_CELL}>
                  <span className="bd-cat-num">
                    {formatDateTime(entry.lastModificationTime ?? entry.creationTime)}
                  </span>
                </td>

                <td
                  className={cn(
                    BODY_CELL,
                    "bd-cat-td--actions",
                    STICKY_END,
                  )}
                >
                  <div className="bd-cat-rowactions">
                    <button
                      type="button"
                      aria-label={t("Chỉnh sửa {0}", entry.name)}
                      onClick={() => onEdit(entry)}
                      className="bd-cat-iconbtn"
                    >
                      <Pencil className="bd-icon bd-icon--sm" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Xoá {0}", entry.name)}
                      onClick={() => onDelete(entry)}
                      className="bd-cat-iconbtn bd-cat-iconbtn--danger"
                    >
                      <Trash2 className="bd-icon bd-icon--sm" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
