import { useEffect } from "react";
import { Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import { toast } from "sonner";
import {
  useCreateSupply,
  useUpdateSupply,
  type SupplyDto,
} from "../api/suppliesApi";
import { CurrencyInput } from "@/components/CurrencyInput";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";

interface SupplyModalProps {
  open: boolean;
  supply: SupplyDto | null;
  groups: { id: string; name: string }[];
  defaultGroupId?: string;
  onClose: () => void;
}

interface SupplyFormValues {
  itemCode: string;
  name: string;
  taxonomyId?: string;
  unit?: string;
  reorderLevel: number;
  unitCost?: number | null;
  salePrice?: number | null;
  supplier?: string;
  origin?: string;
}

export function SupplyModal({
  open,
  supply,
  groups,
  defaultGroupId,
  onClose,
}: SupplyModalProps) {
  const [form] = Form.useForm<SupplyFormValues>();
  const branchId = useCurrentBranchId();
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply();

  const isEdit = supply !== null;

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      itemCode: supply?.itemCode ?? "",
      name: supply?.name ?? "",
      taxonomyId: supply?.taxonomyId ?? defaultGroupId,
      unit: supply?.unit ?? undefined,
      reorderLevel: supply?.reorderLevel ?? 0,
      unitCost: supply?.unitCost ?? undefined,
      salePrice: supply?.salePrice ?? undefined,
      supplier: supply?.supplier ?? undefined,
      origin: supply?.origin ?? undefined,
    });
  }, [open, supply, defaultGroupId, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      if (isEdit) {
        await updateSupply.mutateAsync({
          id: supply.id,
          input: {
            name: values.name,
            taxonomyId: values.taxonomyId,
            unit: values.unit,
            reorderLevel: values.reorderLevel,
            unitCost: values.unitCost ?? null,
            salePrice: values.salePrice ?? null,
            supplier: values.supplier,
            origin: values.origin,
          },
        });
        toast.success(t("Materials:SupplyUpdated"));
      } else {
        await createSupply.mutateAsync({
          branchId,
          itemCode: values.itemCode,
          name: values.name,
          taxonomyId: values.taxonomyId,
          unit: values.unit,
          reorderLevel: values.reorderLevel,
          unitCost: values.unitCost ?? null,
          salePrice: values.salePrice ?? null,
          supplier: values.supplier,
          origin: values.origin,
        });
        toast.success(t("Materials:SupplyAdded"));
      }

      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("Materials:EditSupplyTitle", supply.itemCode) : t("Materials:AddSupplyTitle")}
      okText={isEdit ? t("Materials:SupplyOkEdit") : t("Materials:SupplyOkAdd")}
      cancelText={t("Materials:SupplyCancelText")}
      confirmLoading={createSupply.isPending || updateSupply.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Row gutter={[12, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={10}>
            <Form.Item
              name="itemCode"
              label={t("Materials:SupplyCodeLabel")}
              rules={[{ required: true, message: t("Materials:SupplyCodeRequired") }]}
            >
              {/* The code is the branch-unique key, so it is fixed after creation. */}
              <Input disabled={isEdit} placeholder="VT001" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item
              name="name"
              label={t("Materials:SupplyNameLabel")}
              rules={[{ required: true, message: t("Materials:SupplyNameRequired") }]}
            >
              <Input placeholder={t("Materials:SupplyNamePlaceholder")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={14}>
            <Form.Item name="taxonomyId" label={t("Materials:SupplyGroupLabel")}>
              <Select
                allowClear
                placeholder={groups.length === 0 ? t("Materials:SupplyGroupNoItems") : t("Materials:SupplyGroupSelect")}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="unit" label={t("Materials:SupplyUnitLabel")}>
              <Input placeholder={t("Materials:SupplyUnitPlaceholder")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <Form.Item name="unitCost" label={t("Materials:SupplyCostLabel")}>
              <CurrencyInput />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="salePrice" label={t("Materials:SupplySalePriceLabel")}>
              <CurrencyInput />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[12, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <Form.Item name="supplier" label={t("Materials:SupplySupplierLabel")}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="origin" label={t("Materials:SupplyOriginLabel")}>
              <Input placeholder={t("Materials:SupplyOriginPlaceholder")} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reorderLevel"
          label={t("Materials:SupplyReorderLabel")}
          tooltip={t("Materials:SupplyReorderTooltip")}
          rules={[{ type: "number", min: 0, message: t("Materials:SupplyNotNegative") }]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

