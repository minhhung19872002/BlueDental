import { Button, Input } from "antd";
import { DownloadOutlined, MenuOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
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
          <Button type="link" icon={<MenuOutlined />} onClick={onOpenGroups}>
            {t("Chọn nhóm")}
          </Button>
        </div>
      )}

      <div className="bd-cat-header">
        <div className="bd-cat-headrow">
          <div className="bd-min0">
            <div className="bd-cat-inline2">
              <h1 className="bd-cat-title">{title}</h1>
              <span className="bd-cat-count">{t("{0} bản ghi", totalCount)}</span>
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
              <Button icon={<DownloadOutlined />} disabled={exportDisabled} onClick={onExport}>
                {t("Xuất")}
              </Button>
            )}

            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={createDisabled}
              onClick={onCreate}
            >
              {t("Thêm {0}", noun)}
            </Button>
          </div>
        </div>

        <Input
          className="bd-cat-search bd-mt2"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm theo tên {0}...", noun)}
          aria-label={t("Tìm theo tên {0}...", noun)}
          value={keyword}
          allowClear
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>
    </>
  );
}
