import { createContext, useContext, useMemo, type HTMLAttributes } from "react";
import { Button, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, HolderOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { CatalogEntryDto } from "../api/taxonomyApi";
import { DataTable } from "@/components/DataTable";
import { LetterAvatar } from "@/components/LetterAvatar";
import { useDragReorder, type DragReorder } from "@/hooks/useDragReorder";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";

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
  pagination: NonNullable<Parameters<typeof DataTable>[0]["pagination"]>;
}

/**
 * The drag state has to reach the row component antd builds for us, and antd
 * gives no way to pass props down to it — hence a context rather than a closure.
 */
const DragContext = createContext<DragReorder<CatalogEntryDto> | null>(null);

/**
 * One table row, wired for dragging.
 *
 * antd hands the row its key through `data-row-key`, which is what lets a row
 * component that antd constructed find its own entry in the drag state.
 */
function DraggableRow({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  const drag = useContext(DragContext);
  const key = (rest as { "data-row-key"?: string })["data-row-key"];

  if (!drag || !key) {
    return <tr {...rest}>{children}</tr>;
  }

  return (
    <tr
      {...rest}
      ref={drag.registerRow(key)}
      className={[rest.className, drag.draggingKey === key && "bd-cat-row--dragging"]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </tr>
  );
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
  pagination,
}: Props) {
  const drag = useDragReorder({
    items: entries,
    getKey: (entry) => entry.id,
    enabled: canReorder,
    onCommit: onReorder,
  });

  const rows = drag.items;

  const columns = useMemo<ColumnsType<CatalogEntryDto>>(() => {
    const list: ColumnsType<CatalogEntryDto> = [
      {
        key: "grip",
        title: <span className="bd-sr-only">{t("Sắp xếp")}</span>,
        width: 48,
        align: "center",
        render: (_, entry, index) => (
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
              if (event.key === "ArrowDown" && index < rows.length - 1) {
                event.preventDefault();
                void onReorder(index, index + 1);
              }
            }}
            className={["bd-grip", !canReorder && "bd-grip--off"].filter(Boolean).join(" ")}
          >
            <HolderOutlined aria-hidden="true" />
          </button>
        ),
      },
      {
        key: "name",
        title: entityLabel,
        render: (_, entry) => (
          <div className="bd-cat-inline3">
            <LetterAvatar name={entry.name} />
            <div className="bd-min0">
              <p className={entry.isDeleted ? "bd-cat-name bd-cat-name--deleted" : "bd-cat-name"}>
                {entry.name}
              </p>
              {entry.code && <p className="bd-cat-subtle">{entry.code}</p>}
            </div>
          </div>
        ),
      },
    ];

    if (showGroupColumn) {
      list.push({
        key: "taxonomyName",
        title: t("Nhóm phân loại"),
        width: 300,
        render: (_, entry) =>
          entry.taxonomyName ? (
            <span className="bd-cat-chip">{entry.taxonomyName}</span>
          ) : (
            <span className="bd-muted-text">—</span>
          ),
      });
    }

    if (priced) {
      list.push({
        key: "price",
        title: t("Giá"),
        width: 200,
        align: "right",
        render: (_, entry) => (
          <span className="bd-cat-price">
            {entry.price == null ? "—" : `${formatVND(entry.price)} đ`}
          </span>
        ),
      });
    }

    list.push(
      {
        key: "lastModificationTime",
        title: t("Cập nhật gần nhất"),
        width: 280,
        render: (_, entry) => (
          <span className="bd-cat-num">
            {formatDateTime(entry.lastModificationTime ?? entry.creationTime)}
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 100,
        align: "center",
        fixed: "right",
        render: (_, entry) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", entry.name)}
                onClick={() => onEdit(entry)}
              />
            </Tooltip>
            {/* An entry that is already deleted has nothing left to delete —
                it is brought back from its own dialog instead. */}
            {!entry.isDeleted && (
              <Tooltip title={t("Xoá")}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t("Xoá {0}", entry.name)}
                  onClick={() => onDelete(entry)}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
    );

    return list;
  }, [canReorder, drag, entityLabel, onDelete, onEdit, onReorder, priced, rows.length, showGroupColumn]);

  return (
    <DragContext.Provider value={drag}>
      <DataTable<CatalogEntryDto>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        pagination={pagination}
        locale={{ emptyText: emptyText ?? t("Không có dữ liệu") }}
        components={{ body: { row: DraggableRow } }}
      />
    </DragContext.Provider>
  );
}
