import { useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";
import { withBranch } from "@/lib/clinicBranch";
import {
  useLaboFinishLineOptions,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import { laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboPrintButton } from "../order-dialogs/LaboPrintButton";
import { toothLabel } from "../order-dialogs/laboToothSpecs";
import { LaboCancelOrderButton } from "../workflow/LaboCancelOrderButton";
import { FinishLineChecks } from "./FinishLineChecks";
import { RequestNotes } from "./RequestNotes";
import { RequestSlipFooter } from "./RequestSlipFooter";
import { RequestSlipInfo } from "./RequestSlipInfo";
import { RequestToothChart } from "./RequestToothChart";
import { LABO_CASE_TYPE } from "@/features/labo/api/laboApi";
import { chartOrder, type RequestSlipStart, type RequestSlipValues } from "./requestSlipModel";
import { pickedNames, restorationGroups, toggleRestoration } from "./restorationGroups";
import { RestorationList, RestorationTable } from "./RestorationSections";
import { ShadeZoneMap } from "./ShadeZoneMap";
import { useRequestSlipStep } from "./useRequestSlipStep";
import "./request-slip.css";

interface Props {
  branchId: string;
  patient: { id: string; code: string; name: string };
  order: LaboOrderDto | undefined;
  start: RequestSlipStart;
  dentists: PickerOption[];
  readOnly: boolean;
  onClose: () => void;
}

/** "Ca mới · R18, R17 · Sứ Lava +1 · Vai 90°" — the footer's one line. */
function summaryOf(values: RequestSlipValues, names: string[], finishes: string[]): string {
  const teeth = chartOrder(values.teeth);
  return [
    t(values.caseType === LABO_CASE_TYPE.Redo ? "Labo:Slip:CaseRedo" : "Labo:Slip:CaseNew"),
    teeth.length ? teeth.map(toothLabel).join(", ") : t("Labo:Slip:NoTeeth"),
    names.length
      ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "")
      : t("Labo:Slip:NoRestoration"),
    ...(finishes.length ? [finishes.join(", ")] : []),
  ].join(" · ");
}

/**
 * Tab Đặt hàng as the Labo's own Phiếu yêu cầu (F-91): Thông tin phiếu, then
 * Loại phục hình in three columns (BA P1011) — Toàn sứ and Hợp kim, then
 * Phục hình khác trên implant with Màu răng, then Chỉ định (the system's Chọn
 * răng button) with Đường hoàn tất — then Yêu cầu, and the footer.
 * A sent order shows the same sheet locked, with In phiếu and Hủy phiếu.
 */
export function LaboRequestSlipStep({
  branchId,
  patient,
  order,
  start,
  dentists,
  readOnly,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const step = useRequestSlipStep({
    branchId,
    patientId: patient.id,
    order,
    start,
    readOnly,
    onSaved: (submit) => {
      onClose();
      // The new order is shown in the patient's own Labo list (owner, 2026-11-10).
      if (submit) navigate(withBranch(`/patient/${patient.id}?tab=labo`, branchId));
    },
  });
  const { values, change, editable } = step;
  const services = useLaboServiceOptions(branchId).data ?? [];
  const materials = useLaboMaterialOptions(branchId).data ?? [];
  const finishLines = useLaboFinishLineOptions(branchId).data ?? [];

  const groups = restorationGroups(services, materials, values.restorations);
  const names = pickedNames(groups, values.restorations);
  const finishes = finishLines
    .filter((line) => values.finishLineIds.includes(line.value))
    .map((line) => line.label);
  const sectionProps = {
    picked: values.restorations,
    editable,
    onToggle: (pick: RequestSlipValues["restorations"][number]) =>
      change({ restorations: toggleRestoration(values.restorations, pick) }),
  };

  return (
    <div className="rs-slip">
      <div className="rs-slip-scroll">
        <RequestSlipInfo
          branchId={branchId}
          patient={patient}
          dentists={dentists}
          values={values}
          editable={editable}
          onChange={change}
        />
        <div className="rs-heading">
          <span className="rs-heading-title">{t("Labo:Slip:Restoration")}</span>
          <span className="rs-heading-rule" aria-hidden />
          <span className="rs-heading-picked">
            {t("Labo:Slip:Picked")}{" "}
            <b>{names.length ? names.join(", ") : t("Labo:Slip:NotPickedLower")}</b>
          </span>
        </div>
        <div className="rs-main">
          <div className="rs-col">
            {groups
              .filter((group) => group.kind === "pair")
              .map((group) => (
                <RestorationTable key={group.id} group={group} {...sectionProps} />
              ))}
            {groups.length === 0 && <p className="rs-empty">{t("Labo:Slip:NoRestorations")}</p>}
          </div>
          <div className="rs-col">
            {groups
              .filter((group) => group.kind !== "pair")
              .map((group) => (
                <RestorationList key={group.id} group={group} {...sectionProps} />
              ))}
            <ShadeZoneMap
              shade={values.shade}
              editable={editable}
              onChange={(shade) => change({ shade })}
            />
          </div>
          <div className="rs-col">
            <RequestToothChart
              branchId={branchId}
              code={order ? laboOrderNo(order) : ""}
              teeth={values.teeth}
              editable={editable}
              priors={step.priors}
              onChange={(teeth) => change({ teeth })}
            />
            <FinishLineChecks
              options={finishLines}
              value={values.finishLineIds}
              editable={editable}
              onChange={(finishLineIds) => change({ finishLineIds })}
            />
          </div>
        </div>
        <RequestNotes
          notes={values.notes}
          editable={editable}
          pictures={step.pictures}
          busy={step.saving}
          onChange={(notes) => change({ notes })}
        />
      </div>
      <RequestSlipFooter
        summary={summaryOf(values, names, finishes)}
        errors={step.errors}
        editable={editable}
        saving={step.saving}
        extra={
          order && (
            <>
              {!readOnly && (
                <LaboCancelOrderButton order={order} disabled={step.saving} onDone={onClose} />
              )}
              {!editable && (
                <LaboPrintButton
                  order={order}
                  branchId={branchId}
                  patient={{ ...patient, dateOfBirth: order.patientDateOfBirth ?? null }}
                />
              )}
            </>
          )
        }
        onClose={onClose}
        onSaveDraft={step.saveDraft}
        onSubmit={step.submit}
      />
    </div>
  );
}
