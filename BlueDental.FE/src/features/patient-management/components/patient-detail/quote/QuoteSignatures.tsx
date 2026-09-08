import { t } from "@/lib/i18n";

/**
 * The signature strip both printed sheets end on.
 *
 * The two sheets word and stack it differently — the quote puts its caption
 * straight under the heading and leaves the space for a pen above the printed
 * name, while the diagnosis invoice prints the name first and captions it
 * underneath — so the order is a prop rather than two near-identical blocks.
 */
interface Props {
  /** Left column: who raised the sheet, or who made the diagnosis. */
  leftLabel: string;
  leftName: string;
  rightLabel: string;
  rightName: string;
  /** "(Ký, họ tên)" or "(Ký, ghi rõ họ tên)" — the sheets differ. */
  caption: string;
  /**
   * `caption-first` leaves the signing space between the caption and the name;
   * `name-first` prints the name and captions it below.
   */
  layout: "caption-first" | "name-first";
  /**
   * Given, the left-hand name is typed over rather than read: the reference
   * lets the diagnosis invoice's doctor be corrected on the sheet itself, and
   * draws that one field on a tinted ground.
   */
  onLeftNameChange?: (value: string) => void;
}

function Name({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange?: (value: string) => void;
}) {
  if (!onChange) {
    return <p className="pq-signs__name">{value || " "}</p>;
  }

  return (
    <input
      className="pq-signs__name pq-signs__name--edit"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function Column({
  label,
  name,
  caption,
  layout,
  onNameChange,
}: {
  label: string;
  name: string;
  caption: string;
  layout: Props["layout"];
  onNameChange?: (value: string) => void;
}) {
  const nameNode = <Name value={name} label={label} onChange={onNameChange} />;

  return (
    <div className="pq-signs__col">
      <p className="pq-signs__role">{label}</p>
      {layout === "caption-first" ? (
        <>
          <em className="pq-signs__caption">{caption}</em>
          {nameNode}
        </>
      ) : (
        <>
          {nameNode}
          <em className="pq-signs__caption">{caption}</em>
        </>
      )}
    </div>
  );
}

export function QuoteSignatures({
  leftLabel,
  leftName,
  rightLabel,
  rightName,
  caption,
  layout,
  onLeftNameChange,
}: Props) {
  return (
    <div className="pq-signs" aria-label={t("Chữ ký")}>
      <Column
        label={leftLabel}
        name={leftName}
        caption={caption}
        layout={layout}
        onNameChange={onLeftNameChange}
      />
      <Column label={rightLabel} name={rightName} caption={caption} layout={layout} />
    </div>
  );
}
