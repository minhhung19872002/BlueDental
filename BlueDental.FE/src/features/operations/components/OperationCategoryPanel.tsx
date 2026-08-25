import { memo } from "react";
import { Button, Dropdown, Spin } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { OperationCategoryDto } from "../api/operationApi";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface RowProps {
  category: OperationCategoryDto;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (category: OperationCategoryDto) => void;
  onDelete: (category: OperationCategoryDto) => void;
}

/**
 * One category. Memoised because the panel re-renders on every keystroke in the
 * article search beside it, and these rows do not change with it.
 */
const CategoryRow = memo(function CategoryRow({
  category,
  active,
  onSelect,
  onRename,
  onDelete,
}: RowProps) {
  return (
    <li>
      <div className={cn("bd-group-row", active && "bd-group-row--active")}>
        <button
          type="button"
          onClick={() => onSelect(category.id)}
          aria-current={active ? "true" : undefined}
          className="bd-group-btn"
        >
          <FolderOpenOutlined
            aria-hidden="true"
            className={active ? "bd-primary-text" : "bd-muted-text"}
          />
          <span className="bd-min0 bd-flex1 bd-text-left">
            <span className={cn("bd-group-name", active ? "bd-semibold" : "bd-medium")}>
              {category.name}
            </span>
          </span>
        </button>

        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: "rename",
                icon: <EditOutlined />,
                label: t("Chỉnh sửa"),
                onClick: () => onRename(category),
              },
              {
                key: "delete",
                danger: true,
                icon: <DeleteOutlined />,
                label: t("Xoá"),
                onClick: () => onDelete(category),
              },
            ],
          }}
        >
          <button
            type="button"
            aria-label={t("Thêm thao tác")}
            title={t("Thêm thao tác")}
            data-category-menu={category.name}
            className="bd-group-menu-trigger"
          >
            <MoreOutlined aria-hidden="true" />
          </button>
        </Dropdown>
      </div>
    </li>
  );
});

interface Props {
  title: string;
  subtitle: string;
  categories: OperationCategoryDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (category: OperationCategoryDto) => void;
  onDelete: (category: OperationCategoryDto) => void;
}

/**
 * Left panel of a Vận hành sub-screen: the categories its articles are filed
 * under.
 *
 * Deliberately the same shape and the same rules as the Danh mục group panel —
 * the reference draws the two screens alike, so they share their styling rather
 * than growing two ways of looking the same.
 */
export function OperationCategoryPanel({
  title,
  subtitle,
  categories,
  isLoading,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  return (
    <div className="bd-group-panel">
      <div className="bd-group-head">
        <div className="bd-group-headrow">
          <p className="bd-group-title">{title}</p>
          <span className="bd-cat-hint">
            {isLoading ? t("Đang tải…") : t("{0} mục", categories.length)}
          </span>
        </div>
        <p className="bd-cat-sub bd-group-sub" title={subtitle}>
          {subtitle}
        </p>

        <div className="bd-ops-addrow">
          <Button type="primary" icon={<PlusOutlined />} block onClick={onCreate}>
            {t("Thêm Mới")}
          </Button>
        </div>
      </div>

      <nav aria-label={title} className="bd-group-list">
        {isLoading ? (
          <div className="bd-center-pad">
            <Spin size="large" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bd-empty">
            <FolderOpenOutlined className="bd-icon--xl" aria-hidden="true" />
            <p className="bd-cat-hint bd-cat-hint--13">{t("Chưa có mục nào")}</p>
          </div>
        ) : (
          <ul className="bd-group-items">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                active={category.id === selectedId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
