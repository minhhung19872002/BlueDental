import type { ReactNode } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCheckDoneFooter, LaboCheckFooter } from "../check/LaboCheckFooter";
import { LaboCheckStartCard } from "../check/LaboCheckStartCard";
import { LaboConclusionBox } from "../check/LaboConclusionBox";
import { LaboReceiveSection } from "../check/LaboReceiveSection";
import { LaboRoundHistoryTable } from "../check/LaboRoundHistoryTable";
import { isPassedToothPicture } from "../check/laboCheckRules";
import { LaboPassedTeethList, LaboToothCheckList } from "../check/LaboToothCheckList";
import { useLaboCheckForm, type LaboCheckForm } from "../check/useLaboCheckForm";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import { LaboOrderSummaryCard } from "./LaboOrderSummaryCard";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import "../check/labo-check.css";

interface Props {
  patient: LaboWorkflowPatient;
  order: LaboOrderDto;
  readOnly: boolean;
  onShowOrder: () => void;
  /** «Tiếp: Bảo hành ›»; unset while that tab is locked. */
  onShowWarranty?: () => void;
  onClose: () => void;
}

/** The Ảnh kiểm tra already saved, read-only: one strip for the Đạt teeth (R-1110), one for the Hình ảnh lỗi. */
function SavedCheckPictures({ order, passed }: { order: LaboOrderDto; passed: boolean }) {
  const tiles = order.images
    .filter((image) => image.roundNo != null && isPassedToothPicture(order, image) === passed)
    .map((image) => ({ key: image.id, url: image.url, name: image.fileName }));
  if (tiles.length === 0) return null;
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <h3>{t(passed ? "Labo:Check:PassedPicturesTitle" : "Labo:Check:PicturesTitle")}</h3>
      </header>
      <LaboPictureWell tiles={tiles} busy={false} readOnly />
    </section>
  );
}

function SavedCheckPictureSets({ order }: { order: LaboOrderDto }) {
  return (
    <>
      <SavedCheckPictures order={order} passed={false} />
      <SavedCheckPictures order={order} passed />
    </>
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

/** Labo 2 mock: the delivery history down the left, the check on the right. */
function CheckColumns({ history, children }: { history: ReactNode; children: ReactNode }) {
  return (
    <div className="pd-labo-flow-main">
      <aside className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--history">{history}</aside>
      <section className="pd-labo-flow-pane pd-labo-flow-pane--main">{children}</section>
    </div>
  );
}

/**
 * Tab 2 "Nhận hàng & kiểm tra" (P2910_03, P3110 REQ-D): the order at a glance,
 * A. the delivery, B. a result per tooth with each Lỗi tooth's own
 * conclusion, C. the return dates, and the history by tooth. Without the
 * right, or once the order has left the check, only the summary and the
 * history remain — with B. read-only once every tooth has passed.
 */
export function LaboCheckStep({ patient, order, readOnly, onShowOrder, onShowWarranty, onClose }: Props) {
  const check = useLaboCheckForm(order, onClose, readOnly);
  const summary = <LaboOrderSummaryCard order={order} patient={patient} onShowOrder={onShowOrder} />;

  if (!check.editable) {
    return (
      <>
        {summary}
        <CheckColumns history={<LaboRoundHistoryTable order={order} live={null} />}>
          <LaboPassedTeethList order={order} />
          <SavedCheckPictureSets order={order} />
        </CheckColumns>
        <LaboCheckDoneFooter order={order} readOnly={readOnly} onShowWarranty={onShowWarranty} onClose={onClose} />
      </>
    );
  }

  return (
    <>
      {summary}
      <CheckColumns history={<LaboRoundHistoryTable order={order} live={check.live} />}>
        <CheckForm order={order} check={check} />
        <SavedCheckPictureSets order={order} />
      </CheckColumns>
      <LaboCheckFooter order={order} check={check} onClose={onClose} />
    </>
  );
}
