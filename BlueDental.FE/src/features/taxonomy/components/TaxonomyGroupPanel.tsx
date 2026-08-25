import { memo } from "react";
import { FolderOpen, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { TaxonomyDto } from "../api/taxonomyApi";
import { SearchField } from "@/components/SearchField";
import { Spinner } from "@/components/Spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDragReorder } from "@/hooks/useDragReorder";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface Props {
  /** e.g. "Nhóm dịch vụ" */
  title: string;
  /** e.g. "Chọn nhóm để xem dịch vụ bên trong" */
  subtitle: string;
  groups: TaxonomyDto[];
  isLoading: boolean;
  /** True while a narrowed list is being fetched, so the panel can dim. */
  isSearching: boolean;
  /** Search text; the query runs on the server, so the container owns it. */
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (group: TaxonomyDto) => void;
  onDelete: (group: TaxonomyDto) => void;
  /** Persists a new order after a drag or a move-up/move-down command. */
  onReorder: (fromIndex: number, toIndex: number) => void | Promise<void>;
}

interface RowProps {
  group: TaxonomyDto;
  index: number;
  count: number;
  active: boolean;
  dragging: boolean;
  canReorder: boolean;
  registerRow: (element: HTMLElement | null) => void;
  handleProps: {
    onPointerDown: (event: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  onSelect: (id: string) => void;
  onRename: (group: TaxonomyDto) => void;
  onDelete: (group: TaxonomyDto) => void;
  onReorder: (fromIndex: number, toIndex: number) => void | Promise<void>;
}

/**
 * Memoised: opening a dialog or picking another group re-renders the workspace,
 * and without this every row of the panel re-renders with it.
 */
const GroupRow = memo(function GroupRow({
  group,
  index,
  count,
  active,
  dragging,
  canReorder,
  registerRow,
  handleProps,
  onSelect,
  onRename,
  onDelete,
  onReorder,
}: RowProps) {
  return (
    <li
      ref={registerRow}
      data-group-row={group.id}
      // No transition on the row itself: the lifted row's transform is written
      // on every pointer move, and a transition would make it trail the cursor.
      className={cn(dragging && "opacity-95 shadow-[0_8px_20px_rgba(27,42,65,0.18)]")}
    >
      <div
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
          active
            ? "border-l-[3px] border-app-primary bg-app-primary-soft pl-[calc(0.75rem-3px)] text-app-primary-dark"
            : "text-app-label hover:bg-app-surface hover:text-app-ink",
          dragging && "bg-white ring-2 ring-app-primary/40",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(group.id)}
          aria-current={active ? "true" : undefined}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-app-primary/40"
        >
          <FolderOpen
            aria-hidden="true"
            className={cn("size-4 shrink-0", active ? "text-app-primary" : "text-app-label")}
          />
          <span className="min-w-0 flex-1 text-left">
            <span className={cn("block text-[14px]", active ? "font-semibold" : "font-medium")}>
              {group.name}
            </span>
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("Thêm thao tác")}
              title={t("Thêm thao tác")}
              data-group-menu={group.name}
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-app-icon opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:bg-app-primary-soft hover:text-app-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-app-primary/40 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          {/* The reference offers exactly these two commands. Reordering is not
              in the menu — the grip carries it, by pointer and by keyboard. */}
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onRename(group)}>
              <Pencil className="size-4" />
              {t("Chỉnh sửa")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(group)}
            >
              <Trash2 className="size-4" />
              {t("Xoá")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* A real button, not a decoration: dragging is a pointer gesture, so
            the same move has to be reachable with the arrow keys once the grip
            has focus. The reference's menu carries no move commands. */}
        <button
          type="button"
          disabled={!canReorder}
          aria-label={t("Kéo để sắp xếp")}
          title={canReorder ? t("Kéo để sắp xếp") : t("Xoá bộ lọc để sắp xếp lại")}
          {...handleProps}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" && index > 0) {
              event.preventDefault();
              void onReorder(index, index - 1);
            }
            if (event.key === "ArrowDown" && index < count - 1) {
              event.preventDefault();
              void onReorder(index, index + 1);
            }
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-app-icon opacity-0 outline-none transition-opacity group-hover:opacity-100",
            "focus-visible:text-app-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-app-primary/40",
            dragging && "opacity-100",
            canReorder ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed",
          )}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
});

/**
 * Left panel of every catalog screen: the classification groups.
 *
 * Rows can be reordered by dragging the grip — rows swap under the pointer as
 * it moves — and, because a drag is not available to keyboard or screen-reader
 * users, by the "Di chuyển lên/xuống" commands in each row's menu.
 */
export function TaxonomyGroupPanel({
  title,
  subtitle,
  groups,
  isLoading,
  isSearching,
  keyword,
  onKeywordChange,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: Props) {
  /** A search shows part of the catalog, so positions in it are not the order. */
  const canReorder = keyword.trim().length === 0;

  const drag = useDragReorder({
    items: groups,
    getKey: (group) => group.id,
    enabled: canReorder,
    onCommit: onReorder,
  });

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div
        data-slot="group-panel-header"
        className="flex shrink-0 flex-col justify-center border-b border-app-line p-4 md:h-[134px]"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[16px] font-semibold text-app-ink">{title}</p>
          <span className="shrink-0 text-[12px] text-app-label">
            {isLoading ? t("Đang tải…") : t("{0} nhóm", groups.length)}
          </span>
        </div>
        <p className="mt-0.5 text-[14px] text-app-label">{subtitle}</p>

        <div className="mt-3 flex items-center gap-2">
          <SearchField
            id="taxonomy-group-search"
            label={t("Tìm nhóm...")}
            value={keyword}
            onChange={onKeywordChange}
            className="w-full"
          />
          <button
            type="button"
            onClick={onCreate}
            aria-label={t("Thêm nhóm phân loại")}
            title={t("Thêm nhóm phân loại")}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-app-primary text-white outline-none transition-colors duration-150 hover:bg-app-primary-dark focus-visible:ring-[3px] focus-visible:ring-app-primary/25"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav aria-label={title} className="relative flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : drag.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FolderOpen className="size-8 text-app-icon" aria-hidden="true" />
            <p className="text-[13px] text-app-label">
              {keyword ? t("Không tìm thấy nhóm phù hợp") : t("Chưa có nhóm nào")}
            </p>
          </div>
        ) : (
          <ul className={cn("space-y-0.5 select-none", isSearching && "opacity-60")}>
            {drag.items.map((group, index) => (
              <GroupRow
                key={group.id}
                group={group}
                index={index}
                count={drag.items.length}
                active={group.id === selectedId}
                dragging={drag.draggingKey === group.id}
                canReorder={canReorder}
                registerRow={drag.registerRow(group.id)}
                handleProps={drag.handleProps(group.id)}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onReorder={onReorder}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
