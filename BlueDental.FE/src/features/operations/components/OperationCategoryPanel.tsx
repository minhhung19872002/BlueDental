import { memo } from "react";
import { Button, Spin } from "antd";
import { DeleteOutlined, EditOutlined, FolderOutlined, PlusOutlined } from "@ant-design/icons";
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
 * One category: a folder, its name, and the two commands.
 *
 * Memoised because the panel re-renders on every keystroke in the article
 * search beside it, and these rows do not change with it.
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
      <div className={cn("bd-ops-cat", active && "bd-ops-cat--active")}>
        <button
          type="button"
          onClick={() => onSelect(category.id)}
          aria-current={active ? "true" : undefined}
          className="bd-ops-cat-btn"
        >
          <FolderOutlined aria-hidden="true" className="bd-ops-cat-icon" />
          {/* Two lines, then clipped — the reference clamps rather than
              letting a long name push the row open. */}
          <span className="bd-ops-cat-name">{category.name}</span>
        </button>

        {/* Out of the way until the row is pointed at or selected, as the
            reference keeps them. Both stay reachable by keyboard. */}
        <div className="bd-ops-cat-actions">
          <button
            type="button"
            className="bd-ops-cat-action"
            aria-label={t("Chỉnh sửa {0}", category.name)}
            onClick={() => onRename(category)}
          >
            <EditOutlined aria-hidden="true" />
          </button>
          <button
            type="button"
            className="bd-ops-cat-action bd-ops-cat-action--danger"
            aria-label={t("Xoá {0}", category.name)}
            onClick={() => onDelete(category)}
          >
            <DeleteOutlined aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
});

interface Props {
  label: string;
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
 * Not the Danh mục group panel, though the two look related: the reference
 * gives this one no heading, no count, no description line, no search and no
 * drag handle — a sticky "Thêm Mới" and a flat list of folders, and that is all.
 */
export function OperationCategoryPanel({
  label,
  categories,
  isLoading,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  return (
    <div className="bd-ops-panel">
      <div className="bd-ops-panel-head">
        <Button type="primary" icon={<PlusOutlined />} block onClick={onCreate}>
          {t("Thêm Mới")}
        </Button>
      </div>

      <nav aria-label={label} className="bd-ops-panel-list">
        {isLoading ? (
          <div className="bd-center-pad">
            <Spin />
          </div>
        ) : (
          // No empty state: the reference leaves the panel blank below the
          // button when a sub-screen has no categories yet.
          <ul className="bd-ops-cats">
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
