import { Button } from "antd";
import { t } from "@/lib/i18n";
import { LaboWarrantyCard } from "./LaboWarrantyCard";
import { draftFace } from "./laboWarrantyDraft";
import { LaboWarrantyTable, type LaboWarrantyRow } from "./LaboWarrantyTable";
import { WarrantyCardFace } from "./WarrantyCardFace";

interface Props {
  rows: LaboWarrantyRow[];
  /** "Sứ Zirconia", on an activated card. */
  restoration: string;
  /** "Sứ Zirconia · Việt Tiến Lab Group", on a card still being typed. */
  what: string;
  logoUrl: string;
  /** The card "Xem chi tiết" was pressed on (R-1120). */
  focusTooth: number | null;
  /** "Chỉnh sửa" on a card not yet activated: back to its form. None once activation is not on offer. */
  onEdit?: (tooth: number) => void;
}

/**
 * Tổng quan thẻ bảo hành (BA mock BaoHanhV2, R-1152): every Đạt tooth's card —
 * activated ones as they stand and locked (Q10), the rest as typed so far with
 * "Chỉnh sửa" — then the same teeth as a table.
 */
export function LaboWarrantyOverview({ rows, restoration, what, logoUrl, focusTooth, onEdit }: Props) {
  return (
    <div className="pd-labo-flow-main">
      <section className="pd-labo-flow-pane pd-labo-flow-pane--main">
        <div className="pd-labo-warranty-cards pd-labo-woverview-cards">
          {rows.map((row) => {
            const tooth = row.tooth.toothNumber;
            if (!row.draft) {
              return (
                <LaboWarrantyCard
                  key={tooth}
                  tooth={row.tooth}
                  code={row.code}
                  restoration={restoration}
                  logoUrl={logoUrl}
                  focused={tooth === focusTooth}
                />
              );
            }
            const edit = onEdit && (
              <Button type="link" size="small" className="pd-labo-woverview-edit" onClick={() => onEdit(tooth)}>
                {t("Labo:Warranty:Edit")}
              </Button>
            );
            return (
              <WarrantyCardFace
                key={tooth}
                face={draftFace(tooth, row.draft.card, what)}
                logoUrl={logoUrl}
                footAction={edit}
              />
            );
          })}
        </div>
        <LaboWarrantyTable rows={rows} focusTooth={focusTooth} />
      </section>
    </div>
  );
}
