import { useMemo } from "react";
import { Form, Input, Modal } from "antd";
import { Save, X } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { DISCOUNT_TYPE, type PatientAdviseDto } from "../../api/consultingApi";
import { withAdviseService } from "./adviseEditing";
import { PlanAdvisorFields } from "./PlanAdvisorFields";
import { PlanPricingFields } from "./PlanPricingFields";
import { PlanServicePicker } from "./PlanServicePicker";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useDentistOptions } from "@/hooks/usePickerOptions";
import { ToothPickerDialog } from "./ToothPickerDialog";
import { formatToothValue } from "./toothPicker";
import { useCreatePlanForm, type CreatePlanValues } from "./useCreatePlanForm";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  /** An existing slip turns the dialog into "Cập nhật phiếu dịch vụ". */
  advise?: PatientAdviseDto | null;
  onClose: () => void;
}

const INITIAL_VALUES: Partial<CreatePlanValues> = {
  discountType: DISCOUNT_TYPE.Percentage,
  quantity: 0,
  discountValue: 0,
};

/**
 * "Tạo phiếu dịch vụ": one service, its diagnosis, teeth and price → a new
 * slip. Given an `advise` it is the reference's "Cập nhật phiếu dịch vụ": the
 * advising staff on top, service/doctor/diagnosis/price locked, discount,
 * note and teeth open.
 */
export function CreatePlanDialog({ open, patientId, branchId, advise, onClose }: Props) {
  const editing = Boolean(advise);

  // The service a slip already carries may have left the catalog; it travels
  // with the picker so its name still renders beside the fresh search results.
  const pickerServices = useMemo(() => withAdviseService([], advise), [advise]);

  const state = useCreatePlanForm({
    patientId,
    branchId,
    services: pickerServices,
    advise,
    onCreated: onClose,
  });
  const { form, teeth, totals } = state;
  const handleClose = () => {
    state.reset();
    onClose();
  };

  const handleValuesChange = (changed: Partial<CreatePlanValues>) => {
    // Picking goes through the picker's own callback; this only catches the
    // Select's clear button, which empties the field without a pick.
    if ("serviceId" in changed && !changed.serviceId) state.handleServiceCleared();
  };

  const picker = (
    <PlanServicePicker
      extraServices={pickerServices}
      disabled={editing}
      onPickService={state.handlePickService}
    />
  );

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={
        <div className="tp-create-foot">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            disabled={state.submitting}
            onClick={() => void state.submit()}
          >
            <Save size={16} aria-hidden="true" />
            {t("Lưu")}
          </button>
        </div>
      }
      width="min(772px, calc(100vw - 32px))"
      className="tp-dialog"
      title={editing ? t("Cập nhật phiếu dịch vụ") : t("Tạo phiếu dịch vụ")}
      closeIcon={<X size={20} aria-hidden="true" />}
      destroyOnHidden
    >
      <Form<CreatePlanValues>
        form={form}
        layout="vertical"
        className="tp-create-body"
        initialValues={INITIAL_VALUES}
        onValuesChange={handleValuesChange}
      >
        {/* Both modes open on the advising staff with the service picker beside
            them; the reference dropped the read-only "Người tạo" chip the
            create form used to carry (re-measured 2026-09-21). */}
        <PlanAdvisorFields
          hasSecond={Boolean(advise?.secondStaffId)}
          advisorName={advise?.staffName}
          secondAdvisorName={advise?.secondStaffName}
          picker={picker}
        />

        <div className="tp-create-grid">
          {/* Both are the **chẩn đoán's** doctors, and both are read-only: a
              slip raised from here files no chẩn đoán, and one opened on an
              existing line shows the doctors of the chẩn đoán it came from.
              Neither carries an asterisk or a required rule. */}
          <FloatingField name="staffId" label={t("Bác sĩ chẩn đoán 1")}>
            <ServerSearchSelect
              disabled
              useOptions={useDentistOptions}
              valueLabel={advise?.diagnosisStaffName}
              notFoundText={t("Không tìm thấy bác sĩ")}
            />
          </FloatingField>
          <div className="tp-create-field">
            <FloatingField name="diagnosisId" label={t("Chẩn đoán 2")}>
              <ServerSearchSelect
                disabled
                useOptions={useDentistOptions}
                valueLabel={advise?.diagnosisSecondStaffName}
                notFoundText={t("Không tìm thấy bác sĩ")}
              />
            </FloatingField>
          </div>
        </div>

        <div className="tp-create-split">
          <div>
            <div className="tp-create-teeth">
              <p>
                <span>{t("Răng")}:</span>{" "}
                <span>{formatToothValue(teeth) ?? t("Chưa chọn răng")}</span>
              </p>
              <button
                type="button"
                className="tp-tooth-btn"
                aria-label={t("Chọn răng")}
                onClick={() => state.setToothPickerOpen(true)}
              >
                <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
              </button>
            </div>
            {state.fieldErrors.teeth && <p className="tp-create-error">{state.fieldErrors.teeth}</p>}
            {/* The reference prints the label with nothing after it: this
                dialog names no condition. */}
            <p className="tp-create-condition">
              <span>{t("Tình trạng răng")}:</span>
            </p>
            <FloatingField
              name="note"
              label={t("Ghi chú")}
              className="tp-create-note"
              rules={[{ max: 255, message: t("Nội dung ghi chú vượt quá 255 ký tự.") }]}
            >
              <Input.TextArea rows={4} maxLength={255} />
            </FloatingField>
          </div>
          <PlanPricingFields form={form} totals={totals} />
        </div>
      </Form>

      <ToothPickerDialog
        open={state.toothPickerOpen}
        value={teeth}
        onConfirm={(next) => {
          state.setTeeth(next);
          state.setToothPickerOpen(false);
        }}
        onClose={() => state.setToothPickerOpen(false)}
      />
    </Modal>
  );
}
