import { t } from "@/lib/i18n";
import { draftFace } from "./laboWarrantyDraft";
import { LaboWarrantyTeethInCard } from "./LaboWarrantySharedPreview";
import { LaboWarrantyPreviewPager } from "./LaboWarrantyToothNav";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";
import type { WarrantyActiveTooth } from "./useWarrantyActiveTooth";
import { WarrantyCardFace } from "./WarrantyCardFace";

interface Props {
  /** The open tooth, its card as typed so far. */
  card: LaboWarrantyCardValues | undefined;
  /** "Sứ · Việt Tiến Lab Group". */
  what: string;
  logoUrl: string;
  /** The picked teeth, and which one is open. */
  teeth: number[];
  active: WarrantyActiveTooth;
}

/**
 * Xem trước thẻ bảo hành, one tooth at a time (BA mock BaoHanhV2, R-1152): the
 * open tooth's card with ‹ i/n › to walk the picked teeth, then every picked
 * tooth as a chip.
 */
export function LaboWarrantyToothPreview({ card, what, logoUrl, teeth, active }: Props) {
  if (active.active == null) {
    return <p className="pd-labo-warranty-note">{t("Labo:Warranty:NoneSelected")}</p>;
  }
  return (
    <div className="pd-labo-warranty-preview">
      <h4 className="pd-labo-warranty-preview-title pd-labo-wpreview-head">
        {t("Labo:Warranty:Preview")}
        <LaboWarrantyPreviewPager active={active} />
      </h4>
      <WarrantyCardFace face={draftFace(active.active, card, what)} logoUrl={logoUrl} />
      <LaboWarrantyTeethInCard teeth={teeth} />
    </div>
  );
}
