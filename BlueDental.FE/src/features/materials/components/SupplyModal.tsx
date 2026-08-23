import { useEffect } from "react";
import { Col, Form, Input, InputNumber, Modal, Row, Select, message } from "antd";
import { useTranslation } from "react-i18next";
import {
  useCreateSupply,
  useUpdateSupply,
  type SupplyDto,
} from "../api/suppliesApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

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
  const { t } = useTranslation();
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
        message.success(t("supplyModal.updateSuccess"));
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
        message.success(t("supplyModal.createSuccess"));
      }

      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const money = {
    style: { width: "100%" },
    min: 0,
    step: 10000,
    formatter: (v?: number | string) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    parser: (v?: string) => Number((v ?? "").replace(/\./g, "")),
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("supplyModal.editTitle", { code: supply.itemCode }) : t("supplyModal.createTitle")}
      okText={isEdit ? t("supplyModal.okTextEdit") : t("supplyModal.okTextCreate")}
      cancelText={t("supplyModal.cancel")}
      confirmLoading={createSupply.isPending || updateSupply.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              name="itemCode"
              label={t("supplyModal.itemCodeLabel")}
              rules={[{ required: true, message: t("supplyModal.itemCodeRequired") }]}
            >
              {/* The code is the branch-unique key, so it is fixed after creation. */}
              <Input disabled={isEdit} placeholder="VT001" />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item
              name="name"
              label={t("supplyModal.nameLabel")}
              rules={[{ required: true, message: t("supplyModal.nameRequired") }]}
            >
              <Input placeholder="Găng tay y tế" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="taxonomyId" label={t("supplyModal.groupLabel")}>
              <Select
                allowClear
                placeholder={groups.length === 0 ? t("supplyModal.noGroupPlaceholder") : t("supplyModal.selectGroupPlaceholder")}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="unit" label={t("supplyModal.unitLabel")}>
              <Input placeholder={t("supplyModal.unitPlaceholder")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="unitCost" label={t("supplyModal.unitCostLabel")}>
              <InputNumber<number> {...money} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="salePrice" label={t("supplyModal.salePriceLabel")}>
              <InputNumber<number> {...money} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="supplier" label={t("supplyModal.supplierLabel")}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="origin" label={t("supplyModal.originLabel")}>
              <Input placeholder="Việt Nam" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reorderLevel"
          label={t("supplyModal.reorderLevelLabel")}
          tooltip={t("supplyModal.reorderLevelTooltip")}
          rules={[{ type: "number", min: 0, message: t("supplyModal.notNegative") }]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
