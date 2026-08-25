import { memo } from "react";
import { Button, Spin, Tooltip } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
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

        {/* Both commands out in the open: there are only two, and a menu
            hides them behind an extra click for nothing. */}
        <div className="bd-ops-rowactions">
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t("Chỉnh sửa {0}", category.name)}
              onClick={() => onRename(category)}
            />
          </Tooltip>
          <Tooltip title={t("Xoá")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("Xoá {0}", category.name)}
              onClick={() => onDelete(category)}
            />
          </Tooltip>
        </div>
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
