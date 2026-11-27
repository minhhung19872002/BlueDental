import { t } from "@/lib/i18n";

/**
 * The signature strip Phiếu báo giá ends on: each column a role, the caption
 * straight under it, then the signing space above the printed name.
 */
interface Props {
  /** Left column: who raised the sheet. */
  leftLabel: string;
  leftName: string;
  rightLabel: string;
  rightName: string;
  /** "(Ký, ghi rõ họ tên)". */
  caption: string;
}

function Column({ label, name, caption }: { label: string; name: string; caption: string }) {
  return (
    <div className="pq-signs__col">
      <p className="pq-signs__role">{label}</p>
      <em className="pq-signs__caption">{caption}</em>
      <p className="pq-signs__name">{name || " "}</p>
    </div>
  );
}

export function QuoteSignatures({ leftLabel, leftName, rightLabel, rightName, caption }: Props) {
  return (
    <div className="pq-signs" aria-label={t("Patient:QuoteSheet:Signature")}>
      <Column label={leftLabel} name={leftName} caption={caption} />
      <Column label={rightLabel} name={rightName} caption={caption} />
    </div>
  );
}
