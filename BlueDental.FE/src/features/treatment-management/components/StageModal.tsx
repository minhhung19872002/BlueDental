import { useEffect } from "react";
import { Alert, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import { useCreateStage } from "../api/stageApi";
import {
  SERVICE_LINE_STATUS,
  useTreatmentPlans,
  type TreatmentPlanSlipDto,
} from "../api/treatmentPlanApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface StageModalProps {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface StageFormValues {
  serviceLineId: string;
  name: string;
  staffId: string;
  note?: string;
  scheduledDate?: dayjs.Dayjs;
}

/** A service line and the slip it belongs to, flattened for the picker. */
interface ServiceLineOption {
  id: string;
  planId: string;
  label: string;
  serviceId: string;
}

/**
 * A công đoạn is always a step of one service line of a treatment slip, so only
 * lines that are still open are offered.
 */
export function StageModal({ open, patientId, onClose }: StageModalProps) {
  const [form] = Form.useForm<StageFormValues>();
  const branchId = useCurrentBranchId();
  const createStage = useCreateStage();

  const { data: plans } = useTreatmentPlans(patientId, branchId);
  const { data: dentists } = useDentistList();

  const serviceLines: ServiceLineOption[] = (plans?.items ?? []).flatMap(
    (slip: TreatmentPlanSlipDto) =>
      slip.services
        .filter(
          (line) =>
            line.status !== SERVICE_LINE_STATUS.Cancelled &&
            line.status !== SERVICE_LINE_STATUS.Done,
        )
        .map((line) => ({
          id: line.id,
          planId: slip.id,
          serviceId: line.serviceId,
          label: t("{0} · {1} — {2} đ", slip.code, line.serviceName ?? line.code, formatVND(line.effectiveAmount)),
        })),
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const line = serviceLines.find((item) => item.id === values.serviceLineId);
    if (!line) return;

    try {
      await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: line.planId,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: values.name,
        note: values.note,
        staffId: values.staffId,
        scheduledDate: values.scheduledDate?.format("YYYY-MM-DD"),
      });

      toast.success(t("Đã thêm công đoạn"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("Thêm công đoạn")}
      okText={t("Tạo")}
      cancelText={t("Huỷ")}
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
          message={t("Chưa có dịch vụ điều trị đang mở")}
          description={t("Công đoạn là một bước của dịch vụ trong kế hoạch điều trị. Hãy chốt phiếu tư vấn rồi tạo kế hoạch điều trị trước.")}
        />
      ) : (
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="serviceLineId"
            label={t("Dịch vụ điều trị")}
            rules={[{ required: true, message: t("Vui lòng chọn dịch vụ") }]}
          >
            <Select
              placeholder={t("Chọn dịch vụ")}
              options={serviceLines.map((line) => ({ value: line.id, label: line.label }))}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label={t("Tên công đoạn")}
            rules={[{ required: true, message: t("Vui lòng nhập tên công đoạn") }]}
          >
            <Input placeholder={t("Tên công đoạn")} maxLength={300} />
          </Form.Item>

          <Form.Item
            name="staffId"
            label={t("Bác sĩ thực hiện")}
            rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
          >
            <Select
              placeholder={t("Chọn bác sĩ")}
              options={(dentists ?? []).map((dentist) => ({
                value: dentist.id,
                label: dentist.name,
              }))}
            />
          </Form.Item>

          <Form.Item name="scheduledDate" label={t("Ngày dự kiến")}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label={t("Ghi chú")}>
            <Input.TextArea rows={3} maxLength={2000} placeholder={t("Ghi chú công đoạn")} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
