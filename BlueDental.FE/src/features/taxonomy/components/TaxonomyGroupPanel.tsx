import { memo } from "react";
import { Dropdown, Spin } from "antd";
import { FolderOpen, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { TaxonomyDto } from "../api/taxonomyApi";
import { SearchField } from "@/components/SearchField";
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
      className={cn(dragging && "bd-lifted")}
    >
      <div
        className={cn(
          "bd-group-row",
          active && "bd-group-row--active",
          dragging && "bd-group-row--dragging",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(group.id)}
          aria-current={active ? "true" : undefined}
          className="bd-group-btn"
        >
          <FolderOpen
            aria-hidden="true"
            className={cn("bd-icon", active ? "bd-primary-text" : "bd-muted-text")}
          />
          <span className="bd-min0 bd-flex1 bd-text-left">
            <span className={cn("bd-group-name", active ? "bd-semibold" : "bd-medium")}>
              {group.name}
            </span>
          </span>
        </button>

        {/* The reference offers exactly these two commands. Reordering is not
            in the menu — the grip carries it, by pointer and by keyboard. */}
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: "rename",
                icon: <Pencil className="bd-menu-icon" />,
                label: t("Chỉnh sửa"),
                onClick: () => onRename(group),
              },
              {
                key: "delete",
                danger: true,
                icon: <Trash2 className="bd-menu-icon" />,
                label: t("Xoá"),
                onClick: () => onDelete(group),
              },
            ],
          }}
        >
          <button
            type="button"
            aria-label={t("Thêm thao tác")}
            title={t("Thêm thao tác")}
            data-group-menu={group.name}
            className="bd-group-menu-trigger"
          >
            <MoreHorizontal className="bd-menu-icon" aria-hidden="true" />
          </button>
        </Dropdown>

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
            "bd-grip bd-grip--reveal",
            dragging && "bd-grip--shown",
            canReorder ? "" : "bd-grip--off",
          )}
        >
          <GripVertical className="bd-icon" aria-hidden="true" />
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
    <div className="bd-group-panel">
      <div
        data-slot="group-panel-header"
        className="bd-group-head"
      >
        <div className="bd-group-headrow">
          <p className="bd-group-title">{title}</p>
          <span className="bd-cat-hint">
            {isLoading ? t("Đang tải…") : t("{0} nhóm", groups.length)}
          </span>
        </div>
        <p className="bd-cat-sub">{subtitle}</p>

        <div className="bd-cat-inline2 bd-mt3">
          <SearchField
            id="taxonomy-group-search"
            label={t("Tìm nhóm...")}
            value={keyword}
            onChange={onKeywordChange}
            className="bd-w-full"
          />
          <button
            type="button"
            onClick={onCreate}
            aria-label={t("Thêm nhóm phân loại")}
            title={t("Thêm nhóm phân loại")}
            className="bd-group-add"
          >
            <Plus className="bd-icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav aria-label={title} className="bd-group-list">
        {isLoading ? (
          <div className="bd-center-pad">
            <Spin size="large" />
          </div>
        ) : drag.items.length === 0 ? (
          <div className="bd-empty">
            <FolderOpen className="bd-icon bd-icon--xl" aria-hidden="true" />
            <p className="bd-cat-hint bd-cat-hint--13">
              {keyword ? t("Không tìm thấy nhóm phù hợp") : t("Chưa có nhóm nào")}
            </p>
          </div>
        ) : (
          <ul className={cn("bd-group-items", isSearching && "bd-dimmed")}>
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
