import { Button, Modal } from "antd";
import { DataTable } from "@/components/DataTable";
import { useAuthStore } from "@/features/auth/store/authStore";
import { WarrantyCardFace } from "@/features/labo/components/warranty/WarrantyCardFace";
import { t } from "@/lib/i18n";
import type { WarrantyCardRowDto, WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { dentalCardColumns, dentalCardFace } from "./dentalCardView";
import { lineHeadline } from "./planWarrantyView";
import "@/features/labo/components/labo-order-dialog.css";
import "@/features/labo/components/check/labo-check.css";
import "@/features/labo/components/warranty/labo-warranty.css";
import "@/features/labo/components/workflow/labo-workflow-theme.css";

interface Props {
  /** The card "Xem chi tiết" was pressed on. */
  card: WarrantyCardRowDto;
  /** Every dental card of its line, the pressed one among them. */
  cards: WarrantyCardRowDto[];
  /** Its line, for the headline; absent if the line has left the slip. */
  line: WarrantyServiceRowDto | undefined;
  today: string;
  onClose: () => void;
}

/**
 * "Xem chi tiết" of a dental card (R-1120): the line's dental cards on the
 * frame of Labo's step 3 — cards, then the table — with nothing to change.
 */
export function DentalCardsViewDialog({ card, cards, line, today, onClose }: Props) {
  // Same fallback as the header's logo.
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";

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
          <p className="pd-labo-step-hint">{line ? lineHeadline(line) : card.serviceName}</p>
        </div>
      </header>
      <div className="pd-labo-flow-tabs" role="tablist">
        <span role="tab" aria-selected className="pd-labo-flow-tab pd-labo-flow-tab--on">{`${t("Labo:Warranty:Title")} (${cards.length})`}</span>
        <span className="pd-labo-check-aside">{t("Labo:Warranty:CardsHint", cards.length)}</span>
      </div>
      <div className="pd-labo-flow-main">
        <section className="pd-labo-flow-pane pd-labo-flow-pane--main">
          <div className="pd-labo-warranty-cards">
            {cards.map((row) => (
              <WarrantyCardFace
                key={row.code}
                face={dentalCardFace(row, today)}
                logoUrl={logoUrl}
                focused={row.code === card.code}
              />
            ))}
          </div>
          <DataTable<WarrantyCardRowDto>
            rowKey="code"
            size="small"
            className="pd-labo-warranty-table"
            rowClassName={(row) => (row.code === card.code ? "pd-labo-warranty-row--focus" : "")}
            columns={dentalCardColumns(today)}
            dataSource={cards}
            pagination={false}
          />
        </section>
      </div>
      <div className="pd-labo-footer pd-labo-step-footer">
        <span className="pd-labo-footer-hint">{t("Labo:Warranty:FooterTrack")}</span>
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Common:Close")}</Button>
        </div>
      </div>
    </Modal>
  );
}
