import { useState } from "react";
import { Button, Input, Modal } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Name of the record being cancelled, shown in the question. */
  name: string;
  pending?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ConfirmCancelDialog({ open, name, pending, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(true);
      return;
    }
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason("");
    setError(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("Huỷ lịch hẹn")}</h2>}
      onCancel={handleClose}
      width={440}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (!visible) {
          setReason("");
          setError(false);
        }
      }}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={handleClose} disabled={pending}>
            {t("Đóng")}
          </Button>
          <Button
            danger
            type="primary"
            icon={<CloseCircleOutlined />}
            loading={pending}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? t("Đang huỷ…") : t("Xác nhận huỷ")}
          </Button>
        </div>
      }
    >
      <p style={{ margin: "0 0 8px" }}>
        {t("Bạn có chắc muốn huỷ lịch hẹn của")} <strong>{name}</strong>?
      </p>
      <Input.TextArea
        rows={3}
        placeholder={t("Nhập lý do huỷ...")}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (e.target.value.trim()) setError(false);
        }}
        status={error ? "error" : undefined}
      />
      {error && (
        <p style={{ margin: "4px 0 0", color: "var(--bd-danger, #e5484d)", fontSize: 13 }}>
          {t("Vui lòng nhập lý do huỷ")}
        </p>
      )}
    </Modal>
  );
}
