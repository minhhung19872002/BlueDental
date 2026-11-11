import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import type { RestorationPick } from "./requestSlipModel";
import { cardOf, isTicked, type RestorationGroup } from "./restorationGroups";
import type { RestorationCardKind } from "./slipLayout";

interface Props {
  group: RestorationGroup;
  /** The card's heading as a Mẫu phiếu names it; none keeps the group's name. */
  title?: string;
  picked: RestorationPick[];
  editable: boolean;
  onToggle: (pick: RestorationPick) => void;
}

const rowClass = (base: string, on: boolean) => (on ? `${base} rs-on` : base);

/**
 * Toàn sứ / Hợp kim (P1011): a table with the group's own column and "Trên
 * implant", one row per material. Only a group made before P1011 leaves the
 * second cell empty for a material without the implant option. Past ten rows
 * the rows scroll under the header.
 */
export function RestorationTable({ group, title, picked, editable, onToggle }: Props) {
  return (
    <section className="rs-sec" aria-label={title ?? group.name}>
      <div className="rs-thead">
        <span>{title ?? group.name}</span>
        <span className="rs-c">{group.name}</span>
        <span className="rs-c">{t("Labo:Slip:OnImplant")}</span>
      </div>
      <div className="rs-rows">
        {group.items.map((item) => {
          const plain = { materialId: item.id, onImplant: false };
          const implant = { materialId: item.id, onImplant: true };
          const plainOn = isTicked(picked, plain);
          const implantOn = isTicked(picked, implant);
          return (
            <div key={item.id} className={rowClass("rs-trow", plainOn || implantOn)}>
              <span>{item.name}</span>
              <label className="rs-c">
                <Checkbox
                  checked={plainOn}
                  disabled={!editable}
                  aria-label={`${item.name} – ${group.name}`}
                  onChange={() => onToggle(plain)}
                />
              </label>
              <label className="rs-c">
                {(item.onImplant || implantOn) && (
                  <Checkbox
                    checked={implantOn}
                    disabled={!editable}
                    aria-label={`${item.name} – ${t("Labo:Slip:OnImplant")}`}
                    onChange={() => onToggle(implant)}
                  />
                )}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Phục hình khác trên implant — or a group made before P1011 with no implant
 * option: its name over a ticked list. The first stores every tick on an
 * implant (P1011), the second as it is.
 */
export function RestorationList({ group, title, picked, editable, onToggle }: Props) {
  return (
    <section className="rs-sec" aria-label={title ?? group.name}>
      <div className="rs-sech">{title ?? group.name}</div>
      <div className="rs-rows">
        {group.items.map((item) => {
          const pick = { materialId: item.id, onImplant: group.kind === "implantOnly" };
          const on = isTicked(picked, pick);
          return (
            <label key={item.id} className={rowClass("rs-krow", on)}>
              <span className="rs-grow">{item.name}</span>
              <Checkbox checked={on} disabled={!editable} onChange={() => onToggle(pick)} />
            </label>
          );
        })}
      </div>
    </section>
  );
}

/** Loại phục hình's heading: its name, a rule, and "Đã chọn" with the ticked names. */
export function RestorationHeading({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="rs-heading">
      <span className="rs-heading-title">{title}</span>
      <span className="rs-heading-rule" aria-hidden />
      <span className="rs-heading-picked">
        {t("Labo:Slip:Picked")} <b>{names.length ? names.join(", ") : t("Labo:Slip:NotPickedLower")}</b>
      </span>
    </div>
  );
}

interface CardProps extends Omit<Props, "group"> {
  kind: RestorationCardKind;
  groups: RestorationGroup[];
  /** Given, a card with no group shows this heading over an empty note; otherwise it shows nothing. */
  emptyTitle?: string;
}

/**
 * One card of Loại phục hình (R-1202): its group as a table (Toàn sứ, Hợp
 * kim) or a ticked list (Phục hình khác trên implant), followed on that card
 * by any group made before P1011 the order still ticks.
 */
export function RestorationCard({ kind, groups, title, emptyTitle, ...part }: CardProps) {
  const own = groups.filter((group) => cardOf(group) === kind);
  if (own.length === 0)
    return emptyTitle === undefined ? null : (
      <section className="rs-sec" aria-label={title ?? emptyTitle}>
        <div className="rs-sech">{title ?? emptyTitle}</div>
        <p className="rs-empty rs-card-empty">{t("Labo:Slip:CardEmpty")}</p>
      </section>
    );
  return (
    <div className="rs-col">
      {own.map((group, index) => {
        const Section = group.kind === "pair" ? RestorationTable : RestorationList;
        return <Section key={group.id} group={group} title={index === 0 ? title : undefined} {...part} />;
      })}
    </div>
  );
}
