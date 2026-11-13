import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { LABO_BLOCK_KIND, type LaboBlockKind } from "../../api/laboFormTemplateApi";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import { LaboToothRow } from "../order-dialogs/LaboToothRow";
import type { LaboPriorTeeth } from "../order-dialogs/laboPriorTeeth";
import { ExtraFieldInput } from "../request-slip/ExtraFieldInput";
import { FinishLineChecks } from "../request-slip/FinishLineChecks";
import type { ShadeValues } from "../request-slip/requestSlipModel";
import { RestorationPicker } from "../request-slip/RestorationPicker";
import { SectionBadge } from "../request-slip/SectionBadge";
import { ShadeZoneMap } from "../request-slip/ShadeZoneMap";
import { blockTitle } from "../request-slip/slipLayout";
import { SlipSpecSelects } from "../request-slip/SlipSpecSelects";
import type { BlockDraft } from "./formTemplateModel";
import { PreviewSlipInfo } from "./PreviewSlipInfo";
import type { PreviewCatalog } from "./usePreviewCatalog";

/**
 * A block of the builder's preview as a new Phiếu yêu cầu draws it (R-1202):
 * the slip's own parts with the branch's Dịch vụ, Vật liệu and Đường hoàn tất,
 * and a section's fields as the inputs the slip gives them. The preview body is
 * inert — nothing in it takes input; a click reaches the block underneath.
 */

const NO_SHADE: ShadeValues = {
  cervicalMesial: "",
  cervicalDistal: "",
  bodyMesial: "",
  bodyDistal: "",
  incisalMesial: "",
  incisalDistal: "",
};
const NO_PRIORS: LaboPriorTeeth = new Map();
const NO_ANSWERS: string[] = [];
const NO_OPTIONS: PickerOption[] = [];
const ignore = () => undefined;

const Teeth = ({ title }: { title: string }) => (
  <section className="rs-sec">
    <div className="rs-sech">
      {title} <span className="rs-req">*</span>
      <SectionBadge tone="miss">{t("Labo:Slip:NotPicked")}</SectionBadge>
    </div>
    <div className="rs-secb rs-teeth">
      <LaboToothRow bridge={false} code="" empty="—" readOnly={false} priors={NO_PRIORS} />
    </div>
  </section>
);

const Notes = ({ title }: { title: string }) => (
  <section className="rs-sec">
    <div className="rs-sech">{title}</div>
    <p className="rs-note rs-note--preview">{t("Labo:Slip:RequestPlaceholder")}</p>
    <div className="rs-pictures">
      <p className="pd-labo-row-label">
        {t("Labo:Workflow:CommonImages")} <span className="pd-labo-row-hint">{t("Labo:Workflow:CommonImagesHint")}</span>
      </p>
      <LaboPictureWell tiles={[]} busy={false} />
    </div>
  </section>
);

type SystemPart = (title: string, catalog: PreviewCatalog, block: BlockDraft) => ReactNode;

// No card kinds (R-1202): a draft reads them folded into Restoration (withoutRestorationCards).
const SYSTEM_PART: Partial<Record<LaboBlockKind, SystemPart>> = {
  [LABO_BLOCK_KIND.Info]: (title) => <PreviewSlipInfo title={title} />,
  [LABO_BLOCK_KIND.Restoration]: (title, catalog) => (
    <RestorationPicker
      services={catalog.services}
      materials={catalog.materials}
      serviceId={undefined}
      materialIds={NO_ANSWERS}
      editable
      title={title}
      onChange={ignore}
    />
  ),
  [LABO_BLOCK_KIND.Shade]: (title) => <ShadeZoneMap shade={NO_SHADE} editable title={title} onChange={ignore} />,
  [LABO_BLOCK_KIND.Teeth]: (title) => <Teeth title={title} />,
  [LABO_BLOCK_KIND.FinishLine]: (title, catalog) => (
    <FinishLineChecks options={catalog.finishLines} value={NO_ANSWERS} editable title={title} onChange={ignore}>
      <SlipSpecSelects rhythms={NO_OPTIONS} bites={NO_OPTIONS} rhythmId={undefined} biteId={undefined} editable onChange={ignore} />
    </FinishLineChecks>
  ),
  [LABO_BLOCK_KIND.Notes]: (title) => <Notes title={title} />,
};

/** A template's own section: the slip's Thông tin bổ sung card with its fields. */
function Section({ block, title }: { block: BlockDraft; title: string }) {
  return (
    <section className="rs-sec rs-extra">
      <div className="rs-sech">{title}</div>
      <div className="rs-extra-body">
        {block.fields.length === 0 ? (
          <p className="ftp-empty">{t("Labo:FormTpl:PreviewNoField")}</p>
        ) : (
          <div className="rs-extra-grid">
            {block.fields.map((field) => (
              <ExtraFieldInput
                key={field.rowId}
                field={{
                  key: field.rowId,
                  label: field.label.trim() || t("Labo:FormTpl:PreviewUnnamed"),
                  type: field.type,
                  required: field.required,
                  options: field.options,
                  blockKey: block.key,
                }}
                values={NO_ANSWERS}
                disabled={false}
                onChange={ignore}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** The body of one block in the preview, its heading included. */
export function PreviewBlockBody({ block, catalog }: { block: BlockDraft; catalog: PreviewCatalog }) {
  const title = blockTitle(block);
  if (block.kind === LABO_BLOCK_KIND.Custom) return <Section block={block} title={title} />;
  return <>{SYSTEM_PART[block.kind]?.(title, catalog, block)}</>;
}
