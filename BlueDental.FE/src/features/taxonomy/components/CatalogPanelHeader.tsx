import { Download, Plus, TextAlignStart } from "lucide-react";
import { SearchField } from "@/components/SearchField";
import { cn } from "@/lib/cn";
import { t, tRich } from "@/lib/i18n";

interface Props {
  /** Selected group name, or the tab label when no group exists yet. */
  title: string;
  /** Set when a real group is selected, so the subtitle can name it. */
  groupName: string | null;
  /** Lowercase noun of the current catalog, e.g. "dịch vụ". */
  noun: string;
  totalCount: number;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onCreate: () => void;
  /** null on the catalogs the reference gives no "Xuất" button. */
  onExport: (() => void) | null;
  createDisabled: boolean;
  exportDisabled: boolean;
  /**
   * Opens the group panel on viewports too narrow to show it beside the table.
   * Null on flat catalogs, which have no group panel at all.
   */
  onOpenGroups: (() => void) | null;
}

const BUTTON_BASE =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[14px] font-medium whitespace-nowrap outline-none transition-all duration-150 focus-visible:ring-[3px] focus-visible:ring-app-primary/25 disabled:pointer-events-none disabled:opacity-50";

export function CatalogPanelHeader({
  title,
  groupName,
  noun,
  totalCount,
  keyword,
  onKeywordChange,
  onCreate,
  onExport,
  createDisabled,
  exportDisabled,
  onOpenGroups,
}: Props) {
  return (
    <>
      {onOpenGroups && (
        <div className="shrink-0 border-b border-app-line bg-white px-4 py-2 md:hidden">
          <button
            type="button"
            onClick={onOpenGroups}
            className="flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-app-primary"
          >
            <TextAlignStart className="size-4" aria-hidden="true" />
            {t("Chọn nhóm")}
          </button>
        </div>
      )}

      <div className="shrink-0 border-b border-app-line bg-white px-4 py-4 md:min-h-[134px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[18px] font-bold text-app-ink md:text-[20px]">
                {title}
              </h1>
              <span className="inline-flex h-5 w-fit shrink-0 items-center rounded-full bg-app-primary-soft px-2 text-[11px] font-semibold whitespace-nowrap text-app-primary">
                {t("{0} bản ghi", totalCount)}
              </span>
            </div>
            {groupName && (
              <p className="mt-0.5 text-[14px] text-app-label">
                {tRich(
                  "Quản lý các mục thuộc nhóm {0}",
                  <span className="font-medium text-app-ink">{groupName}</span>,
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                className={cn(
                  BUTTON_BASE,
                  "border-app-line bg-white text-app-ink hover:border-app-line-strong hover:bg-app-surface",
                )}
              >
                <Download className="size-4" aria-hidden="true" />
                {t("Xuất")}
              </button>
            )}

            <button
              type="button"
              onClick={onCreate}
              disabled={createDisabled}
              className={cn(
                BUTTON_BASE,
                "border-transparent bg-app-primary text-white hover:bg-app-primary-dark",
              )}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t("Thêm {0}", noun)}</span>
              <span className="sm:hidden">{t("Thêm")}</span>
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <SearchField
            id="catalog-entry-search"
            label={t("Tìm theo tên {0}...", noun)}
            value={keyword}
            onChange={onKeywordChange}
            className="w-full md:max-w-[360px]"
          />
        </div>
      </div>
    </>
  );
}
