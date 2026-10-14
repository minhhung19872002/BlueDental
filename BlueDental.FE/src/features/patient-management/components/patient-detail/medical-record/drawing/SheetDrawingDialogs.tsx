import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { DrawingDialog } from "./DrawingDialog";
import type { SheetDrawing } from "./useSheetDrawing";

interface Props {
  drawing: SheetDrawing;
}

/**
 * What the buttons on a drawing blank open: the pad to draw or edit it, and
 * the question before it is taken off the sheet. Neither saves — the sheet's
 * own "Lưu" does, along with everything else written on it.
 */
export function SheetDrawingDialogs({ drawing }: Props) {
  const { request } = drawing;

  return (
    <>
      {request?.action === "edit" && (
        <DrawingDialog source={request.source} onApply={drawing.apply} onClose={drawing.close} />
      )}
      <ConfirmDeleteDialog
        open={request?.action === "delete"}
        noun={t("Patient:MedRecord:DrawingNoun")}
        question={t("Patient:MedRecord:DeleteDrawingQuestion")}
        note={t("Patient:MedRecord:DeleteDrawingNote")}
        onConfirm={drawing.remove}
        onClose={drawing.close}
      />
    </>
  );
}
