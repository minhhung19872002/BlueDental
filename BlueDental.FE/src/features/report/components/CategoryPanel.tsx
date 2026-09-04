import { useMemo, useState } from "react";
import { Button, Input, Space, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { CategoryVm } from "../types/mock";
import { ReportTableCard } from "./ReportTableCard";

export interface CategoryPanelConfig {
  title: () => string;
  description: () => string;
  searchPlaceholder: () => string;
  /** Cashbook categories carry a colour code column. */
  showColor: boolean;
}

interface Props {
  config: CategoryPanelConfig;
  categories: CategoryVm[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (category: CategoryVm) => void;
  onDelete: (category: CategoryVm) => void;
}

function ColorCell({ code }: { code: string | null }) {
  if (!code) return <span className="report-muted">—</span>;
  return (
    <span className="report-color-cell">
      <span className="report-color-swatch" style={{ "--swatch": code } as React.CSSProperties} />
      {code}
    </span>
  );
}

function buildColumns(config: CategoryPanelConfig, onEdit: Props["onEdit"], onDelete: Props["onDelete"]) {
  const columns: TableColumnsType<CategoryVm> = [
    { title: config.showColor ? t("Tên danh mục") : t("Tên hình thức"), dataIndex: "name" },
  ];
  if (config.showColor) {
    columns.push({ title: t("Mã màu"), dataIndex: "colorCode", width: 160, render: (v: string | null) => <ColorCell code={v} /> });
  }
  columns.push({
    title: t("Thao tác"),
    key: "actions",
    width: 110,
    align: "center",
    render: (_: unknown, row) => (
      <Space size={4}>
        <Tooltip title={t("Chỉnh sửa")}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(row)} />
        </Tooltip>
        <Tooltip title={t("Xóa")}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} />
        </Tooltip>
      </Space>
    ),
  });
  return columns;
}

/** One category list: title + description, search, "Thêm mục", table, "Hiển thị X trên Y mục". */
export function CategoryPanel({ config, categories, loading, onAdd, onEdit, onDelete }: Props) {
  const [keyword, setKeyword] = useState("");
  const columns = useMemo(() => buildColumns(config, onEdit, onDelete), [config, onEdit, onDelete]);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.colorCode ?? "").toLowerCase().includes(q));
  }, [categories, keyword]);

  return (
    <div className="report-category-content">
      <div className="report-category-header">
        <div>
          <div className="report-summary-card-title">{config.title()}</div>
          <div className="report-category-desc">{config.description()}</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          {t("Thêm mục")}
        </Button>
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
        dataSource={visible}
        loading={loading}
        pagination={false}
        locale={{ emptyText: t("Không có danh mục nào") }}
      />
      <div className="report-category-footer">{t("Hiển thị {0} trên {1} mục", visible.length, categories.length)}</div>
    </div>
  );
}
