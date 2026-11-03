import { Button } from "antd";
import { CheckCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_CHECK_CONCLUSION, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCancelOrderButton } from "../workflow/LaboCancelOrderButton";
import type { LaboCheckVerdict } from "./laboCheckRules";
import type { LaboCheckForm } from "./useLaboCheckForm";

interface Props {
  order: LaboOrderDto;
  check: LaboCheckForm;
  onClose: () => void;
}

const HINT: Record<LaboCheckVerdict, string | null> = {
  incomplete: null,
  pass: "Labo:Check:FooterPass",
  return: "Labo:Check:FooterReturn",
};

/** The Trả buttons: both while some teeth pass (REQ-D11), only Trả toàn bộ once every tooth is Lỗi (m278). */
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
  if (allFailed) return returnAll;
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

/**
 * Huỷ · Huỷ phiếu, then the conclusion the results allow (P3110 m238, m278,
 * m342): every tooth Đạt → Xác nhận Labo đạt; any Lỗi → the Trả buttons.
 * Before «Kiểm tra Labo» there is nothing to conclude (m279).
 */
export function LaboCheckFooter({ order, check, onClose }: Props) {
  const concluding = check.editable && check.started;
  const hint = concluding ? HINT[check.verdict] : null;
  return (
    <div className="pd-labo-footer pd-labo-step-footer">
      {hint && <span className="pd-labo-footer-hint">{t(hint)}</span>}
      <div className="pd-labo-footer-actions">
        <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
        <LaboCancelOrderButton order={order} disabled={check.busy} onDone={onClose} />
        {concluding && check.verdict === "pass" && (
          <Button
            type="primary"
            className="pd-labo-btn-purple"
            icon={<CheckCircleOutlined />}
            loading={check.busy}
            disabled={check.busy}
            onClick={() => void check.conclude(LABO_CHECK_CONCLUSION.Pass)}
          >
            {t("Labo:Check:ConfirmPassedCount", check.teeth.length)}
          </Button>
        )}
        {concluding && check.verdict !== "pass" && <ReturnButtons order={order} check={check} />}
      </div>
    </div>
  );
}
