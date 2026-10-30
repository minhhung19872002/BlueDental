import { Button, Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCheckFooter } from "../check/LaboCheckFooter";
import { LaboConclusionBox } from "../check/LaboConclusionBox";
import { LaboReceiveSection } from "../check/LaboReceiveSection";
import { LaboRoundHistoryTable } from "../check/LaboRoundHistoryTable";
import { LaboToothCheckList } from "../check/LaboToothCheckList";
import { passedTeeth } from "../check/laboCheckRules";
import { useLaboCheckForm } from "../check/useLaboCheckForm";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import { LaboOrderIdentity } from "./LaboOrderIdentity";
import { LaboOrderSummaryCard } from "./LaboOrderSummaryCard";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import "../check/labo-check.css";

interface Props {
  patient: LaboWorkflowPatient;
  order: LaboOrderDto;
  onShowOrder: () => void;
  onClose: () => void;
}

/** The Ảnh kiểm tra already saved with past rounds, read-only. */
function SavedCheckPictures({ order }: { order: LaboOrderDto }) {
  const tiles = order.images
    .filter((image) => image.roundNo != null)
    .map((image) => ({ key: image.id, url: image.url, name: image.fileName }));
  if (tiles.length === 0) return null;
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <h3>{t("Labo:Check:PicturesTitle")}</h3>
      </header>
      <LaboPictureWell tiles={tiles} busy={false} readOnly />
    </section>
  );
}

/**
 * Tab 2 "Nhận hàng & kiểm tra" (P2910_03): the order and patient, locked,
 * the order at a glance, A. the delivery, B. a result per tooth, the return
 * box once a tooth is Lỗi, and the history of every delivery and return.
 * Without the right, or once the order has left the check, only the order,
 * the summary and the history remain.
 */
export function LaboCheckStep({ patient, order, onShowOrder, onClose }: Props) {
  const check = useLaboCheckForm(order, onClose);
  const identity = <LaboOrderIdentity orderCode={order.orderCode} patient={patient} />;

  if (!check.editable) {
    return (
      <>
        {identity}
        <LaboOrderSummaryCard order={order} onShowOrder={onShowOrder} />
        <LaboRoundHistoryTable rounds={order.rounds} />
        <SavedCheckPictures order={order} />
        <div className="pd-labo-footer pd-labo-step-footer">
          <div className="pd-labo-footer-actions">
            <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {identity}
      <LaboOrderSummaryCard order={order} onShowOrder={onShowOrder} />
      <Form form={check.form} layout="vertical" className="pd-labo-form pd-labo-check-form" disabled={check.busy}>
        <LaboReceiveSection
          roundNo={check.roundNo}
          orderedQuantity={order.quantity}
          receiverName={check.receiverName}
          editable
          busy={check.busy}
          onSave={() => void check.saveReceive()}
        />
        <LaboToothCheckList teeth={check.teeth} passed={passedTeeth(order)} editable />
        {check.verdict === "return" && (
          <LaboConclusionBox returnNo={check.returnNo} pictures={check.pictures} busy={check.busy} />
        )}
      </Form>
      <LaboRoundHistoryTable rounds={order.rounds} />
      <SavedCheckPictures order={order} />
      <LaboCheckFooter
        order={order}
        editable
        busy={check.busy}
        verdict={check.verdict}
        returnNo={check.returnNo}
        onConclude={(conclusion) => void check.conclude(conclusion)}
        onClose={onClose}
      />
    </>
  );
}
