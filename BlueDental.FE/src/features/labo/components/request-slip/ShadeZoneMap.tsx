import { useId, type CSSProperties } from "react";
import { t } from "@/lib/i18n";
import { hasShade, SHADE_ZONES, type ShadeValues, type ShadeZone } from "./requestSlipModel";
import { SectionBadge } from "./SectionBadge";

interface Props {
  shade: ShadeValues;
  editable: boolean;
  onChange: (shade: ShadeValues) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/** The i18n key of each zone's accessible name, e.g. "Màu cổ gần". */
const ZONE_LABEL: Record<ShadeZone, string> = {
  cervicalMesial: "Labo:Slip:Zone:CervicalMesial",
  cervicalDistal: "Labo:Slip:Zone:CervicalDistal",
  bodyMesial: "Labo:Slip:Zone:BodyMesial",
  bodyDistal: "Labo:Slip:Zone:BodyDistal",
  incisalMesial: "Labo:Slip:Zone:IncisalMesial",
  incisalDistal: "Labo:Slip:Zone:IncisalDistal",
};

/**
 * An upper central incisor seen from the lip (R-1216, BA: "tạo hình cho
 * giống cái răng"), in the map's 220×260 box: a narrow neck under a domed
 * cervical line, the sides flaring out to the contact points, a broad incisal
 * edge — a crisper corner on the Gần side, a rounder one on the Xa side.
 * It outlines the map and clips the six cells to the tooth.
 */
const CROWN =
  "M 40 42 C 56 6 164 6 180 42 C 196 90 208 160 209 212 C 210 244 200 258 176 258 " +
  "L 30 258 C 18 258 12 252 12 240 C 12 160 24 90 40 42 Z";
const ZONE_LINES = "M 110 0 V 260 M 0 86.67 H 220 M 0 173.33 H 220";
const CROWN_STYLE = { "--rs-crown": `path("${CROWN}")` } as CSSProperties;

/**
 * Màu răng: an incisor crown split into Cổ / Thân / Rìa cắn by Gần / Xa, a shade code
 * typed in each cell (upper-cased, "A3.5"). One map for every tooth of the
 * order; any cell filled is enough.
 */
export function ShadeZoneMap({ shade, editable, onChange, title }: Props) {
  const filled = hasShade(shade);
  const clipId = `rs-crown-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <section className="rs-sec">
      <div className="rs-sech">
        {title ?? t("Labo:Slip:Shade")} <span className="rs-req">*</span>
        <SectionBadge tone={filled ? "ok" : "miss"}>
          {t(filled ? "Labo:Slip:ShadeFull" : "Labo:Slip:ShadeMissing")}
        </SectionBadge>
      </div>
      <div className="rs-shade">
        <div className="rs-shade-row">
          <div className="rs-shade-rows" aria-hidden>
            <span>{t("Labo:Slip:Zone:Cervical")}</span>
            <span>{t("Labo:Slip:Zone:Body")}</span>
            <span>{t("Labo:Slip:Zone:Incisal")}</span>
          </div>
          <div>
            <div className="rs-toothmap" role="group" aria-label={t("Labo:Slip:ShadeMap")} style={CROWN_STYLE}>
              <div className="rs-toothmap-zones">
                {SHADE_ZONES.map((zone) => (
                  <input
                    key={zone}
                    className="rs-zone"
                    data-zone={zone}
                    value={shade[zone]}
                    placeholder="—"
                    maxLength={16}
                    disabled={!editable}
                    aria-label={t(ZONE_LABEL[zone])}
                    onChange={(event) => onChange({ ...shade, [zone]: event.target.value.toUpperCase() })}
                  />
                ))}
              </div>
              <svg className="rs-toothmap-outline" viewBox="0 0 220 260" aria-hidden>
                <defs>
                  <clipPath id={clipId}>
                    <path d={CROWN} />
                  </clipPath>
                </defs>
                <path className="rs-toothmap-lines" d={ZONE_LINES} clipPath={`url(#${clipId})`} />
                <path className="rs-toothmap-crown" d={CROWN} />
              </svg>
            </div>
            <div className="rs-shade-cols" aria-hidden>
              <span>{t("Labo:Slip:Mesial")}</span>
              <span>{t("Labo:Slip:Distal")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
