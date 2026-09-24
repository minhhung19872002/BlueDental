import { Alert, Spin, Tag } from "antd";
import { t } from "@/lib/i18n";
import type { CardAddress } from "../../utils/cardAddress";
import type { CccdCard } from "../../utils/cccdQr";

export type PreviewStatus = "empty" | "checking" | "new" | "failed";

interface Props {
  card: CccdCard | null;
  address: CardAddress | null;
  status: PreviewStatus;
  error: string | null;
}

/** "1990-03-15" → "15/03/1990". */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Common:Gender:Male",
  female: "Common:Gender:Female",
};

const STATUS_TAG: Partial<Record<PreviewStatus, { color: string; label: string }>> = {
  new: { color: "green", label: "Patient:ScanId:StatusNew" },
};

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={["bd-idcard-field", wide && "bd-idcard-field--wide"].filter(Boolean).join(" ")}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Today's ward and province, as the address was converted — or why not. */
function newAddressText(address: CardAddress | null): string {
  if (!address?.provinceName) return t("Patient:ScanId:NewAddressUnknown");
  if (!address.wardName) return `${address.provinceName} — ${t("Patient:ScanId:WardUnknown")}`;
  return `${address.wardName}, ${address.provinceName}`;
}

/**
 * The right half of "Quét CCCD": what the card says, laid out like the card,
 * with whether the branch already has the person on file.
 */
export function CccdPreviewCard({ card, address, status, error }: Props) {
  if (!card) {
    return (
      <section className="bd-idcard bd-idcard--empty" aria-label={t("Patient:ScanId:Preview")}>
        {status === "checking" ? (
          <p className="bd-idcard-checking">
            <Spin size="small" /> {t("Patient:ScanId:Checking")}
          </p>
        ) : (
          <p>{t("Patient:ScanId:PreviewEmpty")}</p>
        )}
      </section>
    );
  }

  const tag = STATUS_TAG[status];

  return (
    <section className="bd-idcard" aria-label={t("Patient:ScanId:Preview")}>
      <header className="bd-idcard-head">
        <span className="bd-idcard-kind">{t("Patient:ScanId:CardTitle")}</span>
        <strong className="bd-idcard-number">{card.nationalId}</strong>
        <span className="bd-idcard-name">{card.fullName ?? "—"}</span>
      </header>

      <dl className="bd-idcard-body">
        <Field label={t("Patient:ScanId:FormerId")} value={card.formerId ?? "—"} />
        <Field label={t("Patient:ScanId:DateOfBirth")} value={formatDate(card.dateOfBirth)} />
        <Field
          label={t("Patient:ScanId:Gender")}
          value={card.gender ? t(GENDER_LABEL[card.gender] ?? "Common:Gender:Other") : "—"}
        />
        <Field label={t("Patient:ScanId:IssuedOn")} value={formatDate(card.issuedOn)} />
        <Field
          wide
          label={
            address?.oldAddress ? t("Patient:ScanId:ResidenceOld") : t("Patient:ScanId:Residence")
          }
          value={card.address ?? "—"}
        />
        {card.address && (
          <Field wide label={t("Patient:ScanId:NewAddress")} value={newAddressText(address)} />
        )}
      </dl>

      <footer className="bd-idcard-status">
        {tag && <Tag color={tag.color}>{t(tag.label)}</Tag>}
        {status === "failed" && error && <Alert type="error" showIcon message={error} />}
      </footer>
    </section>
  );
}
