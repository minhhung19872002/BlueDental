import { Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import { LABO_MAX_PICTURES, type LaboPictureTiles } from "../order-dialogs/useLaboPictureTiles";
import { toothKey } from "./laboCheckRules";

interface Props {
  tooth: number;
  roundNo: number;
  /** "trả Labo lần k" — this tooth's own return number — and the notes it went back with before. */
  returns: { no: number; pastNotes: string[] };
  tiles: LaboPictureTiles;
  /** `picturesMissing`: Trả hàng bị lỗi was refused for this tooth having no picture (REQ-D6). */
  state: { busy: boolean; hidden: boolean; picturesMissing: boolean };
}

/**
 * A Lỗi tooth's own conclusion (P3110 m278, m342): Hình ảnh lỗi and Mô tả gửi
 * Labo, saved per tooth. Folded by «Thu gọn» it stays mounted, so its note
 * is still validated.
 */
export function LaboToothDefectGroup({ tooth, roundNo, returns, tiles, state }: Props) {
  const set = tiles.tilesOf(tooth);
  const { no: returnNo, pastNotes } = returns;
  const { busy, hidden, picturesMissing } = state;
  const groupClass = ["pd-labo-defect", picturesMissing && "pd-labo-defect--missing"].filter(Boolean).join(" ");
  return (
    <div className={groupClass} hidden={hidden}>
      <div className="pd-labo-defect-head">
        <strong>{t("Labo:Check:DefectTitle", tooth, returnNo)}</strong>
        {pastNotes.length > 0 && (
          <span>{pastNotes.map((note, index) => t("Labo:Check:PastNote", index + 1, note)).join(" · ")}</span>
        )}
      </div>
      <span className="pd-labo-defect-label">{t("Labo:Check:DefectPictures")}</span>
      <LaboPictureWell
        variant="defect"
        label={t("Labo:Check:PictureCount", set.length, LABO_MAX_PICTURES)}
        addLabel={t("Labo:Check:DefectPicturesAdd", tooth)}
        tiles={set}
        busy={busy}
        onAdd={(files) => tiles.addPictures(tooth, files)}
        onRemove={tiles.removeTile}
      />
      {picturesMissing && (
        <span className="pd-labo-defect-error" role="alert">
          {t("Labo:Check:PicturesRequired", tooth)}
        </span>
      )}
      <FloatingField
        name={["teeth", toothKey(tooth), "note"]}
        label={t("Labo:Check:DefectNoteLabel", tooth, roundNo)}
        required
        rules={[{ required: true, whitespace: true, message: t("Labo:Check:DefectNoteRequired", tooth) }]}
      >
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={500} />
      </FloatingField>
    </div>
  );
}
