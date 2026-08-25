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
    <div className="shrink-0 border-b border-app-line bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-app-ink" aria-hidden="true" />
            <h1 className="truncate text-[20px] font-bold text-app-ink">{title}</h1>
          </div>
          <p className="mt-0.5 text-[14px] text-app-label">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          title={actionDisabled ? actionDisabledHint : undefined}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-app-primary px-4 text-[14px] font-medium whitespace-nowrap text-white outline-none transition-all duration-150 hover:bg-app-primary-dark focus-visible:ring-[3px] focus-visible:ring-app-primary/25 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{actionLabel}</span>
          <span className="sm:hidden">{t("Thêm")}</span>
        </button>
      </div>

      {search && (
        <div className="mt-3 md:max-w-[360px]">
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
