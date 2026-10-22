import { Button } from "antd";
import { FileExcelOutlined, LoadingOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { notifyApiError } from "@/lib/notify";
import { useExportStats, type StatsFilter, type StatsRecipientQuery } from "../../api/statsApi";

interface Props {
  filter: StatsFilter;
  query: StatsRecipientQuery;
}

/** Xuất báo cáo Excel: the same period, channel, template and recipient search as the screen. */
export function StatsExportButton({ filter, query }: Props) {
  const exportStats = useExportStats();

  const handleExport = () => {
    exportStats.mutate(
      { filter, query: { filter: query.filter, outcome: query.outcome } },
      { onError: notifyApiError },
    );
  };

  return (
    <Button
      className="cskh-excel-btn"
      icon={exportStats.isPending ? <LoadingOutlined /> : <FileExcelOutlined />}
      disabled={exportStats.isPending}
      onClick={handleExport}
    >
      {t("CSKH:Stats:Export")}
    </Button>
  );
}
