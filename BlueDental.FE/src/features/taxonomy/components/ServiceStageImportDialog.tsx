import { Button, Modal, Result, Steps, Upload } from "antd";
import { DownloadOutlined, InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { ServiceStageDto } from "../api/taxonomyApi";
import type { ImportStep } from "../hooks/useCatalogImport";
import { useStageImport } from "../hooks/useStageImport";
import { ServiceStageImportPreview } from "./ServiceStageImportPreview";

interface Props {
  open: boolean;
  stages: ServiceStageDto[];
  serviceName: string | undefined;
  onApply: (next: ServiceStageDto[]) => void;
  onClose: () => void;
}

const STEP_INDEX: Record<ImportStep, number> = { file: 0, preview: 1, done: 2 };

/**
 * "Nhập" on the Công đoạn tab, in the catalog import's shell: choose a file,
 * see what it would do row by row, then replace the table. The table is only
 * stored with the service dialog's "Lưu".
 */
export function ServiceStageImportDialog({ open, stages, serviceName, onApply, onClose }: Props) {
  const flow = useStageImport({ stages, serviceName, onApply });
  const plan = flow.plan;

  const handleClose = () => {
    flow.reset();
    onClose();
  };

  const footer = (
    <div className="bd-modal-foot">
      <div className="bd-min0 bd-import-foot-left">
        {flow.step === "preview" && (
          <>
            <Button onClick={flow.reset}>{t("Taxonomy:Import:BackBtn")}</Button>
            {plan && plan.counts.Error > 0 && (
              <Button icon={<DownloadOutlined />} onClick={flow.downloadErrors}>
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
            loading={flow.checking}
            disabled={!flow.file || flow.checking}
            onClick={() => void flow.check()}
          >
            {t("Taxonomy:Import:CheckBtn")}
          </Button>
        )}
        {flow.step === "preview" && (
          <Button type="primary" icon={<UploadOutlined />} disabled={!plan?.next} onClick={flow.apply}>
            {t("Taxonomy:Import:ImportBtn", plan?.next?.length ?? 0)}
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
            <h2 className="bd-modal-title">
              {t("Taxonomy:Import:Title", t("Taxonomy:Service:StageExcel:Noun"))}
            </h2>
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
          <Upload.Dragger
            className="bd-import-dragger"
            accept=".xlsx,.xls"
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
            onClick={flow.downloadTemplate}
          >
            {t("Taxonomy:Import:DownloadTemplate")}
          </Button>
        </>
      )}

      {flow.step === "preview" && plan && flow.sheet && (
        <ServiceStageImportPreview sheet={flow.sheet} plan={plan} />
      )}

      {flow.step === "done" && plan?.next && (
        <Result
          status="success"
          title={t("Taxonomy:Import:DoneTitle")}
          subTitle={t("Taxonomy:Service:StageExcel:Imported", plan.next.length)}
        />
      )}
    </Modal>
  );
}
