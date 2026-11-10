import { t } from "@/lib/i18n";
import { hasShade, SHADE_ZONES, type ShadeValues, type ShadeZone } from "./requestSlipModel";
import { SectionBadge } from "./SectionBadge";

interface Props {
  shade: ShadeValues;
  editable: boolean;
  onChange: (shade: ShadeValues) => void;
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
 * Màu răng: a tooth split into Cổ / Thân / Rìa cắn by Gần / Xa, a shade code
 * typed in each cell (upper-cased, "A3.5"). One map for every tooth of the
 * order; any cell filled is enough.
 */
export function ShadeZoneMap({ shade, editable, onChange }: Props) {
  const filled = hasShade(shade);
  return (
    <section className="rs-sec">
      <div className="rs-sech">
        {t("Labo:Slip:Shade")} <span className="rs-req">*</span>
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
            <div className="rs-toothmap" role="group" aria-label={t("Labo:Slip:ShadeMap")}>
              {SHADE_ZONES.map((zone) => (
                <input
                  key={zone}
                  className="rs-zone"
                  value={shade[zone]}
                  placeholder="—"
                  maxLength={16}
                  disabled={!editable}
                  aria-label={t(ZONE_LABEL[zone])}
                  onChange={(event) => onChange({ ...shade, [zone]: event.target.value.toUpperCase() })}
                />
              ))}
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
