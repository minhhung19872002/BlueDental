import { memo, useCallback } from "react";
import { Button, Dropdown, Input, Spin, Tooltip } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDragReorder } from "@/hooks/useDragReorder";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/**
 * What the panel needs of a group, and no more.
 *
 * Both Danh mục and Vật tư keep their groups in the same taxonomy collection,
 * so both pass their own DTO straight in — the panel never learns which.
 */
export interface PanelGroup {
  id: string;
  name: string;
  /** Shown beside the name where the caller counts what is inside a group. */
  entryCount?: number;
  /** Seeded by the system: the reference marks these and offers no commands. */
  isSystem?: boolean;
}

interface Props<TGroup extends PanelGroup> {
  /** e.g. "Nhóm dịch vụ" */
  title: string;
  /** e.g. "Chọn nhóm để xem dịch vụ bên trong" */
  subtitle: string;
  groups: TGroup[];
  isLoading: boolean;
  /** True while a narrowed list is being fetched, so the panel can dim. */
  isSearching: boolean;
  /** Search text; the query runs on the server, so the container owns it. */
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (group: TGroup) => void;
  onDelete: (group: TGroup) => void;
  /** Persists a new order after a drag or a move-up/move-down command. */
  onReorder: (fromIndex: number, toIndex: number) => void | Promise<void>;
  /** e.g. "Tìm nhóm vật tư...". Defaults to the wording Danh mục uses. */
  searchPlaceholder?: string;
  /** The noun the header counts in, e.g. "nhóm" giving "3 nhóm". */
  countNoun?: string;
  /** What an empty panel says, e.g. "Chưa có phòng ban". */
  emptyText?: string;
  /** Names the "+" for a screen reader, e.g. "Thêm phòng ban". */
  createLabel?: string;
}

interface RowProps {
  group: PanelGroup;
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
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
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
          group.isSystem && "bd-group-row--system",
          dragging && "bd-group-row--dragging",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(group.id)}
          aria-current={active ? "true" : undefined}
          className="bd-group-btn"
        >
          <FolderOpenOutlined
            aria-hidden="true"
            className={cn(active ? "bd-primary-text" : "bd-muted-text")}
          />
          <span className="bd-min0 bd-flex1 bd-text-left">
            <span className={cn("bd-group-name", active ? "bd-semibold" : "bd-medium")}>
              {group.name}
            </span>
          </span>
        </button>

        {/* A system group is seeded, and the reference neither renames nor
            deletes one: it swaps the menu for a note saying so. */}
        {group.isSystem ? (
          <Tooltip title={t("Nhóm hệ thống, không thể sửa hoặc xoá")}>
            <InfoCircleOutlined aria-hidden="true" className="bd-group-system-mark" />
          </Tooltip>
        ) : (
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: "rename",
                icon: <EditOutlined />,
                label: t("Chỉnh sửa"),
                onClick: () => onRename(group.id),
              },
              {
                key: "delete",
                danger: true,
                icon: <DeleteOutlined />,
                label: t("Xoá"),
                onClick: () => onDelete(group.id),
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
            <MoreOutlined aria-hidden="true" />
          </button>
        </Dropdown>
        )}

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
          <HolderOutlined aria-hidden="true" />
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
export function GroupPanel<TGroup extends PanelGroup>({
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
  searchPlaceholder,
  countNoun,
  emptyText,
  createLabel,
}: Props<TGroup>) {
  /** A search shows part of the catalog, so positions in it are not the order. */
  const canReorder = keyword.trim().length === 0;

  // The rows are memoised and so cannot be generic; they name the row they mean
  // and the caller's own group is looked up here.
  const byId = (id: string) => groups.find((group) => group.id === id);
  const renameById = useCallback(
    (id: string) => {
      const group = byId(id);
      if (group) onRename(group);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, onRename],
  );
  const deleteById = useCallback(
    (id: string) => {
      const group = byId(id);
      if (group) onDelete(group);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, onDelete],
  );

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
            {isLoading
              ? t("Đang tải…")
              : `${groups.length} ${countNoun ?? t("nhóm")}`}
          </span>
        </div>
        <p className="bd-cat-sub bd-group-sub" title={subtitle}>
          {subtitle}
        </p>

        <div className="bd-group-searchrow">
          <Input
            id="taxonomy-group-search"
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder ?? t("Tìm nhóm...")}
            aria-label={searchPlaceholder ?? t("Tìm nhóm...")}
            value={keyword}
            allowClear
            onChange={(event) => onKeywordChange(event.target.value)}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            aria-label={createLabel ?? t("Thêm nhóm phân loại")}
            title={createLabel ?? t("Thêm nhóm phân loại")}
            onClick={onCreate}
          />
        </div>
      </div>

      <nav aria-label={title} className="bd-group-list">
        {isLoading ? (
          <div className="bd-center-pad">
            <Spin size="large" />
          </div>
        ) : drag.items.length === 0 ? (
          <div className="bd-empty">
            <FolderOpenOutlined className="bd-icon--xl" aria-hidden="true" />
            <p className="bd-cat-hint bd-cat-hint--13">
              {keyword
                ? t("Không tìm thấy nhóm phù hợp")
                : (emptyText ?? t("Chưa có nhóm nào"))}
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
                onRename={renameById}
                onDelete={deleteById}
                onReorder={onReorder}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
