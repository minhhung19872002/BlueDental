import { useEffect, useMemo, useState } from "react";
import { Form, Modal } from "antd";
import { X } from "lucide-react";
import { EMPTY_TOOTH_VALUE, toothSelectionsToValue, type ToothPickerValue } from "@/components/ToothChart";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { PatientDiagnosisDto } from "../api/consultingApi";
import { ToothPickerDialog } from "./plan/ToothPickerDialog";
import { AdviseComboGrid } from "./advise/AdviseComboGrid";
import { AdviseComboNotice } from "./advise/AdviseComboNotice";
import { AdviseGroupPicker } from "./advise/AdviseGroupPicker";
import { AdviseHeaderFields } from "./advise/AdviseHeaderFields";
import { AdvisePickerHead } from "./advise/AdvisePickerHead";
import { AdviseServiceTable } from "./advise/AdviseServiceTable";
import { AdviseSummaryFooter, type AdviseSummaryItem } from "./advise/AdviseSummaryFooter";
import type { AdviseHeaderValues } from "./advise/adviseTypes";
import { summaryItemsOf, useAdviseCombos } from "./advise/useAdviseCombos";
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
  const allStaff = useStaffOptions();
  const selection = useAdviseSelection();
  const combos = useAdviseCombos(open, selection);
  const { save, saving } = useCreateAdvises({ patientId, branchId, diagnosis, onCreated, onClose });

  // Every open starts from the slip: its teeth, its doctors as the default
  // consultants, nothing ticked, every group showing.
  useEffect(() => {
    if (!open) return;
    setTeeth(toothSelectionsToValue(diagnosis.teeth));
    setSecondOpen(Boolean(diagnosis.secondStaffId));
    catalog.reset();
    combos.reset();
    selection.clear();
    form.setFieldsValue({
      staffId: diagnosis.staffId,
      secondStaffId: diagnosis.secondStaffId ?? undefined,
    });
  }, [open, diagnosis, form, selection.clear, catalog.reset, combos.reset]);

  const staff = useMemo(() => {
    const options = [...(allStaff.data ?? [])];
    const known = new Set(options.map((option) => option.value));
    if (diagnosis.staffId && !known.has(diagnosis.staffId)) {
      options.push({ value: diagnosis.staffId, label: diagnosis.staffName ?? "" });
    }
    if (diagnosis.secondStaffId && !known.has(diagnosis.secondStaffId)) {
      options.push({ value: diagnosis.secondStaffId, label: diagnosis.secondStaffName ?? "" });
    }
    return options;
  }, [allStaff.data, diagnosis]);

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
    await save({ header, teeth, rows: selection.rows, combos: selection.combos });
  };

  const items = summaryItemsOf(selection);
  const handleRemove = (item: AdviseSummaryItem) => {
    if (item.kind === "combo") {
      const combo = selection.combos.get(item.id);
      if (combo) selection.toggleCombo(combo, false);
      return;
    }
    const row = selection.rows.get(item.id);
    if (row) selection.toggle(row.service, false);
  };

  const pickerHead = (
    <AdvisePickerHead
      kind={combos.kind}
      singleCount={catalog.servicesTotal}
      comboCount={combos.total}
      search={combos.kind === "combo" ? combos.search : catalog.search}
      onKindChange={combos.setKind}
      onSearchChange={combos.kind === "combo" ? combos.setSearch : catalog.setSearch}
    />
  );
  const notice = combos.suggestion ? (
    <AdviseComboNotice suggestion={combos.suggestion} onApply={() => combos.setKind("combo")} />
  ) : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tp-dialog am-dialog"
      width="min(1760px, calc(100vw - 32px))"
      centered
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
          items={items}
          totals={selection.totals}
          saving={saving}
          canSave={items.length > 0}
          onRemove={handleRemove}
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
        {combos.kind === "combo" ? (
          <div className="am-services">
            <div className="am-picker">
              {pickerHead}
              {notice}
            </div>
            <AdviseComboGrid
              combos={combos.combos}
              loading={combos.loading}
              picked={selection.combos}
              onToggle={selection.toggleCombo}
            />
          </div>
        ) : (
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
                head={pickerHead}
                notice={notice}
                loading={catalog.groupsLoading}
                loadingMore={catalog.groupsLoadingMore}
                onGroupChange={catalog.setGroupId}
                onNearEnd={catalog.loadMoreGroups}
              />
            }
          />
        )}
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
