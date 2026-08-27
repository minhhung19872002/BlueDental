import type { CareRecordDto } from "../api/careApi";
import type { CareTabConfig } from "../careTabs";
import type { CareDialogKind } from "../hooks/useCareBoard";
import { CareCreateDialog } from "./CareCreateDialog";
import { CareResultDialog } from "./CareResultDialog";
import { SendZaloDialog } from "./SendZaloDialog";
import { SaveMessageDialog } from "./SaveMessageDialog";

interface CareBoardDialogsProps {
  tab: CareTabConfig;
  dialog: CareDialogKind | null;
  selected: CareRecordDto | null;
  onClose: () => void;
}

/** All four board dialogs behind one mount point. */
export function CareBoardDialogs({ tab, dialog, selected, onClose }: CareBoardDialogsProps) {
  return (
    <>
      <CareCreateDialog open={dialog === "create"} tab={tab} onClose={onClose} />
      <CareResultDialog
        open={dialog === "result"}
        tab={tab}
        record={selected}
        onClose={onClose}
      />
      <SendZaloDialog open={dialog === "send"} record={selected} onClose={onClose} />
      <SaveMessageDialog
        open={dialog === "message"}
        patient={
          selected
            ? { code: selected.patientCode ?? "", name: selected.patientName ?? "" }
            : null
        }
        onClose={onClose}
      />
    </>
  );
}
