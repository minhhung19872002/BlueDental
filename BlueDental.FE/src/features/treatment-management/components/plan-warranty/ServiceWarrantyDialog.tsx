import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Button, Form, Modal } from "antd";
import { useAuthStore } from "@/features/auth/store/authStore";
import { LaboWarrantySharedPreview } from "@/features/labo/components/warranty/LaboWarrantySharedPreview";
import { useWarrantyToothJump } from "@/features/labo/components/warranty/useWarrantyToothJump";
import { t } from "@/lib/i18n";
import type { WarrantyCardRowDto, WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { lineHeadline } from "./planWarrantyView";
import { catalogDaysOf } from "./serviceWarrantyRules";
import { ServiceWarrantyCardsAside } from "./ServiceWarrantyCardsAside";
import { ServiceWarrantyCardsSection } from "./ServiceWarrantyCardsSection";
import { ServiceWarrantyToothPicker } from "./ServiceWarrantyToothPicker";
import { useServiceWarrantyForm } from "./useServiceWarrantyForm";
import "@/features/labo/components/labo-order-dialog.css";
import "@/features/labo/components/check/labo-check.css";
import "@/features/labo/components/warranty/labo-warranty.css";
import "@/features/labo/components/workflow/labo-workflow-theme.css";

interface Props {
  /** The line whose "Bảo hành dịch vụ" was pressed; null keeps the dialog shut. */
  row: WarrantyServiceRowDto | null;
  /** The line's dental cards already activated, shown beside the forms. */
  cards: WarrantyCardRowDto[];
  /** The clinic's day, for the cards' time left. */
  today: string;
  planId: string;
  onClose: () => void;
}

type BodyProps = Omit<Props, "row"> & { row: WarrantyServiceRowDto };

function ServiceWarrantyBody({ row, cards, today, planId, onClose }: BodyProps) {
  const warranty = useServiceWarrantyForm(row, planId, onClose);
  const jump = useWarrantyToothJump();
  // Same fallback as the header's logo.
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";
  const picked = warranty.teeth.filter((tooth) => warranty.selected.includes(tooth));
  const sharedOn = warranty.sharing.on && picked.length > 0;
  const count = warranty.selected.length;

  return (
    <Modal
      open
      width="min(1320px, calc(100vw - 32px))"
      className="pd-labo-dialog pd-labo-workflow"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <header className="pd-labo-workflow-head">
        <div className="pd-labo-workflow-title">
          <div className="pd-labo-workflow-titlerow">
            <h2 className="bd-modal-title">{t("Patient:Stage:ServiceWarranty")}</h2>
          </div>
          <p className="pd-labo-step-hint">{lineHeadline(row)}</p>
        </div>
      </header>
      <div className="pd-labo-flow-tabs" role="tablist">
        <span role="tab" aria-selected className="pd-labo-flow-tab pd-labo-flow-tab--on">
          {t("Labo:Warranty:ActivateTitle")}
        </span>
        <span className="pd-labo-check-aside">{t("Labo:Warranty:ReadyCount", warranty.readyCount, count)}</span>
      </div>
      <section className="pd-labo-flow-main pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
        {warranty.hasTeeth && (
          <div className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--teeth">
            <ServiceWarrantyToothPicker warranty={warranty} row={row} jump={jump} />
          </div>
        )}
        <div className="pd-labo-flow-pane pd-labo-flow-pane--main">
          {/* Mounted even with nothing picked, so the form instance stays connected. */}
          <Form
            form={warranty.form}
            initialValues={warranty.initialValues}
            layout="vertical"
            className="pd-labo-form"
            disabled={warranty.busy}
          >
            {picked.length > 0 && (
              <ServiceWarrantyCardsSection warranty={warranty} row={row} picked={picked} focused={jump.focused} />
            )}
          </Form>
        </div>
        <aside className="pd-labo-flow-pane pd-labo-flow-pane--aside">
          {sharedOn && (
            <LaboWarrantySharedPreview
              teeth={picked}
              card={warranty.sharing.cardOf(picked[0])}
              what={row.serviceName}
              logoUrl={logoUrl}
              catalogDays={catalogDaysOf(row)}
            />
          )}
          <ServiceWarrantyCardsAside
            row={row}
            cards={cards}
            leaveOut={sharedOn ? picked : []}
            today={today}
            logoUrl={logoUrl}
          />
        </aside>
      </section>
      <div className="pd-labo-footer pd-labo-step-footer">
        <span className="pd-labo-footer-hint">
          {t(warranty.hasTeeth ? "Labo:Warranty:FooterActivate" : "Treatment:Warranty:FooterActivateLine")}
        </span>
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Common:Close")}</Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={warranty.busy}
            disabled={warranty.busy || count === 0}
            onClick={() => void warranty.activate()}
          >
            {warranty.hasTeeth ? t("Labo:Warranty:Activate", count) : t("Labo:Warranty:ActivateTitle")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * "Bảo hành dịch vụ" (REQ-B5, D9) in the three columns of Labo's Kích hoạt
 * bảo hành: pick the teeth, a card form each — or one under Dùng chung —, and
 * the line's cards on the right, the shared one's preview first.
 */
export function ServiceWarrantyDialog({ row, ...props }: Props) {
  if (!row) return null;
  return <ServiceWarrantyBody key={row.lineId} row={row} {...props} />;
}
