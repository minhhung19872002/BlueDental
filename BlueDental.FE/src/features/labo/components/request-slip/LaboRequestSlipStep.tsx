import { useNavigate } from "react-router-dom";
import { withBranch } from "@/lib/clinicBranch";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboPrintButton } from "../order-dialogs/LaboPrintButton";
import { LaboCancelOrderButton } from "../workflow/LaboCancelOrderButton";
import { answerExtra, hasLayout } from "./extraFormModel";
import { LegacySlipLayout } from "./LegacySlipLayout";
import { RequestSlipFooter } from "./RequestSlipFooter";
import type { RequestSlipStart } from "./requestSlipModel";
import { SlipBlockLayout } from "./SlipBlockLayout";
import { SlipTemplatePicker } from "./SlipTemplatePicker";
import { useRequestSlipStep } from "./useRequestSlipStep";
import { useSlipParts } from "./useSlipParts";
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

/**
 * Tab Đặt hàng as the Labo's own Phiếu yêu cầu (F-91). With a Mẫu phiếu
 * picked at the top (F-94) the sheet follows the template's layout; without
 * one it keeps its fixed form. A sent order shows the same sheet locked, with
 * In phiếu and Hủy phiếu.
 */
export function LaboRequestSlipStep({ branchId, patient, order, start, dentists, readOnly, onClose }: Props) {
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
  const parts = useSlipParts({ branchId, patient, dentists, order, step });
  const extra = values.extra;
  const handleAnswer = (key: string, answer: string[]) => {
    if (extra) change({ extra: answerExtra(extra, key, answer) });
  };

  return (
    <div className="rs-slip">
      <div className="rs-slip-scroll">
        <SlipTemplatePicker
          templates={step.templates}
          extra={extra}
          saved={order?.extraForm}
          editable={editable}
          onChange={(picked) => change({ extra: picked })}
        />
        {hasLayout(extra) ? (
          <SlipBlockLayout parts={parts} extra={extra} editable={editable} onAnswer={handleAnswer} />
        ) : (
          <LegacySlipLayout parts={parts} extra={extra} editable={editable} onAnswer={handleAnswer} />
        )}
      </div>
      <RequestSlipFooter
        summary={parts.summary}
        errors={step.errors}
        editable={editable}
        saving={step.saving}
        extra={
          order && (
            <>
              {!readOnly && <LaboCancelOrderButton order={order} disabled={step.saving} onDone={onClose} />}
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
