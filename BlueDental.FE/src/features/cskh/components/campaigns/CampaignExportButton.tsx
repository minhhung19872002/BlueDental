import { Button } from "antd";
import { FileExcelOutlined, LoadingOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { notifyApiError } from "@/lib/notify";
import { useExportCampaignFailures } from "../../api/campaignApi";

/** "Xuất Excel danh sách lỗi": who failed and who was left out of this send, with why. */
export function CampaignExportButton({ campaignId }: { campaignId: string }) {
  const exportFailures = useExportCampaignFailures();

  const handleExport = () => {
    exportFailures.mutate(campaignId, { onError: notifyApiError });
  };

  return (
    <Button
      className="cskh-excel-btn"
      icon={exportFailures.isPending ? <LoadingOutlined /> : <FileExcelOutlined />}
      disabled={exportFailures.isPending}
      onClick={handleExport}
    >
      {t("CSKH:Campaign:ExportFailures")}
    </Button>
  );
}
