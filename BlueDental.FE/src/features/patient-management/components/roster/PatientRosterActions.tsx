import { useState } from "react";
import { Button } from "antd";
import { FileExcelOutlined, UploadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useExportPatientRoster } from "../../api/patientRosterApi";
import { PatientRosterImportDialog } from "./PatientRosterImportDialog";

/**
 * "Xuất danh sách" and "Nhập danh sách" (F-69): the whole roster of every
 * branch out to Excel and back. The page shows them to admins only — the
 * server checks the same permission on both endpoints.
 */
export function PatientRosterActions() {
  const [importing, setImporting] = useState(false);
  const exportRoster = useExportPatientRoster();

  const handleExport = () => exportRoster.mutate();

  return (
    <>
      <Button icon={<FileExcelOutlined />} loading={exportRoster.isPending} onClick={handleExport}>
        {t("PatientRoster:ExportBtn")}
      </Button>
      <Button icon={<UploadOutlined />} onClick={() => setImporting(true)}>
        {t("PatientRoster:OpenImportBtn")}
      </Button>

      {importing && (
        <PatientRosterImportDialog
          open
          exporting={exportRoster.isPending}
          onExport={handleExport}
          onClose={() => setImporting(false)}
        />
      )}
    </>
  );
}
