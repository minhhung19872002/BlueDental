import { useEffect, useMemo, useState } from "react";
import { Form, Modal } from "antd";
import { X } from "lucide-react";
import { EMPTY_TOOTH_VALUE, toothSelectionsToValue, type ToothPickerValue } from "@/components/ToothChart";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { PatientDiagnosisDto } from "../api/consultingApi";
import { ToothPickerDialog } from "./plan/ToothPickerDialog";
import { AdviseHeaderFields } from "./advise/AdviseHeaderFields";
import { AdviseServiceTable } from "./advise/AdviseServiceTable";
import { AdviseSummaryFooter } from "./advise/AdviseSummaryFooter";
import { matchesSearch, type AdviseHeaderValues } from "./advise/adviseTypes";
import { useAdviseSelection } from "./advise/useAdviseSelection";
import { useCreateAdvises } from "./advise/useCreateAdvises";
import "./plan/treatment-plan.css";
import "./advise/advise-modal.css";

interface AdviseModalProps {
  open: boolean;
  patientId: string;
  /** The diagnosis this advise answers — an advise always hangs off one. */
  diagnosis: PatientDiagnosisDto | null;
  onClose: () => void;
  onCreated?: () => void;
}

/**
 * "Chọn Dịch Vụ" — the dialog behind Tạo dịch vụ on a diagnosis slip. The
 * slip's teeth, doctors and diagnosis come in read-only; the clinician picks
 * who advises, ticks services from the catalogue, prices each, and saves one
 * advise per ticked row. See docs/clone/pages/patient-detail.md.
 */
export function AdviseModal({ open, patientId, diagnosis, onClose, onCreated }: AdviseModalProps) {
  // Held past the close so the dialog keeps its content while it fades out.
  const [shown, setShown] = useState(diagnosis);
  useEffect(() => {
    if (diagnosis) setShown(diagnosis);
  }, [diagnosis]);

  if (!shown) return null;
  return (
    <AdviseDialog
      key={shown.id}
      open={open && diagnosis !== null}
      patientId={patientId}
      diagnosis={shown}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

interface DialogProps extends Omit<AdviseModalProps, "diagnosis"> {
  diagnosis: PatientDiagnosisDto;
}

function AdviseDialog({ open, patientId, diagnosis, onClose, onCreated }: DialogProps) {
  const branchId = useCurrentBranchId();
  const [form] = Form.useForm<AdviseHeaderValues>();
  const search = Form.useWatch("search", form) ?? "";
  const [teeth, setTeeth] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [toothOpen, setToothOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);

  const catalog = useCatalogOptions(CATALOG_GROUP.CareService);
  const groups = useTaxonomyGroupOptions(CATALOG_GROUP.CareService);
  const dentists = useDentistList();
  const selection = useAdviseSelection();
  const { save, saving } = useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose });

  // Every open starts from the slip: its teeth, its doctors as the default
  // consultants, nothing ticked, every group showing.
  useEffect(() => {
    if (!open) return;
    setTeeth(toothSelectionsToValue(diagnosis.teeth));
    setSecondOpen(Boolean(diagnosis.secondStaffId));
    setGroupId(null);
    selection.clear();
    form.setFieldsValue({
      staffId: diagnosis.staffId,
      secondStaffId: diagnosis.secondStaffId ?? undefined,
      diagnoserId: diagnosis.staffId,
      secondDiagnoserId: diagnosis.secondStaffId ?? undefined,
      search: "",
    });
  }, [open, diagnosis, form, selection.clear]);

  // The slip's doctors may not be on the dentist list any more; the disabled
  // fields still have to show their names.
  const staff = useMemo(() => {
    const options = (dentists.data ?? []).map((row) => ({ value: row.id, label: row.name }));
    const known = new Set(options.map((option) => option.value));
    if (diagnosis.staffId && !known.has(diagnosis.staffId)) {
      options.push({ value: diagnosis.staffId, label: diagnosis.staffName ?? "" });
    }
    if (diagnosis.secondStaffId && !known.has(diagnosis.secondStaffId)) {
      options.push({ value: diagnosis.secondStaffId, label: diagnosis.secondStaffName ?? "" });
    }
    return options;
  }, [dentists.data, diagnosis]);

  const services = useMemo(
    () =>
      (catalog.data ?? []).filter(
        (service) =>
          (groupId === null || service.taxonomyId === groupId) && matchesSearch(service.name, search),
      ),
    [catalog.data, groupId, search],
  );

  const handleSecondOpenChange = (next: boolean) => {
    setSecondOpen(next);
    if (!next) form.setFieldValue("secondStaffId", undefined);
  };

  const handleSave = async () => {
    let header: AdviseHeaderValues;
    try {
      header = await form.validateFields();
    } catch {
      return; // the field shows its own message
    }
    await save({ header, teeth, services: catalog.data ?? [], rows: selection.rows });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tp-dialog am-dialog"
      width="min(1240px, calc(100vw - 32px))"
      closeIcon={<X size={20} />}
      destroyOnHidden
      title={
        <span className="am-title">
          {t("Chọn Dịch Vụ")}
          <span className="am-chip">{t("Phiếu: {0}", diagnosis.code)}</span>
        </span>
      }
      footer={
        <AdviseSummaryFooter
          slipCode={diagnosis.code}
          count={selection.rows.size}
          totals={selection.totals}
          saving={saving}
          canSave={selection.rows.size > 0}
          onSave={() => void handleSave()}
        />
      }
    >
      <Form form={form} layout="vertical" className="am-body">
        <AdviseHeaderFields
          diagnosis={diagnosis}
          teeth={teeth}
          staff={staff}
          secondOpen={secondOpen}
          onPickTeeth={() => setToothOpen(true)}
          onSecondOpenChange={handleSecondOpenChange}
        />
        <AdviseServiceTable
          services={services}
          groups={groups.data ?? []}
          loading={catalog.isLoading}
          activeGroupId={groupId}
          selection={selection}
          onGroupChange={setGroupId}
        />
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
