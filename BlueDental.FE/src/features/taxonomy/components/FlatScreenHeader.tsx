import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { SearchField } from "@/components/SearchField";
import { t } from "@/lib/i18n";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  /** Set while "Tất cả chi nhánh" is selected — a record needs one branch. */
  actionDisabled?: boolean;
  actionDisabledHint?: string;
  /** Omitted on screens the reference gives no search box. */
  search?: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  };
}

/**
 * Header of the catalog sub-routes that are a single flat table rather than a
 * group panel plus a table — Thẻ hồ sơ and Phương thức thanh toán.
 */
export function FlatScreenHeader({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionDisabledHint,
  search,
}: Props) {
  return (
    <div className="bd-cat-header">
      <div className="bd-cat-headrow">
        <div className="bd-min0">
          <div className="bd-cat-inline2">
            <Icon className="bd-icon bd-icon--lg" aria-hidden="true" />
            <h1 className="bd-cat-title">{title}</h1>
          </div>
          <p className="bd-cat-sub">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          title={actionDisabled ? actionDisabledHint : undefined}
          className="bd-cat-primarybtn"
        >
          <Plus className="bd-icon" aria-hidden="true" />
          <span className="bd-only-sm">{actionLabel}</span>
          <span className="bd-hide-sm">{t("Thêm")}</span>
        </button>
      </div>

      {search && (
        <div className="bd-cat-search bd-mt3">
          <SearchField
            id={search.id}
            label={search.label}
            value={search.value}
            onChange={search.onChange}
          />
        </div>
      )}
    </div>
  );
}
