import type { CareRecordDto } from "../api/careApi";
import type { CareTabConfig } from "../careTabs";
import type { CareDialogKind } from "../hooks/useCareBoard";
import { CareCreateDialog } from "./CareCreateDialog";
import { CareResultDialog } from "./CareResultDialog";

interface CareBoardDialogsProps {
  tab: CareTabConfig;
  dialog: CareDialogKind | null;
  selected: CareRecordDto | null;
  onClose: () => void;
}

/** Both board dialogs behind one mount point; SMS / Zalo lead to Gửi tin nhắn instead. */
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
    </>
  );
}
