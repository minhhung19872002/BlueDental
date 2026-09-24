import { Modal } from "antd";
import { Save, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { ToothPickerDialog } from "../../plan/ToothPickerDialog";
import type { PlanDetailRow } from "../planDetailTypes";
import { ConvertCurrentService } from "./ConvertCurrentService";
import { ConvertNewService } from "./ConvertNewService";
import { useConvertServiceForm } from "./useConvertServiceForm";

interface Props {
  row: PlanDetailRow | null;
  onClose: () => void;
}

/**
 * "Chuyển đổi dịch vụ" — what the status pill's Chuyển đổi opens.
 *
 * Two columns: the line being closed with the money already on it, and the
 * line taking its place. Saving closes the old line ("Chuyển đổi"), writes
 * the new one and moves the collected money across; anything the new service
 * cannot absorb is refunded or left as the patient's credit, which is what
 * "Xử lý chênh lệch" decides.
 *
 * Measured against the reference on 2026-09-22; see
 * docs/clone/pages/treatment-plan-detail.md.
 */
export function ConvertServiceDialog({ row, onClose }: Props) {
  const form = useConvertServiceForm(row, onClose);

  return (
    <Modal
      open={row !== null}
      title={t("Treatment:Convert:ConvertService")}
      className="tp-dialog cvt-dialog"
      width="min(1024px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="cvt-foot">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            disabled={form.saving || form.hasOpenLabo}
            onClick={() => void form.save()}
          >
            <Save size={16} aria-hidden="true" />
            {t("Common:Save")}
          </button>
        </div>
      }
    >
      {row && (
        <div className="cvt-grid">
          <ConvertCurrentService
            row={row}
            hasOpenLabo={form.hasOpenLabo}
            onLaboCleared={form.clearLabo}
          />
          <ConvertNewService form={form} />
        </div>
      )}
      <ToothPickerDialog
        open={form.teethOpen}
        value={form.teeth}
        onConfirm={form.confirmTeeth}
        onClose={form.closeTeeth}
      />
    </Modal>
  );
}
