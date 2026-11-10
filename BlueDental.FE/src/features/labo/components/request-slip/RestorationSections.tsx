import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import type { RestorationPick } from "./requestSlipModel";
import { isTicked, type RestorationGroup } from "./restorationGroups";

interface Props {
  group: RestorationGroup;
  picked: RestorationPick[];
  editable: boolean;
  onToggle: (pick: RestorationPick) => void;
}

const rowClass = (base: string, on: boolean) => (on ? `${base} rs-on` : base);

/**
 * A group whose materials can sit on an implant: a table with the group's own
 * column and "Trên implant", one row per material. A material without the
 * implant option leaves its second cell empty.
 */
export function RestorationTable({ group, picked, editable, onToggle }: Props) {
  return (
    <section className="rs-sec" aria-label={group.name}>
      <div className="rs-thead">
        <span>{group.name}</span>
        <span className="rs-c">{group.name}</span>
        <span className="rs-c">{t("Labo:Slip:OnImplant")}</span>
      </div>
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
    </section>
  );
}

/** Any other group: its name over a ticked list. */
export function RestorationList({ group, picked, editable, onToggle }: Props) {
  return (
    <section className="rs-sec" aria-label={group.name}>
      <div className="rs-sech">{group.name}</div>
      {group.items.map((item) => {
        const pick = { materialId: item.id, onImplant: false };
        const on = isTicked(picked, pick);
        return (
          <label key={item.id} className={rowClass("rs-krow", on)}>
            <span className="rs-grow">{item.name}</span>
            <Checkbox checked={on} disabled={!editable} onChange={() => onToggle(pick)} />
          </label>
        );
      })}
    </section>
  );
}
