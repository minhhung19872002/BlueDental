import { useMemo } from "react";
import { Button, Dropdown, type MenuProps } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { SegmentedTabs } from "@/components/SegmentedTabs/SegmentedTabs";
import { t } from "@/lib/i18n";
import type { HistoryExportFormat } from "./historyExport";
import type { HistoryView } from "./historyLabels";

interface Props {
  view: HistoryView;
  exporting: boolean;
  onViewChange: (view: HistoryView) => void;
  onExport: (format: HistoryExportFormat) => void;
}

const EXPORT_FORMATS: readonly { key: HistoryExportFormat; label: string }[] = [
  { key: "csv", label: "Xuất CSV" },
  { key: "excel", label: "Xuất Excel" },
  { key: "json", label: "Xuất JSON" },
];

function isExportFormat(key: string): key is HistoryExportFormat {
  return EXPORT_FORMATS.some((format) => format.key === key);
}

/** Bảng / Dòng thời gian on the left, the export menu on the right. */
export function HistoryToolbar({ view, exporting, onViewChange, onExport }: Props) {
  const views = useMemo(
    () =>
      [
        { key: "table", label: t("Bảng") },
        { key: "timeline", label: t("Dòng thời gian") },
      ] as const,
    [],
  );

  const menu: MenuProps = {
    items: EXPORT_FORMATS.map((format) => ({ key: format.key, label: t(format.label) })),
    onClick: ({ key }) => {
      if (isExportFormat(key)) onExport(key);
    },
  };

  return (
    <div className="ah-toolbar">
      <SegmentedTabs<HistoryView> items={views} activeKey={view} onChange={onViewChange} />
      <Dropdown menu={menu} trigger={["click"]} disabled={exporting}>
        <Button icon={<DownloadOutlined />} loading={exporting} data-testid="ah-export">
          {t("Xuất dữ liệu")}
        </Button>
      </Dropdown>
    </div>
  );
}
