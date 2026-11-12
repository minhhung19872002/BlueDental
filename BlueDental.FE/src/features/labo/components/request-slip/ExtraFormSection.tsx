import { t } from "@/lib/i18n";
import { ExtraFieldInput } from "./ExtraFieldInput";
import type { ExtraField } from "./extraFormModel";

interface Props {
  title: string;
  fields: ExtraField[];
  answers: Record<string, string[]>;
  editable: boolean;
  /** A copy made before layouts (F-93): the section says it is not printed. */
  unprinted?: boolean;
  /** The block's width class on the slip's grid (F-94). */
  className?: string;
  onAnswer: (key: string, values: string[]) => void;
}

/**
 * One section of a Mẫu phiếu's own fields (F-93, F-94), named by the
 * template. A locked slip shows the answers without letting them change.
 */
export function ExtraFormSection({ title, fields, answers, editable, unprinted, className, onAnswer }: Props) {
  return (
    <section className={["rs-sec rs-extra", className].filter(Boolean).join(" ")} aria-label={title}>
      <div className="rs-sech">
        {title}
        {unprinted && <span className="rs-extra-hint">{t("Labo:Slip:ExtraHint")}</span>}
      </div>
      <div className="rs-extra-body">
        <div className="rs-extra-grid">
          {fields.map((field) => (
            <ExtraFieldInput
              key={field.key}
              field={field}
              values={answers[field.key] ?? []}
              disabled={!editable}
              onChange={(values) => onAnswer(field.key, values)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
