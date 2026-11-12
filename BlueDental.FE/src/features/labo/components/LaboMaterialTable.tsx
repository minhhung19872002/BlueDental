import { Button, Switch, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboMaterialDto } from "../api/laboCatalogApi";

interface Props {
  rows: LaboMaterialDto[];
  loading: boolean;
  emptyText: string;
  pagination: TablePaginationConfig;
  /** The row whose Trạng thái is being saved, for its switch's spinner. */
  togglingId?: string;
  /** Each omitted while the account lacks the permission. */
  onToggleActive?: (row: LaboMaterialDto, active: boolean) => void;
  onEdit?: (row: LaboMaterialDto) => void;
  onDelete?: (row: LaboMaterialDto) => void;
}

function buildColumns({ togglingId, onToggleActive, onEdit, onDelete }: Props): ColumnsType<LaboMaterialDto> {
  const columns: ColumnsType<LaboMaterialDto> = [
    {
      key: "name",
      title: t("Labo:Material:Title"),
      render: (_, row) => (
        <p className="bd-cat-name bd-labo-material-name">
          <span className="bd-labo-material-code">{row.code || "—"}</span>
          <span>{row.name}</span>
        </p>
      ),
    },
    {
      key: "isActive",
      title: t("Common:Status"),
      width: 136,
      render: (_, row) => (
        <span className="bd-labo-material-status">
          <Switch
            checked={row.isActive}
            size="small"
            disabled={!onToggleActive}
            loading={togglingId === row.id}
            aria-label={t("Labo:Material:StatusOf", row.name)}
            onChange={(active) => onToggleActive?.(row, active)}
          />
          {row.isActive ? t("Labo:Material:InUse") : t("Labo:Material:Stopped")}
        </span>
      ),
    },
    {
      key: "updatedAt",
      title: t("Common:LastUpdated"),
      width: 160,
      render: (_, row) => (
        <span className="bd-cat-num">{formatDateTime(row.lastModificationTime ?? row.creationTime)}</span>
      ),
    },
  ];
  if (!onEdit && !onDelete) return columns;
  return [
    ...columns,
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 96,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <div className="bd-cat-rowactions">
          {onEdit && (
            <Tooltip title={t("Common:Edit")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Common:EditAriaLabel", row.name)}
                onClick={() => onEdit(row)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title={t("Common:Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Common:DeleteAriaLabel", row.name)}
                onClick={() => onDelete(row)}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];
}

/**
 * The materials of one group (BA P1011): the Mã in a mono face before the
 * name ("—" for a material saved before Mã), the Trạng thái switch,
 * Cập nhật gần nhất and Thao tác.
 */
export function LaboMaterialTable(props: Props) {
  return (
    <DataTable<LaboMaterialDto>
      columns={buildColumns(props)}
      dataSource={props.rows}
      rowKey="id"
      loading={props.loading}
      locale={{ emptyText: props.emptyText }}
      pagination={props.pagination}
    />
  );
}
