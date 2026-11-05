import { Button } from "antd";
import { CheckCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_CHECK_CONCLUSION, LABO_STATUS, LABO_TOOTH_RESULT, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCancelOrderButton } from "../workflow/LaboCancelOrderButton";
import { pickOf, undescribedTeeth } from "./laboCheckRules";
import type { LaboCheckForm } from "./useLaboCheckForm";

interface Props {
  order: LaboOrderDto;
  check: LaboCheckForm;
  onClose: () => void;
}

/**
 * Left of the buttons (Labo 2 v2 mock, R-1151): what is still missing — teeth
 * without a result, then Lỗi teeth without Mô tả gửi Labo — in amber, else
 * where the order goes next.
 */
function footerHint(check: LaboCheckForm): { text: string; warn: boolean } {
  const numbers = check.teeth.map((tooth) => tooth.toothNumber);
  const pending = numbers.filter((tooth) => pickOf(check.picks, tooth) == null).length;
  if (pending > 0) return { text: t("Labo:Check:FooterPending", pending), warn: true };
  const undescribed = undescribedTeeth(numbers, check.picks).length;
  if (undescribed > 0) return { text: t("Labo:Check:FooterUndescribed", undescribed), warn: true };
  return { text: t(check.verdict === "return" ? "Labo:Check:FooterReturn" : "Labo:Check:FooterPass"), warn: false };
}

function FooterHint({ hint }: { hint: { text: string; warn: boolean } }) {
  const className = ["pd-labo-footer-hint", hint.warn && "pd-labo-footer-hint--warn"].filter(Boolean).join(" ");
  return <span className={className}>{hint.text}</span>;
}

/**
 * The Trả buttons: both while some teeth pass (REQ-D11), only Trả toàn bộ once
 * every tooth is Lỗi (m278) — or, greyed, while some are unpicked (Labo 2 v2).
 */
function ReturnButtons({ order, check }: Omit<Props, "onClose">) {
  const ready = check.verdict === "return";
  const allFailed = check.failed.length === order.teeth.length;
  const returnAll = (
    <Button
      danger
      type={allFailed ? "primary" : "default"}
      icon={<RollbackOutlined />}
      loading={check.busy}
      disabled={check.busy || !ready}
      onClick={() => void check.conclude(LABO_CHECK_CONCLUSION.ReturnAll)}
    >
      {t("Labo:Check:ReturnAllCount", order.teeth.length)}
    </Button>
  );
  if (allFailed || check.verdict === "incomplete") return returnAll;
  return (
    <>
      {returnAll}
      <Button
        type="primary"
        className="pd-labo-btn-purple"
        icon={<RollbackOutlined />}
        loading={check.busy}
        disabled={check.busy || !ready}
        onClick={() => void check.conclude(LABO_CHECK_CONCLUSION.ReturnDefective)}
      >
        {t("Labo:Check:ReturnDefectiveCount", check.failed.length)}
      </Button>
    </>
  );
}

/** «Xác nhận đạt (n răng)», n the teeth Đạt so far; live once every one is (Labo 2 v2 mock, R-1151). */
function ConfirmPassButton({ check }: { check: LaboCheckForm }) {
  const ready = check.verdict === "pass";
  const passed = check.teeth.filter((tooth) => pickOf(check.picks, tooth.toothNumber) === LABO_TOOTH_RESULT.Passed);
  return (
    <Button
      type="primary"
      className="pd-labo-btn-purple"
      icon={<CheckCircleOutlined />}
      loading={check.busy}
      disabled={check.busy || !ready}
      onClick={() => void check.conclude(LABO_CHECK_CONCLUSION.Pass)}
    >
      {t("Labo:Check:ConfirmPassedCount", passed.length)}
    </Button>
  );
}

/**
 * Huỷ · Huỷ phiếu, then the conclusion the results allow (P3110 m238, m278,
 * m342): every tooth Đạt → Xác nhận đạt; any Lỗi → the Trả buttons; some
 * unpicked → Trả toàn bộ and Xác nhận đạt, both greyed (Labo 2 v2).
 * Before «Kiểm tra Labo» there is nothing to conclude (m279).
 */
export function LaboCheckFooter({ order, check, onClose }: Props) {
  const concluding = check.editable && check.started;
  return (
    <div className="pd-labo-footer pd-labo-step-footer">
      {concluding && <FooterHint hint={footerHint(check)} />}
      <div className="pd-labo-footer-actions">
        <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
        <LaboCancelOrderButton order={order} disabled={check.busy} onDone={onClose} />
        {concluding && check.verdict !== "pass" && <ReturnButtons order={order} check={check} />}
        {concluding && check.verdict !== "return" && <ConfirmPassButton check={check} />}
      </div>
    </div>
  );
}

/** "Tất cả răng đã đạt…" once every tooth passed; "Còn n răng chờ Labo giao lại" while some are at the Labo. */
function doneHint(order: LaboOrderDto): string | null {
  const waiting = order.teeth.filter((tooth) => tooth.checkResult !== LABO_TOOTH_RESULT.Passed).length;
  if (order.teeth.length > 0 && waiting === 0) return t("Labo:Check:FooterAllPassed");
  return AT_LABO.has(order.status) ? t("Labo:Check:FooterWaiting", waiting) : null;
}

const AT_LABO = new Set<number>([LABO_STATUS.Sent, LABO_STATUS.Returned]);

/**
 * Tab 2 once there is nothing to conclude (Labo 2 v2 mock, R-1151): where the
 * order stands, Đóng, and «Tiếp: Bảo hành ›» — live once the Bảo hành tab is.
 */
export function LaboCheckDoneFooter({
  order,
  readOnly,
  onShowWarranty,
  onClose,
}: {
  order: LaboOrderDto;
  /** The R-1120 viewer: nothing to press but Đóng. */
  readOnly: boolean;
  /** Unset while the Bảo hành tab is locked. */
  onShowWarranty?: () => void;
  onClose: () => void;
}) {
  const hint = doneHint(order);
  return (
    <div className="pd-labo-footer pd-labo-step-footer">
      {hint && <span className="pd-labo-footer-hint">{hint}</span>}
      <div className="pd-labo-footer-actions">
        <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
        {!readOnly && (
          <Button type="primary" className="pd-labo-btn-purple" disabled={!onShowWarranty} onClick={onShowWarranty}>
            {t("Labo:Check:NextWarranty")}
          </Button>
        )}
      </div>
    </div>
  );
}
