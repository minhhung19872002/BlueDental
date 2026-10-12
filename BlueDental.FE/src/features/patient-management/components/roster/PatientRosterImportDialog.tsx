import { Button, Modal, Result, Steps, Upload } from "antd";
import { DownloadOutlined, InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { usePatientRosterImport, type RosterImportStep } from "../../hooks/usePatientRosterImport";
import { PatientRosterPreview, rosterChangeCount, rosterSummary } from "./PatientRosterPreview";

interface Props {
  open: boolean;
  exporting: boolean;
  /** Downloads the current roster — the file to edit. */
  onExport: () => void;
  onClose: () => void;
}

const STEP_INDEX: Record<RosterImportStep, number> = { file: 0, preview: 1, done: 2 };

/**
 * Imports the edited patient roster, in the shell of the other Excel imports:
 * choose the file, check it, then write it. The check is a full dry run, so
 * the preview is exactly what the import will do.
 */
export function PatientRosterImportDialog({ open, exporting, onExport, onClose }: Props) {
  const flow = usePatientRosterImport();
  const result = flow.result;
  const changes = result ? rosterChangeCount(result) : 0;

  const handleClose = () => {
    flow.reset();
    onClose();
  };

  const handleCommit = async () => {
    const committed = await flow.commit();
    if (committed) {
      toast.success(t("PatientRoster:Success", rosterChangeCount(committed)));
    }
  };

  const footer = (
    <div className="bd-modal-foot">
      <div className="bd-min0 bd-roster-foot-left">
        {flow.step === "preview" && (
          <>
            <Button disabled={flow.busy} onClick={flow.reset}>
              {t("Taxonomy:Import:BackBtn")}
            </Button>
            {result && result.errorCount > 0 && (
              <Button icon={<DownloadOutlined />} loading={flow.downloadingErrors} onClick={flow.downloadErrors}>
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
            disabled={flow.busy || !result || result.errorCount > 0 || changes === 0}
            onClick={() => void handleCommit()}
          >
            {t("PatientRoster:ImportBtn", changes)}
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
            <h2 className="bd-modal-title">{t("PatientRoster:ImportTitle")}</h2>
          </div>
        </div>
      }
      width={flow.step === "preview" ? 960 : 600}
      onCancel={handleClose}
      destroyOnHidden
      mask={{ closable: false }}
      className="app-dialog bd-roster-dialog"
      footer={footer}
    >
      <Steps
        className="bd-roster-steps"
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
          <ul className="bd-roster-hint">
            <li>{t("PatientRoster:Hint:Action")}</li>
            <li>{t("PatientRoster:Hint:Blank")}</li>
            <li>{t("PatientRoster:Hint:AllOrNothing")}</li>
          </ul>
          <Upload.Dragger
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
            <p className="ant-upload-hint">{t("PatientRoster:DropHint")}</p>
          </Upload.Dragger>
          <Button
            type="link"
            className="bd-roster-export-link"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={onExport}
          >
            {t("PatientRoster:DownloadCurrent")}
          </Button>
        </>
      )}

      {flow.step === "preview" && result && <PatientRosterPreview result={result} />}

      {flow.step === "done" && result && (
        <Result status="success" title={t("Taxonomy:Import:DoneTitle")} subTitle={rosterSummary(result)} />
      )}
    </Modal>
  );
}
