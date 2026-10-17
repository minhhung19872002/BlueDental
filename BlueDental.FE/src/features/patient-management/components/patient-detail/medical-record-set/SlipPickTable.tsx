import { Checkbox, Tooltip } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RecordSetPlanDto } from "../../../api/medicalRecordSetApi";
import { canToggleSlip, formatDate, lockReason, slipPill } from "./recordSetView";

/**
 * The treatment slips to pick a bộ hồ sơ from, one row each: the slip's code
 * and date, its diagnosis and treatment, then either its doctor (the empty
 * screen, which lists only free slips) or its two statuses (the set dialog,
 * which lists every slip and locks the ones that may not move).
 */

interface Props {
  plans: RecordSetPlanDto[];
  selected: ReadonlySet<string>;
  /** "free" names the doctor; "status" shows Trạng thái phiếu and Trạng thái hồ sơ. */
  columns: "free" | "status";
  /** The set being edited, or null for a new one: another set's slips are locked. */
  setId: string | null;
  onToggle: (planId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}

export function SlipPickTable({ plans, selected, columns, setId, onToggle, onToggleAll }: Props) {
  const pickable = plans.filter((plan) => canToggleSlip(plan, setId));
  const pickedCount = pickable.filter((plan) => selected.has(plan.treatmentPlanId)).length;

  return (
    <table className="rs-slips">
      <thead>
        <tr>
          <th className="rs-slips-check">
            <Checkbox
              aria-label={t("Patient:RecordSet:SelectAll")}
              disabled={pickable.length === 0}
              checked={pickable.length > 0 && pickedCount === pickable.length}
              indeterminate={pickedCount > 0 && pickedCount < pickable.length}
              onChange={(event) => onToggleAll(event.target.checked)}
            />
          </th>
          <th>{t("Patient:RecordSet:ColSlip")}</th>
          <th>{t("Patient:RecordSet:ColDiagnosis")}</th>
          <th>{t("Patient:RecordSet:ColTreatment")}</th>
          {columns === "free" ? (
            <th>{t("Patient:RecordSet:ColDoctor")}</th>
          ) : (
            <>
              <th>{t("Patient:RecordSet:ColSlipStatus")}</th>
              <th>{t("Patient:RecordSet:ColSetStatus")}</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {plans.map((plan) => (
          <SlipRow
            key={plan.treatmentPlanId}
            plan={plan}
            checked={selected.has(plan.treatmentPlanId)}
            columns={columns}
            setId={setId}
            onToggle={onToggle}
          />
        ))}
      </tbody>
    </table>
  );
}

interface RowProps {
  plan: RecordSetPlanDto;
  checked: boolean;
  columns: Props["columns"];
  setId: string | null;
  onToggle: Props["onToggle"];
}

function SlipRow({ plan, checked, columns, setId, onToggle }: RowProps) {
  const enabled = canToggleSlip(plan, setId);
  const pill = slipPill(plan);

  return (
    <tr
      className={["rs-slip", checked && "rs-slip--checked", !enabled && "rs-slip--locked"]
        .filter(Boolean)
        .join(" ")}
    >
      <td className="rs-slips-check">
        <Checkbox
          aria-label={plan.planCode}
          checked={checked}
          disabled={!enabled}
          onChange={(event) => onToggle(plan.treatmentPlanId, event.target.checked)}
        />
      </td>
      <td>
        <span className="rs-slip-code">{plan.planCode}</span>
        <small className="rs-slip-date">{formatDate(plan.creationTime)}</small>
      </td>
      <td className="rs-slip-diagnosis">
        {plan.diagnosisName ?? "—"}
        {plan.diagnosisSlipCode && <small>{plan.diagnosisSlipCode}</small>}
      </td>
      <td className="rs-slip-treatment">{plan.treatmentName ?? "—"}</td>
      {columns === "free" ? (
        <td>{plan.dentistName ?? "—"}</td>
      ) : (
        <>
          <td>
            <span className={`rs-pill rs-pill--${pill.tone}`}>{pill.label}</span>
          </td>
          <td>
            <SetStatusCell plan={plan} lock={enabled ? null : lockReason(plan, setId)} />
          </td>
        </>
      )}
    </tr>
  );
}

/** `lock` is why the slip cannot be ticked, or null when it can. */
function SetStatusCell({ plan, lock }: { plan: RecordSetPlanDto; lock: string | null }) {
  const pill = plan.recordSetId ? (
    <span className="rs-pill rs-pill--held">
      {lock && <LockOutlined aria-hidden="true" />}
      {t("Patient:RecordSet:InSet")}
    </span>
  ) : (
    <span className="rs-pill rs-pill--free">{t("Patient:RecordSet:NotInSet")}</span>
  );

  return (
    <>
      {lock ? <Tooltip title={lock}>{pill}</Tooltip> : pill}
      {plan.recordSetCode && <small className="rs-slip-set">{plan.recordSetCode}</small>}
    </>
  );
}
