import { useEffect } from "react";
import { Alert, Col, Form, Input, InputNumber, Modal, Row, Select, Typography } from "antd";
import { useCreateAdvise } from "../api/consultingQueries";
import {
  DISCOUNT_TYPE,
  formatTeeth,
  type DiscountType,
  type PatientDiagnosisDto,
} from "../api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";

const { Text } = Typography;

interface AdviseModalProps {
  open: boolean;
  patientId: string;
  /** The diagnosis this advise answers — an advise always hangs off one. */
  diagnosis: PatientDiagnosisDto | null;
  onClose: () => void;
  onCreated?: () => void;
}

interface AdviseFormValues {
  serviceId: string;
  staffId: string;
  secondStaffId?: string;
  price: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  note?: string;
}

export function AdviseModal({
  open,
  patientId,
  diagnosis,
  onClose,
  onCreated,
}: AdviseModalProps) {
  const [form] = Form.useForm<AdviseFormValues>();
  const branchId = useCurrentBranchId();
  const createAdvise = useCreateAdvise();

  const { data: services } = useCatalogOptions(CATALOG_GROUP.CareService);
  const { data: dentists } = useDentistList();

  const serviceId = Form.useWatch("serviceId", form);
  const price = Form.useWatch("price", form) ?? 0;
  const quantity = Form.useWatch("quantity", form) ?? 1;
  const discountType = Form.useWatch("discountType", form) ?? DISCOUNT_TYPE.None;
  const discountValue = Form.useWatch("discountValue", form) ?? 0;

  const selectedService = services?.find((s) => s.id === serviceId);

  // Mirrors PatientAdvise.EffectiveAmount so the clinician sees what the server
  // will store, instead of finding out after saving.
  const gross = price * quantity;
  const discount =
    discountType === DISCOUNT_TYPE.Money
      ? discountValue
      : discountType === DISCOUNT_TYPE.Percentage
        ? (gross * discountValue) / 100
        : 0;
  const effective = Math.max(gross - discount, 0);

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      serviceId: undefined,
      staffId: diagnosis?.staffId,
      secondStaffId: diagnosis?.secondStaffId ?? undefined,
      price: undefined,
      quantity: 1,
      discountType: DISCOUNT_TYPE.None,
      discountValue: 0,
      note: undefined,
    });
  }, [open, diagnosis, form]);

  const handleServiceChange = (value: string) => {
    // Default to the catalog price; the clinician can still negotiate it.
    const service = services?.find((s) => s.id === value);
    form.setFieldValue("price", service?.price ?? 0);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (!diagnosis) return;

    try {
      await createAdvise.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        patientDiagnosisId: diagnosis.id,
        diagnosisId: diagnosis.diagnosisId,
        serviceId: values.serviceId,
        staffId: values.staffId,
        secondStaffId: values.secondStaffId,
        originalPrice: selectedService?.price ?? values.price,
        price: values.price,
        quantity: values.quantity,
        discountType: values.discountType,
        discountValue: values.discountType === DISCOUNT_TYPE.None ? 0 : values.discountValue,
        note: values.note,
        // An advise inherits the teeth of the diagnosis it answers.
        teeth: diagnosis.teeth,
      });

      toast.success(t("Đã tạo phiếu tư vấn"));
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={diagnosis ? t("Tạo dịch vụ cho phiếu {0}", diagnosis.code) : t("Tạo phiếu tư vấn")}
      okText={t("Tạo")}
      cancelText={t("Huỷ")}
      confirmLoading={createAdvise.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      {diagnosis && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("{0} — răng {1}", diagnosis.diagnosisName ?? diagnosis.code, formatTeeth(diagnosis.teeth))}
        />
      )}

      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="serviceId"
          label={t("Dịch vụ")}
          rules={[{ required: true, message: t("Vui lòng chọn dịch vụ") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={
              (services?.length ?? 0) === 0
                ? t("Chưa có danh mục dịch vụ — thêm ở trang Danh mục")
                : t("Chọn dịch vụ")
            }
            onChange={handleServiceChange}
            options={(services ?? []).map((s) => ({
              value: s.id,
              label: s.price != null ? t("{0} — {1} đ", s.name, formatVND(s.price)) : s.name,
            }))}
          />
        </Form.Item>

        {selectedService?.isImageRequired && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t("Dịch vụ này yêu cầu đính kèm ảnh trước khi điều trị.")}
          />
        )}

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item
              name="price"
              label={t("Đơn giá (đ)")}
              rules={[
                { required: true, message: t("Vui lòng nhập đơn giá") },
                { type: "number", min: 0, message: t("Đơn giá không được âm") },
              ]}
            >
              <CurrencyInput />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="quantity"
              label={t("Số lượng")}
              rules={[
                { required: true, message: t("Vui lòng nhập số lượng") },
                { type: "number", min: 1, message: t("Số lượng phải lớn hơn 0") },
              ]}
            >
              <InputNumber<number> style={{ width: "100%" }} min={1} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="discountType" label={t("Chiết khấu")}>
              <Select
                options={[
                  { value: DISCOUNT_TYPE.None, label: t("Không chiết khấu") },
                  { value: DISCOUNT_TYPE.Money, label: t("Số tiền (đ)") },
                  { value: DISCOUNT_TYPE.Percentage, label: t("Phần trăm (%)") },
                ]}
                onChange={() => form.setFieldValue("discountValue", 0)}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="discountValue"
              label={t("Giá trị")}
              rules={[
                { type: "number", min: 0, message: t("Không được âm") },
                ...(discountType === DISCOUNT_TYPE.Percentage
                  ? [{ type: "number" as const, max: 100, message: t("Tối đa 100%") }]
                  : []),
              ]}
            >
              <CurrencyInput disabled={discountType === DISCOUNT_TYPE.None} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="staffId"
          label={t("Bác sĩ tư vấn")}
          rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="note" label={t("Ghi chú")}>
          <Input.TextArea rows={2} />
        </Form.Item>

        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#6f7c90" }}>{t("Thành tiền")}</Text>
          <Text strong style={{ fontSize: 16, color: "#101c2c" }}>
            {formatVND(effective)} {t("đ")}
          </Text>
        </div>
      </Form>
    </Modal>
  );
}
