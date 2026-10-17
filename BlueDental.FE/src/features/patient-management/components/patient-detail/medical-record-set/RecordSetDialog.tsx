import { useState } from "react";
import { Button, Checkbox } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { MedicalRecordForm } from "../../../api/medicalRecordApi";
import type {
  RecordSetDto,
  RecordSetInput,
  RecordSetPlanDto,
} from "../../../api/medicalRecordSetApi";
import { MEDICAL_RECORD_FORMS } from "../medicalRecordForms";
import { SlipPickTable } from "./SlipPickTable";
import { canToggleSlip } from "./recordSetView";

/**
 * "Tạo bộ hồ sơ bệnh án mới" and its edit view: which treatment slips the set
 * is opened for, and which of the nine forms its index shows.
 *
 * Mount it with a `key` per opening, once the slips and sets have been read
 * again — its picks are seeded once, from the set being edited or from the
 * slips ticked on the empty screen.
 */

export type RecordSetDialogMode =
  { kind: "create"; preselected: readonly string[] } | { kind: "edit"; set: RecordSetDto };

interface Props {
  mode: RecordSetDialogMode;
  /** "[DH260253] Hồ Thị Thanh Bình". */
  patientLabel: string;
  plans: RecordSetPlanDto[];
  saving: boolean;
  onSubmit: (input: RecordSetInput) => void;
  onClose: () => void;
}

const ALL_FORMS = MEDICAL_RECORD_FORMS.map((spec) => spec.form);

/** A working screen, not a confirmation: as wide as the window allows, up to 1080px. */
export const RECORD_SET_DIALOG_WIDTH = "min(1080px, calc(100vw - 32px))";

function initialSlips(mode: RecordSetDialogMode): Set<string> {
  return new Set(
    mode.kind === "edit" ? mode.set.plans.map((plan) => plan.treatmentPlanId) : mode.preselected,
  );
}

function initialForms(mode: RecordSetDialogMode): Set<MedicalRecordForm> {
  return new Set(mode.kind === "edit" ? mode.set.visibleForms : ALL_FORMS);
}

export function RecordSetDialog({ mode, patientLabel, plans, saving, onSubmit, onClose }: Props) {
  const [slips, setSlips] = useState(() => initialSlips(mode));
  const [forms, setForms] = useState(() => initialForms(mode));
  /** The set being edited; null while a new one is made. */
  const setId = mode.kind === "edit" ? mode.set.id : null;

  const toggleSlip = (planId: string, checked: boolean) =>
    setSlips((current) => {
      const next = new Set(current);
      if (checked) next.add(planId);
      else next.delete(planId);
      return next;
    });

  /** Ticks or clears every slip that may be; a locked one keeps its state. */
  const toggleAllSlips = (checked: boolean) =>
    setSlips((current) => {
      const next = new Set(current);
      for (const plan of plans.filter((item) => canToggleSlip(item, setId))) {
        if (checked) next.add(plan.treatmentPlanId);
        else next.delete(plan.treatmentPlanId);
      }
      return next;
    });

  const toggleForm = (form: MedicalRecordForm, checked: boolean) =>
    setForms((current) => {
      const next = new Set(current);
      if (checked) next.add(form);
      else next.delete(form);
      return next;
    });

  const handleSubmit = () =>
    onSubmit({
      treatmentPlanIds: [...slips],
      visibleForms: ALL_FORMS.filter((form) => forms.has(form)),
    });

  const creating = mode.kind === "create";

  return (
    <AppDialog
      open
      title={
        creating
          ? t("Patient:RecordSet:DialogNew")
          : t("Patient:RecordSet:DialogEdit", mode.set.code)
      }
      subtitle={patientLabel}
      width={RECORD_SET_DIALOG_WIDTH}
      className="rs-dialog"
      canSave={slips.size > 0 && forms.size > 0}
      saving={saving}
      saveLabel={creating ? t("Patient:RecordSet:Submit") : undefined}
      savingLabel={creating ? t("Patient:RecordSet:Submitting") : undefined}
      saveIcon={null}
      cancelLabel={t("Patient:Misc:CancelVN")}
      footerLeft={
        slips.size === 0 ? (
          <span className="rs-dialog-summary rs-dialog-summary--warn">
            {t("Patient:RecordSet:NeedsSlip")}
          </span>
        ) : (
          <span className="rs-dialog-summary">
            {t("Patient:RecordSet:Footer", slips.size, ALL_FORMS.length, forms.size)}
          </span>
        )
      }
      onSave={handleSubmit}
      onClose={onClose}
    >
      <section className="rs-dialog-section">
        <header>
          <h3>{t("Patient:RecordSet:Section1")}</h3>
          <span className="rs-count-chip">{t("Patient:RecordSet:PickedCount", slips.size)}</span>
        </header>
        <p className="rs-dialog-hint">{t("Patient:RecordSet:Section1Hint")}</p>
        <div className="rs-slips-wrap">
          <SlipPickTable
            plans={plans}
            selected={slips}
            columns="status"
            setId={setId}
            onToggle={toggleSlip}
            onToggleAll={toggleAllSlips}
          />
        </div>
      </section>

      <section className="rs-dialog-section">
        <header>
          <h3>
            {t("Patient:RecordSet:Section2")}
            <small> · {t("Patient:RecordSet:ShownCount", forms.size, ALL_FORMS.length)}</small>
          </h3>
          <span className="rs-dialog-links">
            <Button type="link" size="small" onClick={() => setForms(new Set(ALL_FORMS))}>
              {t("Patient:RecordSet:SelectAll")}
            </Button>
            <Button type="link" size="small" onClick={() => setForms(new Set())}>
              {t("Patient:RecordSet:ClearAll")}
            </Button>
          </span>
        </header>
        <p className="rs-dialog-hint">{t("Patient:RecordSet:Section2Hint")}</p>
        <div className="rs-forms">
          {MEDICAL_RECORD_FORMS.map((spec) => (
            <Checkbox
              key={spec.form}
              checked={forms.has(spec.form)}
              onChange={(event) => toggleForm(spec.form, event.target.checked)}
            >
              {spec.index}. {spec.label}
            </Checkbox>
          ))}
        </div>
      </section>
    </AppDialog>
  );
}
