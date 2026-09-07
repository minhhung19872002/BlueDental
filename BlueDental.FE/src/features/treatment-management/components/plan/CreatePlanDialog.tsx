import { Form, Input, Modal, Select } from "antd";
import { ChevronDown, Save, Search, X } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { DISCOUNT_TYPE } from "../../api/consultingApi";
import { PlanPricingFields } from "./PlanPricingFields";
import { PlanServicePicker } from "./PlanServicePicker";
import { ToothPickerDialog } from "./ToothPickerDialog";
import { formatToothValue } from "./toothPicker";
import { useCreatePlanForm, type CreatePlanValues } from "./useCreatePlanForm";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  onClose: () => void;
}

const INITIAL_VALUES: Partial<CreatePlanValues> = {
  discountType: DISCOUNT_TYPE.Percentage,
  quantity: 0,
  discountValue: 0,
};

/** "Tạo phiếu dịch vụ": one service, its diagnosis, teeth and price → a new slip. */
export function CreatePlanDialog({ open, patientId, branchId, onClose }: Props) {
  const userName = useAuthStore((state) => state.user?.name ?? "");
  const services = useCatalogOptions(CATALOG_GROUP.CareService);
  const groups = useTaxonomyGroupOptions(CATALOG_GROUP.CareService);
  const diagnoses = useCatalogOptions(CATALOG_GROUP.Diagnosis);
  const dentists = useDentistList();

  const state = useCreatePlanForm({
    patientId,
    branchId,
    services: services.data ?? [],
    onCreated: onClose,
  });
  const { form, teeth, selectedService, totals } = state;
  const hasService = selectedService !== null;
  const diagnosisId = Form.useWatch("diagnosisId", form);
  const diagnosisName = diagnoses.data?.find((item) => item.id === diagnosisId)?.name;

  const handleClose = () => {
    state.reset();
    onClose();
  };

  const handleValuesChange = (changed: Partial<CreatePlanValues>) => {
    if ("serviceId" in changed) state.handleServiceChange(changed.serviceId);
  };

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
      title={t("Tạo phiếu dịch vụ")}
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
        <div className="tp-create-doctor" aria-label={t("Người tạo")}>
          <Search size={16} aria-hidden="true" />
          <span>{userName}</span>
        </div>

        <PlanServicePicker
          services={services.data ?? []}
          groups={groups.data ?? []}
          loading={services.isLoading || groups.isLoading}
          onPickService={(service) => state.handleServiceChange(service.id)}
        />

        <div className="tp-create-grid">
          <FloatingField
            name="staffId"
            label={t("Bác sĩ chẩn đoán 1")}
            rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
          >
            <Select
              showSearch
              disabled={!hasService}
              prefix={<Search size={20} aria-hidden="true" />}
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              optionFilterProp="label"
              options={(dentists.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
            />
          </FloatingField>
          <FloatingField
            name="diagnosisId"
            label={t("Chẩn đoán 2")}
            rules={[{ required: true, message: t("Vui lòng chọn chẩn đoán") }]}
          >
            <Select
              showSearch
              disabled={!hasService}
              prefix={<Search size={20} aria-hidden="true" />}
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              optionFilterProp="label"
              options={(diagnoses.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
            />
          </FloatingField>
        </div>

        <div className="tp-create-split">
          <div>
            <div className="tp-create-teeth">
              <p>
                <span>{t("Răng")}:</span> <span>{formatToothValue(teeth) ?? t("Chưa chọn răng")}</span>
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
            <p className="tp-create-condition">
              <span>{t("Tình trạng răng")}:</span> <span>{diagnosisName ?? "—"}</span>
            </p>
            <FloatingField name="note" label={t("Ghi chú")} className="tp-create-note">
              <Input.TextArea rows={4} />
            </FloatingField>
          </div>
          <PlanPricingFields form={form} enabled={hasService} totals={totals} />
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
