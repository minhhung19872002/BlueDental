import { CheckOutlined } from "@ant-design/icons";
import { Form } from "antd";
import { Shield } from "lucide-react";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { lineHeadline } from "./planWarrantyView";
import { ServiceWarrantyToothForm } from "./ServiceWarrantyToothForm";
import { useServiceWarrantyForm, type ServiceWarrantyForm } from "./useServiceWarrantyForm";
import "@/features/labo/components/check/labo-check.css";

interface Props {
  /** The line whose "Bảo hành dịch vụ" was pressed; null keeps the dialog shut. */
  row: WarrantyServiceRowDto | null;
  planId: string;
  onClose: () => void;
}

function ToothPicker({ warranty }: { warranty: ServiceWarrantyForm }) {
  return (
    <div className="pd-labo-warranty-step">
      <h4 className="pd-labo-warranty-step-title">
        <span className="pd-labo-check-badge">1</span>
        {t("Labo:Warranty:PickTitle")}
      </h4>
      <div className="pd-labo-warranty-picks">
        {warranty.teeth.map((tooth) => {
          const on = warranty.selected.includes(tooth);
          return (
            <button
              key={tooth}
              type="button"
              className={["pd-labo-warranty-pick", on && "pd-labo-warranty-pick--on"].filter(Boolean).join(" ")}
              aria-pressed={on}
              disabled={warranty.busy}
              onClick={() => warranty.toggle(tooth)}
            >
              {on && <CheckOutlined />}
              {t("Labo:Check:ToothLabel", tooth)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServiceWarrantyBody({ row, planId, onClose }: Props & { row: WarrantyServiceRowDto }) {
  const warranty = useServiceWarrantyForm(row, planId, onClose);
  const hasTeeth = warranty.teeth.some((tooth) => tooth !== 0);
  const count = warranty.selected.length;

  return (
    <AppDialog
      open
      centered
      width="min(1080px, calc(100vw - 32px))"
      className="pwt-dialog"
      title={t("Patient:Stage:ServiceWarranty")}
      subtitle={lineHeadline(row)}
      canSave={count > 0}
      saving={warranty.busy}
      saveIcon={<Shield size={16} aria-hidden="true" />}
      saveLabel={hasTeeth ? t("Labo:Warranty:Activate", count) : t("Labo:Warranty:ActivateTitle")}
      savingLabel={t("Treatment:Warranty:Activating")}
      cancelLabel={t("Common:Close")}
      footerLeft={hasTeeth && t("Labo:Warranty:ReadyCount", warranty.readyCount, count)}
      onSave={() => void warranty.activate()}
      onClose={onClose}
    >
      <section className="pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
        {hasTeeth && <ToothPicker warranty={warranty} />}
        <Form
          form={warranty.form}
          initialValues={warranty.initialValues}
          layout="vertical"
          className="pd-labo-form"
          disabled={warranty.busy}
        >
          <div className="pd-labo-warranty-step">
            {hasTeeth && (
              <h4 className="pd-labo-warranty-step-title">
                <span className="pd-labo-check-badge">2</span>
                {t("Labo:Warranty:FormTitle")}
              </h4>
            )}
            {warranty.teeth
              .filter((tooth) => warranty.selected.includes(tooth))
              .map((tooth) => (
                <ServiceWarrantyToothForm key={tooth} tooth={tooth} row={row} photos={warranty.photos} busy={warranty.busy} />
              ))}
          </div>
        </Form>
      </section>
    </AppDialog>
  );
}

/** "Bảo hành dịch vụ" (REQ-B5, D9): the dental cards of one line, on the frame of Labo's step 3. */
export function ServiceWarrantyDialog({ row, planId, onClose }: Props) {
  if (!row) return null;
  return <ServiceWarrantyBody key={row.lineId} row={row} planId={planId} onClose={onClose} />;
}
