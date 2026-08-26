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
        toast.success(t("Đã cập nhật vật tư"));
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
        toast.success(t("Đã thêm vật tư"));
      }

      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("Sửa vật tư {0}", supply.itemCode) : t("Thêm vật tư")}
      okText={isEdit ? t("Lưu") : t("Thêm")}
      cancelText={t("Huỷ")}
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
              label={t("Mã vật tư")}
              rules={[{ required: true, message: t("Vui lòng nhập mã") }]}
            >
              {/* The code is the branch-unique key, so it is fixed after creation. */}
              <Input disabled={isEdit} placeholder="VT001" />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item
              name="name"
              label={t("Tên vật liệu")}
              rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
            >
              <Input placeholder={t("Găng tay y tế")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="taxonomyId" label={t("Nhóm phân loại")}>
              <Select
                allowClear
                placeholder={groups.length === 0 ? t("Chưa có nhóm vật tư") : t("Chọn nhóm")}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="unit" label={t("Đơn vị")}>
              <Input placeholder={t("Hộp / cái")} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="unitCost" label={t("Giá nhập (đ)")}>
              <CurrencyInput />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="salePrice" label={t("Giá bán (đ)")}>
              <CurrencyInput />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="supplier" label={t("Nhà cung cấp")}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="origin" label={t("Xuất xứ")}>
              <Input placeholder={t("Việt Nam")} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reorderLevel"
          label={t("Mức tồn tối thiểu")}
          tooltip={t("Dưới mức này, vật tư hiển thị trạng thái Sắp hết")}
          rules={[{ type: "number", min: 0, message: t("Không được âm") }]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
