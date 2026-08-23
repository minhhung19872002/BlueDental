import { useEffect } from "react";
import { Alert, DatePicker, Form, Input, Modal, Select, message } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useCreateStage } from "../api/stageApi";
import { usePatientAdvises } from "../api/consultingQueries";
import { ADVISE_STATUS, type PatientAdviseDto } from "../api/consultingApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

interface StageModalProps {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface StageFormValues {
  treatmentServiceId: string;
  name: string;
  staffId: string;
  note?: string;
  scheduledDate?: dayjs.Dayjs;
}

/**
 * A stage is always a step of one service line. In BlueDental a service line is a
 * consulting line the patient accepted, so only those are offered here.
 */
export function StageModal({ open, patientId, onClose }: StageModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<StageFormValues>();
  const branchId = useCurrentBranchId();
  const createStage = useCreateStage();

  const { data: advises } = usePatientAdvises({ patientId });
  const { data: dentists } = useDentistList();

  const serviceLines = (advises?.items ?? []).filter(
    (advise) =>
      advise.status === ADVISE_STATUS.Accepted || advise.status === ADVISE_STATUS.Converted,
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const line = serviceLines.find((item) => item.id === values.treatmentServiceId);
    if (!line) return;

    try {
      await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: line.treatmentPlanId,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: values.name,
        note: values.note,
        staffId: values.staffId,
        scheduledDate: values.scheduledDate?.format("YYYY-MM-DD"),
      });

      message.success(t("treatment.stageCreated"));
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("treatment.stageModalTitle")}
      okText={t("treatment.stageModalOk")}
      cancelText={t("treatment.stageModalCancel")}
      okButtonProps={{ disabled: serviceLines.length === 0 }}
      confirmLoading={createStage.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      {serviceLines.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message={t("treatment.stageNoServices")}
          description={t("treatment.stageNoServicesDesc")}
        />
      ) : (
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="treatmentServiceId"
            label={t("treatment.stageFieldService")}
            rules={[{ required: true, message: t("treatment.stageServiceRequired") }]}
          >
            <Select
              placeholder={t("treatment.stageServicePlaceholder")}
              options={serviceLines.map((line: PatientAdviseDto) => ({
                value: line.id,
                label: `${line.code} — ${line.serviceName ?? t("treatment.stageServiceDefault")}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label={t("treatment.stageFieldName")}
            rules={[{ required: true, message: t("treatment.stageNameRequired") }]}
          >
            <Input placeholder={t("treatment.stageNamePlaceholder")} maxLength={300} />
          </Form.Item>

          <Form.Item
            name="staffId"
            label={t("treatment.stageFieldDoctor")}
            rules={[{ required: true, message: t("treatment.stageDoctorRequired") }]}
          >
            <Select
              placeholder={t("treatment.stageDoctorPlaceholder")}
              options={(dentists ?? []).map((dentist) => ({
                value: dentist.id,
                label: dentist.name,
              }))}
            />
          </Form.Item>

          <Form.Item name="scheduledDate" label={t("treatment.stageFieldScheduledDate")}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label={t("treatment.stageFieldNote")}>
            <Input.TextArea rows={3} maxLength={2000} placeholder={t("treatment.stageNotePlaceholder")} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
