import { Button, Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCheckFooter } from "../check/LaboCheckFooter";
import { LaboCheckStartCard } from "../check/LaboCheckStartCard";
import { LaboConclusionBox } from "../check/LaboConclusionBox";
import { LaboReceiveSection } from "../check/LaboReceiveSection";
import { LaboRoundHistoryTable } from "../check/LaboRoundHistoryTable";
import { LaboPassedTeethList, LaboToothCheckList } from "../check/LaboToothCheckList";
import { useLaboCheckForm, type LaboCheckForm } from "../check/useLaboCheckForm";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import { LaboOrderSummaryCard } from "./LaboOrderSummaryCard";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import "../check/labo-check.css";

interface Props {
  patient: LaboWorkflowPatient;
  order: LaboOrderDto;
  onShowOrder: () => void;
  onClose: () => void;
}

/** The Hình ảnh lỗi already saved with past returns, read-only. */
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

/** A. the delivery, then B. — locked behind «Kiểm tra Labo» until the delivery is in — and C. once a tooth is Lỗi. */
function CheckForm({ order, check }: { order: LaboOrderDto; check: LaboCheckForm }) {
  return (
    <Form form={check.form} layout="vertical" className="pd-labo-form pd-labo-check-form" disabled={check.busy}>
      <LaboReceiveSection
        roundNo={check.roundNo}
        orderedQuantity={order.quantity}
        receiverName={check.receiverName}
        editable={check.editable}
      />
      {check.started ? (
        <LaboToothCheckList order={order} check={check} />
      ) : (
        <LaboCheckStartCard
          toothCount={check.teeth.length}
          editable={check.editable}
          busy={check.busy}
          onStart={() => void check.start()}
        />
      )}
      {check.started && check.verdict === "return" && <LaboConclusionBox returnNo={order.returnCount + 1} />}
    </Form>
  );
}

/**
 * Tab 2 "Nhận hàng & kiểm tra" (P2910_03, P3110 REQ-D): the order at a glance,
 * A. the delivery, B. a result per tooth with each Lỗi tooth's own
 * conclusion, C. the return dates, and the history by tooth. Without the
 * right, or once the order has left the check, only the summary and the
 * history remain — with B. read-only once every tooth has passed.
 */
export function LaboCheckStep({ patient, order, onShowOrder, onClose }: Props) {
  const check = useLaboCheckForm(order, onClose);
  const summary = <LaboOrderSummaryCard order={order} patient={patient} onShowOrder={onShowOrder} />;

  if (!check.editable) {
    return (
      <>
        {summary}
        <LaboPassedTeethList order={order} />
        <LaboRoundHistoryTable order={order} live={null} />
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
      {summary}
      <CheckForm order={order} check={check} />
      <LaboRoundHistoryTable order={order} live={check.live} />
      <SavedCheckPictures order={order} />
      <LaboCheckFooter order={order} check={check} onClose={onClose} />
    </>
  );
}
