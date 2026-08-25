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
        <div className="bd-cat-header bd-cat-header--bar">
          <button
            type="button"
            onClick={onOpenGroups}
            className="bd-cat-linkbtn"
          >
            <TextAlignStart className="bd-icon" aria-hidden="true" />
            {t("Chọn nhóm")}
          </button>
        </div>
      )}

      <div className="bd-cat-header">
        <div className="bd-cat-headrow">
          <div className="bd-min0">
            <div className="bd-cat-inline2">
              <h1 className="bd-cat-title">
                {title}
              </h1>
              <span className="bd-cat-count">
                {t("{0} bản ghi", totalCount)}
              </span>
            </div>
            {groupName && (
              <p className="bd-cat-sub">
                {tRich(
                  "Quản lý các mục thuộc nhóm {0}",
                  <span className="bd-cat-medium">{groupName}</span>,
                )}
              </p>
            )}
          </div>

          <div className="bd-cat-headactions">
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                className={cn(
                  BUTTON_BASE,
                  "bd-cat-toolbtn",
                )}
              >
                <Download className="bd-icon" aria-hidden="true" />
                {t("Xuất")}
              </button>
            )}

            <button
              type="button"
              onClick={onCreate}
              disabled={createDisabled}
              className={cn(
                BUTTON_BASE,
                "bd-cat-toolbtn bd-cat-toolbtn--primary",
              )}
            >
              <Plus className="bd-icon bd-icon--sm" aria-hidden="true" />
              <span className="bd-only-sm">{t("Thêm {0}", noun)}</span>
              <span className="bd-hide-sm">{t("Thêm")}</span>
            </button>
          </div>
        </div>

        <div className="bd-cat-inline2 bd-mt2">
          <SearchField
            id="catalog-entry-search"
            label={t("Tìm theo tên {0}...", noun)}
            value={keyword}
            onChange={onKeywordChange}
            className="bd-cat-search"
          />
        </div>
      </div>
    </>
  );
}
