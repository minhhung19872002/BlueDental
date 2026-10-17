import { Spin } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { RecordSetWorkflow } from "./useRecordSetWorkflow";
import { CancelRecordSetDialog } from "./CancelRecordSetDialog";
import { RECORD_SET_DIALOG_WIDTH, RecordSetDialog } from "./RecordSetDialog";

interface Props {
  workflow: RecordSetWorkflow;
  /** "[DH260253] Hồ Thị Thanh Bình". */
  patientLabel: string;
}

/** The set dialogs the workflow opens; nothing is mounted while none is. */
export function RecordSetDialogs({ workflow, patientLabel }: Props) {
  const { dialog, cancel } = workflow;

  return (
    <>
      {dialog.mode && dialog.refreshing && (
        // The same frame, holding still until the slips and sets are read again.
        <AppDialog
          open
          title={
            dialog.mode.kind === "create"
              ? t("Patient:RecordSet:DialogNew")
              : t("Patient:RecordSet:DialogEdit", dialog.mode.set.code)
          }
          subtitle={patientLabel}
          width={RECORD_SET_DIALOG_WIDTH}
          className="rs-dialog"
          canSave={false}
          saveIcon={null}
          cancelLabel={t("Patient:Misc:CancelVN")}
          onSave={dialog.close}
          onClose={dialog.close}
        >
          <div className="rs-dialog-loading">
            <Spin />
          </div>
        </AppDialog>
      )}
      {dialog.mode && !dialog.refreshing && (
        <RecordSetDialog
          key={dialog.key}
          mode={dialog.mode}
          patientLabel={patientLabel}
          plans={workflow.plans}
          saving={dialog.saving}
          onSubmit={dialog.submit}
          onClose={dialog.close}
        />
      )}
      {cancel.set && (
        <CancelRecordSetDialog
          set={cancel.set}
          pending={cancel.pending}
          onConfirm={cancel.confirm}
          onClose={cancel.close}
        />
      )}
    </>
  );
}
