import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { CatalogEntryDto } from "../api/taxonomyApi";
import { LetterAvatar } from "@/components/LetterAvatar";
import { Spinner } from "@/components/Spinner";
import { useDragReorder } from "@/hooks/useDragReorder";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";

const HEAD_CELL =
  "sticky top-0 z-10 h-10 border-b border-app-line bg-app-surface px-4 py-2 text-left align-middle text-[14px] font-medium whitespace-nowrap text-app-label";
const BODY_CELL = "h-14 border-b border-app-line px-4 py-3 align-middle text-[14px] text-app-ink";
/** The actions column stays pinned while the table scrolls sideways. */
const STICKY_END = "sticky right-0 shadow-[-4px_0_6px_-2px_rgba(27,42,65,0.06)]";

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
    <div className="relative min-h-0 w-full flex-1 overflow-auto">
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
          <Spinner />
        </div>
      )}

      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={cn(HEAD_CELL, "w-12")}>
              <span className="sr-only">{t("Sắp xếp")}</span>
            </th>
            <th className={HEAD_CELL}>{entityLabel}</th>
            {showGroupColumn && <th className={HEAD_CELL}>{t("Nhóm phân loại")}</th>}
            {priced && <th className={cn(HEAD_CELL, "text-right")}>{t("Giá")}</th>}
            <th className={HEAD_CELL}>{t("Cập nhật gần nhất")}</th>
            <th className={cn(HEAD_CELL, "z-20 text-center", STICKY_END)}>{t("Thao tác")}</th>
          </tr>
        </thead>

        <tbody className="[&_tr:last-child_td]:border-b-0">
          {drag.items.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="h-32 border-app-line px-4 py-3 text-center align-middle text-[14px] text-app-label"
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
                  "group bg-white transition-colors hover:bg-app-surface",
                  drag.draggingKey === entry.id &&
                    "[&>td]:bg-app-primary-soft/60 [&>td]:shadow-[inset_0_0_0_9999px_rgba(28,53,102,0.04)]",
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
                      "inline-flex rounded text-app-icon outline-none",
                      "focus-visible:text-app-primary focus-visible:ring-2 focus-visible:ring-app-primary/40",
                      canReorder
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-not-allowed opacity-50",
                    )}
                  >
                    <GripVertical className="size-4" aria-hidden="true" />
                  </button>
                </td>

                <td className={BODY_CELL}>
                  <div className="flex items-center gap-3">
                    <LetterAvatar name={entry.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.name}</p>
                      {entry.code && (
                        <p className="truncate text-[12px] text-app-label">{entry.code}</p>
                      )}
                    </div>
                  </div>
                </td>

                {showGroupColumn && (
                  <td className={BODY_CELL}>
                    {entry.taxonomyName ? (
                      <span className="inline-flex h-6 w-fit shrink-0 items-center rounded-md bg-app-surface px-2.5 text-[12px] font-medium whitespace-nowrap text-app-label">
                        {entry.taxonomyName}
                      </span>
                    ) : (
                      <span className="text-app-label">—</span>
                    )}
                  </td>
                )}

                {priced && (
                  <td className={cn(BODY_CELL, "text-right")}>
                    <span className="font-semibold tabular-nums text-app-ink">
                      {entry.price == null ? "—" : `${formatVND(entry.price)} đ`}
                    </span>
                  </td>
                )}

                <td className={BODY_CELL}>
                  <span className="tabular-nums text-app-label">
                    {formatDateTime(entry.lastModificationTime ?? entry.creationTime)}
                  </span>
                </td>

                <td
                  className={cn(
                    BODY_CELL,
                    "z-10 bg-white text-center",
                    STICKY_END,
                    "group-hover:bg-app-surface",
                  )}
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      aria-label={t("Chỉnh sửa {0}", entry.name)}
                      onClick={() => onEdit(entry)}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-label outline-none transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:ring-2 focus-visible:ring-app-primary/40"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Xoá {0}", entry.name)}
                      onClick={() => onDelete(entry)}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-danger outline-none transition-colors duration-150 hover:bg-app-danger/10 focus-visible:ring-2 focus-visible:ring-app-danger/40"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
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
