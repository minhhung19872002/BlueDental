import { surfaceList, ToothSurfacePicker } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { orderedFaces, surfaceLine } from "../check/laboToothFaces";

interface Props {
  tooth: LaboOrderToothDto;
  /** "Sứ Zirconia". */
  restoration: string;
}

/**
 * The tooth as it was made (BA mock BaoHanhV2, R-1152): its faces on the
 * picture, read only, then Mặt răng đã làm · Màu theo mặt · Vật liệu · nhận
 * hàng. An order made before R-1150 has no faces, so no picture.
 */
export function LaboWarrantyToothInfo({ tooth, restoration }: Props) {
  const faces = orderedFaces(tooth);
  const received = [restoration, tooth.passedAt && t("Labo:Warranty:PassedOn", formatDate(tooth.passedAt))]
    .filter(Boolean)
    .join(" · ");
  const lines: [string, string][] = [
    [t("Labo:Warranty:Info:Faces"), surfaceList(faces) || "—"],
    [t("Labo:Warranty:Info:Shades"), surfaceLine(tooth)],
    [t("Labo:Warranty:Info:Received"), received || "—"],
  ];

  return (
    <div className="pd-labo-wtooth-info">
      {faces.length > 0 && (
        <div className="pd-labo-wtooth-info-pic" aria-hidden>
          <ToothSurfacePicker tooth={tooth.toothNumber} picked={faces} />
        </div>
      )}
      <dl className="pd-labo-wtooth-info-list">
        {lines.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
