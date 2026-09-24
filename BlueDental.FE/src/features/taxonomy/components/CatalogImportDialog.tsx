import { Button, Modal, Result, Steps, Upload } from "antd";
import { DownloadOutlined, InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { CatalogImportPreview, importableCount, importSummary } from "./CatalogImportPreview";
import { useCatalogImport, type ImportStep } from "../hooks/useCatalogImport";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Taxonomy group slug of the current tab. */
  group: string;
  /** Tab label, named in the success toast. */
  tabLabel: string;
  /** Lowercase noun of the catalog, e.g. "nguồn đến". */
  noun: string;
  branchId: string;
  onClose: () => void;
}

const STEP_INDEX: Record<ImportStep, number> = { file: 0, preview: 1, done: 2 };

/**
 * Bulk-loads one catalog of one branch from an Excel file, in the shell every
 * Danh mục dialog uses. The server checks the whole file before anything is
 * written, so the preview is exact: what it shows is what the import will do.
 */
export function CatalogImportDialog({ open, group, tabLabel, noun, branchId, onClose }: Props) {
  const flow = useCatalogImport({ group, branchId });
  const branchName = useBranchInfo(branchId).data?.name ?? "";
  const result = flow.result;
  const importable = result ? importableCount(result) : 0;

  const handleClose = () => {
    flow.reset();
    onClose();
  };

  const handleCommit = async () => {
    const committed = await flow.commit();
    if (committed) {
      toast.success(t("Taxonomy:Import:Success", importableCount(committed), tabLabel));
    }
  };

  const footer = (
    <div className="bd-modal-foot">
      <div className="bd-min0 bd-import-foot-left">
        {flow.step === "preview" && (
          <>
            <Button disabled={flow.busy} onClick={flow.reset}>
              {t("Taxonomy:Import:BackBtn")}
            </Button>
            {result && result.errorCount > 0 && (
              <Button
                icon={<DownloadOutlined />}
                loading={flow.downloadingErrors}
                onClick={flow.downloadErrors}
              >
                {t("Taxonomy:Import:DownloadErrors")}
              </Button>
            )}
          </>
        )}
      </div>
      <div className="bd-modal-foot-actions">
        {flow.step === "file" && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={flow.busy}
            disabled={!flow.file || flow.busy}
            onClick={() => void flow.check()}
          >
            {t("Taxonomy:Import:CheckBtn")}
          </Button>
        )}
        {flow.step === "preview" && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={flow.busy}
            disabled={flow.busy || !result || result.errorCount > 0 || importable === 0}
            onClick={() => void handleCommit()}
          >
            {t("Taxonomy:Import:ImportBtn", importable)}
          </Button>
        )}
        {flow.step === "done" && (
          <Button type="primary" onClick={handleClose}>
            {t("Taxonomy:Import:CloseBtn")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      title={
        <div className="bd-modal-head">
          <div className="bd-min0">
            <h2 className="bd-modal-title">{t("Taxonomy:Import:Title", noun)}</h2>
          </div>
        </div>
      }
      width={flow.step === "preview" ? 960 : 600}
      onCancel={handleClose}
      destroyOnHidden
      mask={{ closable: false }}
      className="app-dialog bd-import-dialog"
      footer={footer}
    >
      <Steps
        className="bd-import-steps"
        size="small"
        current={STEP_INDEX[flow.step]}
        items={[
          { title: t("Taxonomy:Import:Step:File") },
          { title: t("Taxonomy:Import:Step:Preview") },
          { title: t("Taxonomy:Import:Step:Done") },
        ]}
      />

      {flow.step === "file" && (
        <>
          <p className="bd-import-hint">{t("Taxonomy:Import:BranchHint", branchName)}</p>
          <Upload.Dragger
            className="bd-import-dragger"
            accept=".xlsx"
            maxCount={1}
            beforeUpload={(file) => {
              flow.setFile(file);
              return false;
            }}
            onRemove={() => flow.setFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t("Taxonomy:Import:ChooseFile")}</p>
            <p className="ant-upload-hint">{t("Taxonomy:Import:DropHint")}</p>
          </Upload.Dragger>
          <Button
            type="link"
            className="bd-import-template"
            icon={<DownloadOutlined />}
            loading={flow.downloadingTemplate}
            onClick={flow.downloadTemplate}
          >
            {t("Taxonomy:Import:DownloadTemplate")}
          </Button>
        </>
      )}

      {flow.step === "preview" && result && <CatalogImportPreview result={result} />}

      {flow.step === "done" && result && (
        <Result status="success" title={t("Taxonomy:Import:DoneTitle")} subTitle={importSummary(result)} />
      )}
    </Modal>
  );
}
