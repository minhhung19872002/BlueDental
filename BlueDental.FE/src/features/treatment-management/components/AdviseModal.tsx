import { useEffect, useMemo, useState } from "react";
import { Form, Modal } from "antd";
import { X } from "lucide-react";
import { EMPTY_TOOTH_VALUE, toothSelectionsToValue, type ToothPickerValue } from "@/components/ToothChart";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { PatientDiagnosisDto } from "../api/consultingApi";
import { ToothPickerDialog } from "./plan/ToothPickerDialog";
import { AdviseGroupPicker } from "./advise/AdviseGroupPicker";
import { AdviseHeaderFields } from "./advise/AdviseHeaderFields";
import { AdviseServiceTable } from "./advise/AdviseServiceTable";
import { AdviseSummaryFooter } from "./advise/AdviseSummaryFooter";
import type { AdviseHeaderValues } from "./advise/adviseTypes";
import { useAdviseCatalog } from "./advise/useAdviseCatalog";
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
  const [teeth, setTeeth] = useState<ToothPickerValue>(EMPTY_TOOTH_VALUE);
  const [toothOpen, setToothOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const catalog = useAdviseCatalog(open);
  const dentists = useDentistList();
  const selection = useAdviseSelection();
  const { save, saving } = useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose });

  // Every open starts from the slip: its teeth, its doctors as the default
  // consultants, nothing ticked, every group showing.
  useEffect(() => {
    if (!open) return;
    setTeeth(toothSelectionsToValue(diagnosis.teeth));
    setSecondOpen(Boolean(diagnosis.secondStaffId));
    catalog.reset();
    selection.clear();
    form.setFieldsValue({
      staffId: diagnosis.staffId,
      secondStaffId: diagnosis.secondStaffId ?? undefined,
      diagnoserId: diagnosis.staffId,
      secondDiagnoserId: diagnosis.secondStaffId ?? undefined,
    });
  }, [open, diagnosis, form, selection.clear, catalog.reset]);

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
    await save({ header, teeth, rows: selection.rows });
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
          {t("Treatment:Service:PickService")}
          <span className="am-chip">{t("Treatment:Slip:Code", diagnosis.code)}</span>
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
          services={catalog.services}
          loading={catalog.servicesLoading}
          loadingMore={catalog.servicesLoadingMore}
          hasMore={catalog.hasMoreServices}
          selection={selection}
          onLoadMore={catalog.loadMoreServices}
          picker={
            <AdviseGroupPicker
              groups={catalog.groups}
              activeGroupId={catalog.groupId}
              search={catalog.search}
              loading={catalog.groupsLoading}
              loadingMore={catalog.groupsLoadingMore}
              onGroupChange={catalog.setGroupId}
              onSearchChange={catalog.setSearch}
              onNearEnd={catalog.loadMoreGroups}
            />
          }
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
