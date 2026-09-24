import { Button, Input } from "antd";
import { DownloadOutlined, MenuOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
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
  onCreate: (() => void) | null;
  /** null on the catalogs the reference gives no "Xuất" button. */
  onExport: (() => void) | null;
  /** Null unless the account may create here and the catalog can be loaded from Excel. */
  onImport: (() => void) | null;
  createDisabled: boolean;
  exportDisabled: boolean;
  /** An import lands in one branch, so it waits while every branch is in view. */
  importDisabled: boolean;
  /**
   * Opens the group panel on viewports too narrow to show it beside the table.
   * Null on flat catalogs, which have no group panel at all.
   */
  onOpenGroups: (() => void) | null;
}

export function CatalogPanelHeader({
  title,
  groupName,
  noun,
  totalCount,
  keyword,
  onKeywordChange,
  onCreate,
  onExport,
  onImport,
  createDisabled,
  exportDisabled,
  importDisabled,
  onOpenGroups,
}: Props) {
  return (
    <>
      {onOpenGroups && (
        <div className="bd-cat-header bd-cat-header--bar">
          <Button type="link" icon={<MenuOutlined />} onClick={onOpenGroups}>
            {t("Taxonomy:Group:SelectBtn")}
          </Button>
        </div>
      )}

      <div className="bd-cat-header">
        <div className="bd-cat-headrow">
          <div className="bd-min0">
            <div className="bd-cat-inline2">
              <h1 className="bd-cat-title">{title}</h1>
              <span className="bd-cat-count">{t("Taxonomy:Table:RecordCount", totalCount)}</span>
            </div>
            {groupName && (
              <p className="bd-cat-sub">
                {tRich(
                  "Taxonomy:Table:ManageGroupSubtitle",
                  <span className="bd-cat-medium">{groupName}</span>,
                )}
              </p>
            )}
          </div>

          <div className="bd-cat-headactions">
            {onExport && (
              <Button icon={<DownloadOutlined />} disabled={exportDisabled} onClick={onExport}>
                {t("Taxonomy:Table:ExportBtn")}
              </Button>
            )}

            {onImport && (
              <Button icon={<UploadOutlined />} disabled={importDisabled} onClick={onImport}>
                {t("Taxonomy:Import:Btn")}
              </Button>
            )}

            {onCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={createDisabled}
                onClick={onCreate}
              >
                {t("Taxonomy:Table:AddBtn", noun)}
              </Button>
            )}
          </div>
        </div>

        <Input
          className="bd-cat-search bd-mt2"
          prefix={<SearchOutlined />}
          placeholder={t("Taxonomy:Table:SearchPlaceholder", noun)}
          aria-label={t("Taxonomy:Table:SearchPlaceholder", noun)}
          value={keyword}
          allowClear
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>
    </>
  );
}
