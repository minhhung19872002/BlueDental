import { useState } from "react";
import { Button } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { ServiceStageDto } from "../api/taxonomyApi";
import { downloadStageWorkbook, stageFileName, stagesToSheetRows } from "../stageExcel";
import { stageSheetWords } from "../stageExcelWords";
import { ServiceStageImportDialog } from "./ServiceStageImportDialog";

interface Props {
  stages: ServiceStageDto[];
  onStagesChange: (next: ServiceStageDto[]) => void;
  /** The service's name as typed so far; the file is named after it. */
  serviceName: string | undefined;
}

/**
 * "Xuất" / "Nhập" beside "+ Công đoạn", worded like the catalog toolbar's.
 * Export writes the table as it stands; import goes through the catalog
 * import's check-then-import dialog. Nothing is saved until the dialog's "Lưu".
 */
export function ServiceStageExcelButtons({ stages, onStagesChange, serviceName }: Props) {
  const [importing, setImporting] = useState(false);

  const handleExport = () =>
    downloadStageWorkbook(
      stagesToSheetRows(stages, stageSheetWords()),
      stageFileName(serviceName),
      t("Taxonomy:Service:Stages"),
    );

  return (
    <>
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        {t("Taxonomy:Table:ExportBtn")}
      </Button>
      <Button icon={<UploadOutlined />} onClick={() => setImporting(true)}>
        {t("Taxonomy:Import:Btn")}
      </Button>
      <ServiceStageImportDialog
        open={importing}
        stages={stages}
        serviceName={serviceName}
        onApply={onStagesChange}
        onClose={() => setImporting(false)}
      />
    </>
  );
}
