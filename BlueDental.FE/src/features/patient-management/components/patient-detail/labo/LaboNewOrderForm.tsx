import { Button, Form } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useCreateLaboOrder, useNextLaboCode } from "@/hooks/useLaboPickers";
import { LaboMaterialStrips } from "./LaboChipStrips";
import { LaboOrderFields } from "./LaboOrderFields";
import { LaboNewOrderHeader } from "./LaboNewOrderHeader";
import type { LaboSourceLists } from "./LaboSourcePickers";
import { sourceFromPick, type LaboOrderSource } from "./laboOrderSource";
import { laboOrderBody, useLaboOrderForm, type LaboOrderValues } from "./useLaboOrderForm";

interface Props {
  open: boolean;
  branchId: string;
  patient: { id: string; code: string; name: string };
  /** Raised from a công đoạn: the line is known. Omitted from the tab. */
  source?: LaboOrderSource | null;
  /** From the tab: the plans and doctors the header lets you pick from. */
  lists?: LaboSourceLists;
  onSaved: () => void;
}

/**
 * "Đặt mới" — the body of the Labo order the reference raises either from a
 * công đoạn's Tạo Labo or from the Labo tab's own dialog. The same form serves
 * both; only the header's source fields differ (see LaboNewOrderHeader). The
 * rules sit on the fields, so an empty Lưu paints each one red as the
 * reference does instead of raising a toast.
 */
export function LaboNewOrderForm({ open, branchId, patient, source, lists, onSaved }: Props) {
  const create = useCreateLaboOrder();
  const [antForm] = Form.useForm<LaboOrderValues>();
  // The server hands the code out; the reference shows it locked.
  const code = useNextLaboCode(open).data ?? "";
  const planId = Form.useWatch("planId", antForm);
  const lineId = Form.useWatch("lineId", antForm);
  const dentistId = Form.useWatch("dentistId", antForm);
  const picked = lists ? sourceFromPick(lists.plans, planId, lineId, dentistId) : (source ?? null);

  // From the tab nothing is known yet, and Số lượng reads 0 until a line is picked.
  const form = useLaboOrderForm(
    antForm,
    branchId,
    open,
    lists ? { teeth: [], quantity: "0" } : { teeth: source?.teeth ?? [] },
    lists ? "tab" : (source?.treatmentStageId ?? source?.treatmentServiceId ?? "none"),
  );

  const submit = async () => {
    if (!picked) return;
    const values = antForm.getFieldsValue(true) as LaboOrderValues;
    try {
      await create.mutateAsync({
        ...laboOrderBody(values, form.options.suppliers),
        patientId: patient.id,
        branchId,
        dentistId: picked.dentistId,
        orderCode: code.trim() || undefined,
        estimatedCost: 0,
        treatmentServiceId: picked.treatmentServiceId,
        treatmentStageId: picked.treatmentStageId,
        // Filed into Hình ảnh under the line's plan (and công đoạn) by the server.
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
      <LaboNewOrderHeader patient={patient} source={picked} lists={lists} code={code} form={form} />
      <LaboMaterialStrips form={form} />
      <LaboOrderFields
        form={form}
        emptyTeeth={
          lists ? (
            // From the tab the teeth wait on the line, and the reference says so in plain text.
            <span className="pd-labo-teeth-hint">{t("Chọn dịch vụ điều trị trước")}</span>
          ) : (
            <span className="pd-labo-emptypill">{t("(Trống)")}</span>
          )
        }
      />
      <div className="pd-labo-footer">
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={create.isPending}>
          {t("Lưu")}
        </Button>
      </div>
    </Form>
  );
}
