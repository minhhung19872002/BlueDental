import { Button } from "antd";
import { CalendarOutlined, PrinterOutlined, SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { LaboDetailMode } from "./laboDetailMode";

interface Props {
  mode: LaboDetailMode;
  /** The sheet needs the clinic's letterhead before it can print. */
  printDisabled: boolean;
  saving: boolean;
  onPrint: () => void;
  onNewAppointment: () => void;
  onSave: () => void;
  onClose: () => void;
}

/**
 * The buttons under "Thông tin chung", as staging lays them out
 * (docs/clone/pages/labo.md §2.6): "In Phiếu Labo" always; on Mẫu Labo
 * "Tạo Lịch Hẹn Mới" with `appointment:create` and "Lưu" with
 * `laboTemplate:update`, and no Đóng even when both are missing; the
 * patient's Labo tab ends in Đóng instead.
 */
export function LaboDetailFooter({
  mode,
  printDisabled,
  saving,
  onPrint,
  onNewAppointment,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="pd-labo-footer pd-labo-detail-footer">
      <Button
        color="primary"
        variant="outlined"
        icon={<PrinterOutlined />}
        onClick={onPrint}
        disabled={printDisabled}
      >
        {t("Patient:Labo:Print")}
      </Button>
      {mode.variant === "patient" && (
        <Button type="primary" onClick={onClose}>
          {t("Common:Close")}
        </Button>
      )}
      {mode.variant === "orders" && mode.canCreateAppointment && (
        <Button color="primary" variant="outlined" icon={<CalendarOutlined />} onClick={onNewAppointment}>
          {t("Patient:Labo:NewAppointment")}
        </Button>
      )}
      {mode.variant === "orders" && mode.canUpdate && (
        <Button
          type="primary"
          className="pd-labo-save"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={saving}
          onClick={onSave}
        >
          {t("Common:Save")}
        </Button>
      )}
    </div>
  );
}
