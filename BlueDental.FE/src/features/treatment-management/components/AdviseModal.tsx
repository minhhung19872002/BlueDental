import { useEffect, useState } from "react";
import { Form, Modal } from "antd";
import { X } from "lucide-react";
import { EMPTY_TOOTH_VALUE, toothSelectionsToValue, type ToothPickerValue } from "@/components/ToothChart";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { PatientDiagnosisDto } from "../api/consultingApi";
import { ToothPickerDialog } from "./plan/ToothPickerDialog";
import { AdviseHeaderFields } from "./advise/AdviseHeaderFields";
import { AdvisePickerPane } from "./advise/AdvisePickerPane";
import { AdviseSelectedPanel } from "./advise/AdviseSelectedPanel";
import type { AdviseHeaderValues } from "./advise/adviseTypes";
import { useAdviseCombos } from "./advise/useAdviseCombos";
import { useAdviseCatalog } from "./advise/useAdviseCatalog";
import { useAdviseSelection } from "./advise/useAdviseSelection";
import { useAdviseStaff } from "./advise/useAdviseStaff";
import { useCreateAdvises } from "./advise/useCreateAdvises";
import "./plan/treatment-plan.css";
import "./advise/advise-modal.css";

interface AdviseModalProps {
  open: boolean;
  patientId: string;
  /** Printed on the right of the title. */
  patientName: string;
  /** The diagnosis this advise answers — an advise always hangs off one. */
  diagnosis: PatientDiagnosisDto | null;
  onClose: () => void;
  onCreated?: () => void;
}

/**
 * "Chọn dịch vụ" — the dialog behind Tạo dịch vụ on a diagnosis slip, laid
 * out as P0111_02's mockup (R-1114): the slip's teeth, diagnosis and
 * consultants in a strip; the groups on the left, the list in the middle,
 * what is ticked and its totals on the right. One advise is saved per ticked
 * row. See docs/clone/pages/patient-detail.md.
 */
export function AdviseModal({ diagnosis, ...rest }: AdviseModalProps) {
  // Held past the close so the dialog keeps its content while it fades out.
  const [shown, setShown] = useState(diagnosis);
  useEffect(() => {
    if (diagnosis) setShown(diagnosis);
  }, [diagnosis]);

  if (!shown) return null;
  return <AdviseDialog key={shown.id} {...rest} open={rest.open && diagnosis !== null} diagnosis={shown} />;
}

interface DialogProps extends Omit<AdviseModalProps, "diagnosis"> {
  diagnosis: PatientDiagnosisDto;
}

function AdviseDialog({ open, patientId, patientName, diagnosis, onClose, onCreated }: DialogProps) {
  const branchId = useCurrentBranchId();
  const [form] = Form.useForm<AdviseHeaderValues>();
  const [teeth, setTeeth] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [toothOpen, setToothOpen] = useState(false);
  const catalog = useAdviseCatalog(open);
  const staff = useAdviseStaff(diagnosis);
  const selection = useAdviseSelection();
  const combos = useAdviseCombos(open, selection);
  const { save, saving } = useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose });

  // Every open starts from the slip: its teeth, its doctors as the default
  // consultants, nothing ticked, every group showing.
  useEffect(() => {
    if (!open) return;
    setTeeth(toothSelectionsToValue(diagnosis.teeth));
    catalog.reset();
    combos.reset();
    selection.clear();
    form.setFieldsValue({
      staffId: diagnosis.staffId,
      secondStaffId: diagnosis.secondStaffId ?? undefined,
    });
  }, [open, diagnosis, form, selection.clear, catalog.reset, combos.reset]);

  const handleSave = async () => {
    let header: AdviseHeaderValues;
    try {
      header = await form.validateFields();
    } catch {
      return; // the field shows its own message
    }
    await save({ header, teeth, rows: selection.rows, combos: selection.combos });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tp-dialog am-dialog"
      width="min(1600px, calc(100vw - 32px))"
      centered
      closeIcon={<X size={20} />}
      destroyOnHidden
      footer={null}
      title={
        <span className="am-title">
          {t("Treatment:Service:PickService")}
          <span className="am-chip">{t("Treatment:Slip:Code", diagnosis.code)}</span>
          <span className="am-patient">{t("Treatment:Advise:PatientLabel", patientName)}</span>
        </span>
      }
    >
      <Form form={form} layout="vertical" className="am-body">
        <AdviseHeaderFields diagnosis={diagnosis} teeth={teeth} staff={staff} onPickTeeth={() => setToothOpen(true)} />
        <div className="am-layout">
          <AdvisePickerPane catalog={catalog} combos={combos} selection={selection} />
          <AdviseSelectedPanel selection={selection} saving={saving} onCancel={onClose} onSave={() => void handleSave()} />
        </div>
      </Form>
      <ToothPickerDialog
        open={toothOpen}
        value={teeth}
        onConfirm={(value) => {
          setTeeth(value);
          setToothOpen(false);
        }}
        onClose={() => setToothOpen(false)}
      />
    </Modal>
  );
}
