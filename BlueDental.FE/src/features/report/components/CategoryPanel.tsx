import { useMemo, useState } from "react";
import { Button, Input, Space, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useClientPaging } from "../hooks/useClientPaging";
import { ReportTableCard } from "./ReportTableCard";

export interface CategoryVm {
  id: string;
  name: string;
  type: number;
  priority: number;
  description: string | null;
  colorCode: string | null;
}

export interface CategoryPanelConfig {
  title: () => string;
  description: () => string;
  searchPlaceholder: () => string;
  /** The reference words the empty row differently per list ("Không có dữ liệu" vs "Không có danh mục nào"). */
  emptyText: () => string;
  /** Cashbook categories carry "Ghi chú" and "Mã màu" columns; sales ones only a name. */
  showColor: boolean;
}

interface Props {
  config: CategoryPanelConfig;
  categories: CategoryVm[];
  loading: boolean;
  /** "Thêm mục" needs the list's `create` grant on the reference. */
  canCreate: boolean;
  onAdd: () => void;
  onEdit?: (category: CategoryVm) => void;
  onDelete?: (category: CategoryVm) => void;
}

function ColorCell({ code }: { code: string | null }) {
  if (!code) return <span className="report-muted">—</span>;
  return (
    <span className="report-color-cell">
      <span className="report-color-swatch" style={{ "--swatch": code } as React.CSSProperties} />
      <span className="report-color-code">{code}</span>
    </span>
  );
}

function buildColumns(config: CategoryPanelConfig, onEdit: Props["onEdit"], onDelete: Props["onDelete"]) {
  const columns: TableColumnsType<CategoryVm> = [
    { title: config.showColor ? t("Tên danh mục") : t("Tên hình thức"), dataIndex: "name" },
  ];
  if (config.showColor) {
    columns.push(
      { title: t("Ghi chú"), dataIndex: "description", render: (v: string | null) => v || "—" },
      { title: t("Mã màu"), dataIndex: "colorCode", width: 160, render: (v: string | null) => <ColorCell code={v} /> },
    );
  }
  if (onEdit || onDelete) {
    columns.push({
      title: t("Thao tác"),
      key: "actions",
      width: config.showColor ? 70 : 120,
      align: "center",
      fixed: "right",
      render: (_: unknown, row) => (
        <Space size={4}>
          {onEdit && (
            <Tooltip title={t("Chỉnh sửa")}>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(row)} />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title={t("Xóa")}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} />
            </Tooltip>
          )}
        </Space>
      ),
    });
  }
  return columns;
}

/** One category list: title + description, search, "Thêm mục", paged table. */
export function CategoryPanel({ config, categories, loading, canCreate, onAdd, onEdit, onDelete }: Props) {
  const [keyword, setKeyword] = useState("");
  const columns = useMemo(() => buildColumns(config, onEdit, onDelete), [config, onEdit, onDelete]);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.colorCode ?? "").toLowerCase().includes(q));
  }, [categories, keyword]);
  const paging = useClientPaging(visible);

  return (
    <div className="report-category-content">
      <div className="report-category-header">
        <div>
          <div className="report-summary-card-title">{config.title()}</div>
          <div className="report-category-desc">{config.description()}</div>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {t("Thêm mục")}
          </Button>
        )}
      </div>

      <Input.Search
        className="report-category-search"
        allowClear
        placeholder={config.searchPlaceholder()}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />

      <ReportTableCard<CategoryVm>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={loading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        locale={{ emptyText: config.emptyText() }}
      />
    </div>
  );
}
