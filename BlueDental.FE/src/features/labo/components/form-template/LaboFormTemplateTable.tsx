import { Button, Switch, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboFormTemplateDto } from "../../api/laboFormTemplateApi";

interface Props {
  rows: LaboFormTemplateDto[];
  loading: boolean;
  emptyText: string;
  pagination: TablePaginationConfig;
  /** The row whose Trạng thái is being saved, for its switch's spinner. */
  togglingId?: string;
  /** Each omitted while the account lacks the permission. */
  onToggleActive?: (row: LaboFormTemplateDto, active: boolean) => void;
  onEdit?: (row: LaboFormTemplateDto) => void;
  onDelete?: (row: LaboFormTemplateDto) => void;
}

const FIELDS_SHOWN = 4;

/** The first few field labels, then "+n" for the rest. */
function fieldSummary(row: LaboFormTemplateDto): string {
  const labels = row.fields.map((field) => field.label);
  const more = labels.length - FIELDS_SHOWN;
  return more > 0 ? `${labels.slice(0, FIELDS_SHOWN).join(", ")} +${more}` : labels.join(", ");
}

function buildColumns({ togglingId, onToggleActive, onEdit, onDelete }: Props): ColumnsType<LaboFormTemplateDto> {
  const columns: ColumnsType<LaboFormTemplateDto> = [
    {
      key: "name",
      title: t("Labo:FormTpl:Name"),
      render: (_, row) => (
        <div className="bd-min0">
          <p className="bd-cat-name">{row.name}</p>
          {row.description && <p className="bd-cat-subtle">{row.description}</p>}
        </div>
      ),
    },
    {
      key: "fields",
      title: t("Labo:FormTpl:Fields"),
      render: (_, row) => (
        <div className="bd-min0">
          <p className="bd-cat-num">{t("Labo:FormTpl:FieldTotal", String(row.fields.length))}</p>
          <p className="bd-cat-subtle ft-summary">{fieldSummary(row)}</p>
        </div>
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

/** Mẫu phiếu (F-93): name and description, the fields at a glance, Trạng thái, last update and the actions. */
export function LaboFormTemplateTable(props: Props) {
  return (
    <DataTable<LaboFormTemplateDto>
      columns={buildColumns(props)}
      dataSource={props.rows}
      rowKey="id"
      loading={props.loading}
      locale={{ emptyText: props.emptyText }}
      pagination={props.pagination}
    />
  );
}
