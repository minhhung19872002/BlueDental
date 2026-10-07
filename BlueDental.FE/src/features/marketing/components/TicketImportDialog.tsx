import type { ReactNode } from "react";
import { Button, Form, Steps, Upload } from "antd";
import { ArrowRightOutlined, DownloadOutlined, InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { StaffOption, TicketTagDto } from "../api/ticketSupportApi";
import { useTicketImport, type TicketImportStep } from "../hooks/useTicketImport";
import type { useSourceOptions } from "../hooks/useSourceOptions";
import { TicketImportMapping, type TicketImportValues } from "./TicketImportMapping";
import { TicketImportResult } from "./TicketImportResult";

interface Props {
  open: boolean;
  tags: TicketTagDto[];
  sources: ReturnType<typeof useSourceOptions>;
  /** Only with the transfer leaf: who the new tickets are dealt to. */
  staffOptions?: StaffOption[];
  onClose: () => void;
}

const STEP_INDEX: Record<TicketImportStep, number> = { file: 0, mapping: 1, result: 2 };

/** Import ticket từ file (BA 8.4) into the current branch: file → ghép cột & chia ticket → kết quả. */
export function TicketImportDialog({ open, tags, sources, staffOptions, onClose }: Props) {
  const flow = useTicketImport();
  const [form] = Form.useForm<TicketImportValues>();
  const branchName = useBranchInfo(useCurrentBranchId()).data?.name ?? "";
  const rejected = flow.step === "result" && flow.result?.committed === false;

  const handleClose = () => {
    flow.reset();
    onClose();
  };

  const footer: Record<TicketImportStep, { label: string; icon: ReactNode; canSave: boolean; onSave: () => void }> = {
    file: { label: t("Ticket:Import:Next"), icon: <ArrowRightOutlined />, canSave: Boolean(flow.file), onSave: () => void flow.readHeaders() },
    mapping: {
      label: t("Ticket:Import:Submit", flow.headers?.rowCount ?? 0),
      icon: <UploadOutlined />,
      canSave: true,
      onSave: () => form.submit(),
    },
    result: { label: t("Ticket:Import:Close"), icon: null, canSave: true, onSave: handleClose },
  };
  const action = footer[flow.step];

  return (
    <AppDialog
      open={open}
      title={t("Ticket:Import:Title")}
      width={flow.step === "file" ? 600 : 720}
      className="mkt-import-dialog"
      canSave={action.canSave}
      saving={flow.busy}
      saveLabel={action.label}
      savingLabel={action.label}
      saveIcon={action.icon}
      footerLeft={
        (flow.step === "mapping" || rejected) && (
          <Button disabled={flow.busy} onClick={flow.reset}>
            {t("Ticket:Import:Back")}
          </Button>
        )
      }
      onSave={action.onSave}
      onClose={handleClose}
    >
      <Steps
        className="mkt-import-steps"
        size="small"
        current={STEP_INDEX[flow.step]}
        status={rejected ? "error" : undefined}
        items={[
          { title: t("Ticket:Import:Step:File") },
          { title: t("Ticket:Import:Step:Mapping") },
          { title: t("Ticket:Import:Step:Result") },
        ]}
      />

      {flow.step === "file" && (
        <>
          <p className="mkt-import-hint">{t("Ticket:Import:BranchHint", branchName)}</p>
          <Upload.Dragger
            accept=".xlsx"
            maxCount={1}
            fileList={flow.file ? [{ uid: "file", name: flow.file.name, status: "done" }] : []}
            beforeUpload={(file) => {
              flow.setFile(file);
              return false;
            }}
            onRemove={() => flow.setFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t("Ticket:Import:ChooseFile")}</p>
            <p className="ant-upload-hint">{t("Ticket:Import:DropHint")}</p>
          </Upload.Dragger>
          <Button
            type="link"
            className="mkt-import-template"
            icon={<DownloadOutlined />}
            loading={flow.downloadingTemplate}
            onClick={flow.downloadTemplate}
          >
            {t("Ticket:File:Template")}
          </Button>
        </>
      )}

      {flow.step === "mapping" && flow.headers && (
        <>
          <p className="mkt-import-hint">{t("Ticket:Import:RowCount", flow.file?.name ?? "", flow.headers.rowCount)}</p>
          <TicketImportMapping
            form={form}
            headers={flow.headers}
            tags={tags}
            sources={sources}
            staffOptions={staffOptions}
            onSubmit={(options) => void flow.submit(options)}
          />
        </>
      )}

      {flow.step === "result" && flow.result && <TicketImportResult result={flow.result} />}
    </AppDialog>
  );
}
