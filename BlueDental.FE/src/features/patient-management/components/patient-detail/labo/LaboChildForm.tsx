import { useEffect, useState } from "react";
import { Button, Form } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useCreateLaboOrder } from "@/hooks/useLaboPickers";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { LaboChildHeader } from "./LaboChildHeader";
import { LaboMaterialChoice, type MaterialMode } from "./LaboMaterialChoice";
import { LaboOrderFields } from "./LaboOrderFields";
import { LABO_CHILD_KIND, type LaboChildKind } from "./laboModalKeys";
import {
  laboOrderBody,
  useLaboOrderForm,
  type LaboOrderSeed,
  type LaboOrderValues,
} from "./useLaboOrderForm";

interface Props {
  open: boolean;
  kind: LaboChildKind;
  branchId: string;
  patient: { id: string; code: string; name: string };
  orders: LaboOrderDto[];
  parentId: string | undefined;
  onPickParent: (id: string | undefined) => void;
  onSaved: () => void;
}

/** The child opens filled from the parent: same teeth, doctor, shade, notes, supplier and options. */
function seedFromParent(parent: LaboOrderDto | undefined): LaboOrderSeed {
  if (!parent) return { teeth: [] };
  const teeth = parent.toothNumbers
    ? parent.toothNumbers.split(",").map((tooth) => tooth.trim())
    : [];
  return {
    teeth,
    dentistId: parent.dentistId,
    supplierId: parent.supplierId,
    biteId: parent.biteId,
    finishLineId: parent.finishLineId,
    rhythmId: parent.rhythmId,
    shade: parent.toothShade ?? "",
    notes: parent.notes ?? "",
    quantity: String(parent.quantity || teeth.length || 1),
  };
}

/**
 * Làm tiếp công đoạn / Bảo hành: pick one of the patient's orders, then the
 * same fields as Đặt mới, prefilled from it. "Theo vật liệu cũ" keeps the
 * parent's material; "Thay đổi vật liệu mới" opens the chip strips, and only
 * then do their rules take part in Lưu.
 */
export function LaboChildForm({
  open,
  kind,
  branchId,
  patient,
  orders,
  parentId,
  onPickParent,
  onSaved,
}: Props) {
  const create = useCreateLaboOrder();
  const dentists = useDentistList();
  const [antForm] = Form.useForm<LaboOrderValues>();
  const parent = orders.find((order) => order.id === parentId);
  const form = useLaboOrderForm(
    antForm,
    branchId,
    open,
    seedFromParent(parent),
    `${kind}:${parent?.id ?? "none"}`,
  );
  const [mode, setMode] = useState<MaterialMode>("old");
  useEffect(() => setMode("old"), [parent?.id]);

  const submit = async () => {
    if (!parent) return;
    const values = antForm.getFieldsValue(true) as LaboOrderValues;
    try {
      await create.mutateAsync({
        ...laboOrderBody(values, form.options.suppliers),
        // Under "Theo vật liệu cũ" the server copies the parent's material.
        materialId: mode === "new" ? values.materialId : undefined,
        patientId: patient.id,
        branchId,
        kind: LABO_CHILD_KIND[kind],
        parentOrderId: parent.id,
        dentistId: values.dentistId,
        orderCode: parent.orderCode,
        estimatedCost: 0,
        treatmentServiceId: parent.treatmentServiceId,
        treatmentStageId: parent.treatmentStageId,
        // They follow the parent's plan and công đoạn into Hình ảnh, server-side.
        pictures: form.pictures,
      });
      toast.success(t("Đã tạo phiếu Labo"));
      onSaved();
    } catch {
      // The global MutationCache already toasts the server's message; the
      // dialog only has to stay open so the fix can be made in place.
    }
  };

  return (
    <Form
      form={antForm}
      layout="vertical"
      className="pd-labo-form"
      onFinish={() => void submit()}
      scrollToFirstError
    >
      <div className="pd-labo-order-select">
        <FloatingLabel label={t("Phiếu dịch vụ Labo")} required floated={Boolean(parentId)}>
          <SearchSelect
            value={parentId}
            options={orders.map((order) => ({ value: order.id, label: `#${order.orderCode}` }))}
            emptyText={t("Chưa có phiếu Labo")}
            onChange={onPickParent}
          />
        </FloatingLabel>
      </div>

      {parent && (
        <>
          <LaboChildHeader
            kind={kind}
            patient={patient}
            parent={parent}
            dentists={(dentists.data ?? []).map((staff) => ({
              value: staff.id,
              label: staff.fullName,
            }))}
            form={form}
          />
          <LaboMaterialChoice parent={parent} mode={mode} onMode={setMode} form={form} />
          <LaboOrderFields
            form={form}
            emptyTeeth={<span className="pd-labo-emptypill">{t("(Trống)")}</span>}
          />
        </>
      )}

      <div className="pd-labo-footer">
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          disabled={!parent}
          loading={create.isPending}
        >
          {t("Lưu")}
        </Button>
      </div>
    </Form>
  );
}
