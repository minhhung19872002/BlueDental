import { Button } from "antd";
import { CheckCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_CHECK_CONCLUSION, type LaboCheckConclusion, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboCancelOrderButton } from "../workflow/LaboCancelOrderButton";
import type { LaboCheckVerdict } from "./laboCheckRules";

interface Props {
  order: LaboOrderDto;
  editable: boolean;
  busy: boolean;
  verdict: LaboCheckVerdict;
  returnNo: number;
  onConclude: (conclusion: LaboCheckConclusion) => void;
  onClose: () => void;
}

const HINT: Record<LaboCheckVerdict, string | null> = {
  incomplete: null,
  pass: "Labo:Check:FooterPass",
  return: "Labo:Check:FooterReturn",
};

/**
 * Huỷ · Hủy phiếu, then the conclusion the results allow: every tooth Đạt →
 * Xác nhận Labo đạt; any Lỗi → Trả toàn bộ or Trả hàng bị lỗi.
 */
export function LaboCheckFooter({ order, editable, busy, verdict, returnNo, onConclude, onClose }: Props) {
  const hint = editable ? HINT[verdict] : null;
  return (
    <div className="pd-labo-footer pd-labo-step-footer">
      {hint && <span className="pd-labo-footer-hint">{t(hint, returnNo)}</span>}
      <div className="pd-labo-footer-actions">
        <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
        <LaboCancelOrderButton order={order} disabled={busy} onDone={onClose} />
        {editable && verdict !== "pass" && (
          <>
            <Button
              danger
              icon={<RollbackOutlined />}
              loading={busy}
              disabled={busy || verdict !== "return"}
              onClick={() => onConclude(LABO_CHECK_CONCLUSION.ReturnAll)}
            >
              {t("Labo:Check:ReturnAll")}
            </Button>
            <Button
              type="primary"
              danger
              icon={<RollbackOutlined />}
              loading={busy}
              disabled={busy || verdict !== "return"}
              onClick={() => onConclude(LABO_CHECK_CONCLUSION.ReturnDefective)}
            >
              {t("Labo:Check:ReturnDefective")}
            </Button>
          </>
        )}
        {editable && verdict === "pass" && (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={busy}
            disabled={busy}
            onClick={() => onConclude(LABO_CHECK_CONCLUSION.Pass)}
          >
            {t("Labo:Check:ConfirmPassed")}
          </Button>
        )}
      </div>
    </div>
  );
}
