import { useEffect } from "react";
import { DatePicker, Form, Input, InputNumber, Radio, Select, TimePicker, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import {
  CARE_OUTCOME,
  CARE_STATUS,
  CARE_TYPE,
  useCreateCareRecord,
  useUpdateCareRecord,
  type CareOutcome,
  type CareRecordDto,
} from "@/features/cskh/api/careApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useLaboSupplierList } from "@/features/labo/api/laboCatalogApi";
import {
  useCreateLaboOrder,
  useUpdateLaboOrder,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";
import type { PatientDto } from "../../types/patient";

interface CareValues {
  careDate: Dayjs;
  careTime: Dayjs;
  description?: string;
  assignedStaffId?: string;
  careStaffId: string;
  outcome: CareOutcome;
}

export function PatientCareDialog({
  open,
  patient,
  record,
  onClose,
}: {
  open: boolean;
  patient: PatientDto;
  record?: CareRecordDto | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<CareValues>();
  const create = useCreateCareRecord();
  const update = useUpdateCareRecord();
  const branchId = useCurrentBranchId();
  const staff = useStaffOptions().data ?? [];
  const dentists = useDentistList().data ?? [];

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      careDate: dayjs(record?.dueAt ?? undefined),
      careTime: dayjs(record?.dueAt ?? undefined),
      careStaffId: record?.careStaffId ?? staff[0]?.value,
      assignedStaffId: record?.assignedStaffId ?? undefined,
      description: record?.description ?? undefined,
      outcome: record?.outcome ?? CARE_OUTCOME.Good,
    });
  }, [form, open, record, staff]);

  const save = async () => {
    const value = await form.validateFields();
    const dueAt = value.careDate
      .hour(value.careTime.hour())
      .minute(value.careTime.minute())
      .second(0)
      .toISOString();
    try {
      if (record) {
        await update.mutateAsync({
          id: record.id,
          assignedStaffId: value.assignedStaffId,
          careStaffId: value.careStaffId,
          description: value.description,
          dueAt,
          status: CARE_STATUS.Succeeded,
        });
      } else {
        await create.mutateAsync({
          patientId: patient.id,
          branchId,
          assignedStaffId: value.assignedStaffId,
          careStaffId: value.careStaffId,
          type: CARE_TYPE.Special,
          status: CARE_STATUS.Succeeded,
          outcome: value.outcome,
          subject: t("Chăm sóc khách hàng"),
          description: value.description,
          dueAt,
        });
      }
      toast.success(record ? t("Đã cập nhật nội dung chăm sóc") : t("Đã tạo nội dung chăm sóc"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={record ? t("Cập nhật chăm sóc khách hàng") : t("Chăm sóc khách hàng")}
      width={520}
      canSave
      saving={create.isPending || update.isPending}
      onSave={() => void save()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" className="pd-care-form">
        <div className="pd-dialog-row">
          <Form.Item name="careDate" label={t("Ngày chăm sóc")} rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="careTime" label={t("Thời gian")} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" />
          </Form.Item>
        </div>
        <Form.Item label={t("Bệnh nhân")}>
          <Input value={`[${patient.patientCode}] - ${patient.fullName}`} disabled />
        </Form.Item>
        <Form.Item name="description" label={t("Ghi chú chăm sóc")}>
          <Input.TextArea rows={3} placeholder={t("Nhập nội dung chăm sóc")} />
        </Form.Item>
        <Form.Item name="assignedStaffId" label={t("Bác sĩ tiếp nhận")}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={dentists.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Form.Item>
        <Form.Item
          name="careStaffId"
          label={t("Nhân viên chăm sóc")}
          rules={[{ required: true, message: t("Vui lòng chọn nhân viên") }]}
        >
          <Select showSearch optionFilterProp="label" options={staff} />
        </Form.Item>
        <Form.Item name="outcome" label={t("Đánh giá")}>
          <Radio.Group>
            <Radio value={CARE_OUTCOME.Good}>{t("Tốt")}</Radio>
            <Radio value={CARE_OUTCOME.Fair}>{t("Khá")}</Radio>
            <Radio value={CARE_OUTCOME.Normal}>{t("Bình thường")}</Radio>
            <Radio value={CARE_OUTCOME.Complaint}>{t("Khiếu nại")}</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </AppDialog>
  );
}

interface LaboValues {
  dentistId: string;
  supplierId: string;
  sentAt: Dayjs;
  sentTime: Dayjs;
  dueDate: Dayjs;
  dueTime: Dayjs;
  material?: string;
  shade?: string;
  toothNumbers?: string;
  quantity: number;
  workDescription?: string;
  notes?: string;
  estimatedCost: number;
}

export function PatientLaboDialog({
  open,
  patient,
  order,
  onClose,
}: {
  open: boolean;
  patient: PatientDto;
  order?: LaboOrderDto | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<LaboValues>();
  const create = useCreateLaboOrder();
  const update = useUpdateLaboOrder();
  const dentists = useDentistList().data ?? [];
  const suppliers = useLaboSupplierList({ skipCount: 0, maxResultCount: 200 }).data?.items ?? [];

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        dentistId: order?.dentistId ?? undefined,
        supplierId: order?.supplierId ?? undefined,
        sentAt: dayjs(order?.sentAt ?? undefined),
        sentTime: dayjs(order?.sentAt ?? undefined),
        dueDate: order?.dueDate ? dayjs(order.dueDate) : dayjs().add(7, "day"),
        dueTime: order?.dueDate ? dayjs(order.dueDate) : dayjs(),
        toothNumbers: order?.toothNumbers,
        workDescription: order?.workDescription,
        notes: order?.notes,
        quantity: 1,
        estimatedCost: order?.estimatedCost ?? 0,
      });
    }
  }, [form, open, order]);

  const save = async () => {
    const value = await form.validateFields();
    const supplier = suppliers.find((item) => item.id === value.supplierId);
    try {
      const input = {
        labProviderName: supplier?.name ?? order?.labProviderName ?? t("Nhà cung cấp Labo"),
        toothNumbers: value.toothNumbers,
        workDescription: [
          value.workDescription,
          value.material && `${t("Vật liệu")}: ${value.material}`,
          value.shade && `${t("Màu răng")}: ${value.shade}`,
        ]
          .filter(Boolean)
          .join(" · "),
        notes: value.notes,
        dueDate: value.dueDate
          .hour(value.dueTime.hour())
          .minute(value.dueTime.minute())
          .toISOString(),
        estimatedCost: value.estimatedCost,
      };
      if (order) await update.mutateAsync({ id: order.id, data: input });
      else
        await create.mutateAsync({ patientId: patient.id, dentistId: value.dentistId, ...input });
      toast.success(order ? t("Đã cập nhật phiếu Labo") : t("Đã tạo phiếu Labo"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={order ? t("Cập nhật phiếu Labo") : t("Tạo phiếu Labo")}
      width={1180}
      canSave
      saving={create.isPending || update.isPending}
      onSave={() => void save()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" className="pd-labo-form">
        <div className="pd-labo-grid">
          <Form.Item label={t("Bệnh nhân")}>
            <Input value={`[${patient.patientCode}] - ${patient.fullName}`} disabled />
          </Form.Item>
          <Form.Item label={t("Kế hoạch điều trị")} required>
            <Select disabled placeholder={t("Chọn kế hoạch điều trị")} />
          </Form.Item>
          <Form.Item label={t("Dịch vụ điều trị")} required>
            <Select disabled placeholder={t("Chọn dịch vụ điều trị")} />
          </Form.Item>
          <Form.Item
            name="dentistId"
            label={t("Bác sĩ chỉ định")}
            rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={dentists.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item label={t("Mã phiếu Labo")}>
            <Input disabled placeholder={t("Tự động tạo")} />
          </Form.Item>
          <div className="pd-dialog-row">
            <Form.Item name="sentAt" label={t("Ngày gửi")}>
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="sentTime" label={t("Giờ gửi")}>
              <TimePicker format="HH:mm" />
            </Form.Item>
          </div>
          <Form.Item
            name="supplierId"
            label={t("Nhà cung cấp")}
            rules={[{ required: true, message: t("Vui lòng chọn nhà cung cấp") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={suppliers.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <div className="pd-dialog-row">
            <Form.Item name="dueDate" label={t("Ngày hẹn nhận")}>
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="dueTime" label={t("Giờ nhận")}>
              <TimePicker format="HH:mm" />
            </Form.Item>
          </div>
          <Form.Item name="material" label={t("Dịch vụ - Vật liệu")}>
            <Input placeholder={t("Chọn dịch vụ, vật liệu")} />
          </Form.Item>
          <Form.Item name="shade" label={t("Màu răng")}>
            <Input placeholder={t("Nhập màu răng")} />
          </Form.Item>
          <Form.Item name="toothNumbers" label={t("Số răng")}>
            <Input placeholder="11, 12, 21..." />
          </Form.Item>
          <Form.Item name="quantity" label={t("Số lượng")}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="estimatedCost" label={t("Chi phí dự kiến")}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="workDescription" label={t("Nội dung")} className="pd-labo-wide">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="notes" label={t("Ghi chú")} className="pd-labo-wide">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t("Hình ảnh")} className="pd-labo-wide">
            <Upload.Dragger beforeUpload={() => false} maxCount={5}>
              <InboxOutlined />
              <p>{t("Kéo thả hoặc chọn ảnh Labo")}</p>
            </Upload.Dragger>
          </Form.Item>
        </div>
      </Form>
    </AppDialog>
  );
}
