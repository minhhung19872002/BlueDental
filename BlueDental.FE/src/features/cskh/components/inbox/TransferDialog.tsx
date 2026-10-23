import { useState } from "react";
import { Empty, Radio, Spin } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { useInboxAssignees } from "../../api/inboxApi";

interface Props {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onTransfer: (userId: string, name: string) => void;
}

/**
 * "Chuyển cho người khác" (BA P2210: "popup cho phép chọn user có quyền truy
 * cập vào chức năng này"): the branch's staff who hold Hộp thư Zalo › Xử lý.
 */
export function TransferDialog({ open, pending, onClose, onTransfer }: Props) {
  const assignees = useInboxAssignees(open);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedName = assignees.data?.find((a) => a.id === picked)?.name ?? "";

  const handleClose = () => {
    setPicked(null);
    onClose();
  };

  return (
    <AppDialog
      open={open}
      title={t("CSKH:Inbox:TransferTitle")}
      subtitle={t("CSKH:Inbox:TransferHint")}
      width={440}
      canSave={picked != null}
      saving={pending}
      saveLabel={t("CSKH:Inbox:TransferConfirm")}
      saveIcon={<SwapOutlined />}
      cancelLabel={t("Common:CancelAlt")}
      onSave={() => picked && onTransfer(picked, pickedName)}
      onClose={handleClose}
    >
      <Spin spinning={assignees.isLoading}>
        {assignees.data?.length === 0 ? (
          <Empty description={t("CSKH:Inbox:NoAssignee")} />
        ) : (
          <Radio.Group
            className="ibx-assignees"
            value={picked}
            onChange={(event) => setPicked(event.target.value as string)}
            options={(assignees.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
          />
        )}
      </Spin>
    </AppDialog>
  );
}
