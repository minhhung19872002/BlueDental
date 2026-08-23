import { useEffect } from "react";
import { Alert, Col, Form, Input, InputNumber, Modal, Row, Select, Typography, message } from "antd";
import { useTranslation } from "react-i18next";
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
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";

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
  const { t } = useTranslation();
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

      message.success(t("treatment.adviseCreated"));
      onCreated?.();
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={diagnosis ? t("treatment.adviseModalCreateTitle", { code: diagnosis.code }) : t("treatment.adviseModalDefaultTitle")}
      okText={t("treatment.adviseModalOk")}
      cancelText={t("treatment.adviseModalCancel")}
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
          message={`${diagnosis.diagnosisName ?? diagnosis.code} — ${t("patient.tooth")} ${formatTeeth(diagnosis.teeth)}`}
        />
      )}

      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="serviceId"
          label={t("treatment.adviseFieldService")}
          rules={[{ required: true, message: t("treatment.adviseServiceRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={
              (services?.length ?? 0) === 0
                ? t("treatment.adviseServiceEmptyCatalog")
                : t("treatment.adviseServicePlaceholder")
            }
            onChange={handleServiceChange}
            options={(services ?? []).map((s) => ({
              value: s.id,
              label: s.price != null ? `${s.name} — ${formatVND(s.price)} đ` : s.name,
            }))}
          />
        </Form.Item>

        {selectedService?.isImageRequired && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t("treatment.adviseAlertImageRequired")}
          />
        )}

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item
              name="price"
              label={t("treatment.adviseFieldPrice")}
              rules={[
                { required: true, message: t("treatment.advisePriceRequired") },
                { type: "number", min: 0, message: t("treatment.advisePriceNegative") },
              ]}
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                min={0}
                step={100000}
                formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                parser={(v) => Number((v ?? "").replace(/\./g, ""))}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="quantity"
              label={t("treatment.adviseFieldQuantity")}
              rules={[
                { required: true, message: t("treatment.adviseQuantityRequired") },
                { type: "number", min: 1, message: t("treatment.adviseQuantityMin") },
              ]}
            >
              <InputNumber<number> style={{ width: "100%" }} min={1} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="discountType" label={t("treatment.adviseFieldDiscount")}>
              <Select
                options={[
                  { value: DISCOUNT_TYPE.None, label: t("treatment.adviseDiscountNone") },
                  { value: DISCOUNT_TYPE.Money, label: t("treatment.adviseDiscountMoney") },
                  { value: DISCOUNT_TYPE.Percentage, label: t("treatment.adviseDiscountPercent") },
                ]}
                onChange={() => form.setFieldValue("discountValue", 0)}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="discountValue"
              label={t("treatment.adviseFieldDiscountValue")}
              rules={[
                { type: "number", min: 0, message: t("treatment.adviseDiscountNegative") },
                ...(discountType === DISCOUNT_TYPE.Percentage
                  ? [{ type: "number" as const, max: 100, message: t("treatment.adviseDiscountMax") }]
                  : []),
              ]}
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                min={0}
                disabled={discountType === DISCOUNT_TYPE.None}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="staffId"
          label={t("treatment.adviseFieldDoctor")}
          rules={[{ required: true, message: t("treatment.adviseDoctorRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>

        <Form.Item name="note" label={t("treatment.adviseFieldNote")}>
          <Input.TextArea rows={2} />
        </Form.Item>

        <div
          style={{
            borderTop: "1px solid #E5E7EB",
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#5A6B82" }}>{t("treatment.adviseEffectiveAmount")}</Text>
          <Text strong style={{ fontSize: 16, color: "#1B2A41" }}>
            {formatVND(effective)} đ
          </Text>
        </div>
      </Form>
    </Modal>
  );
}
