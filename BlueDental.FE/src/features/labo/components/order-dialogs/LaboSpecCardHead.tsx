import { t } from "@/lib/i18n";

interface Props {
  /** "R11", or "Tất cả". */
  title: string;
  /** Under the "Tất cả" title: the teeth it fills. */
  caption?: string;
  /** The tooth is already on another order of the slip (R-1106). */
  prior?: boolean;
  summary: string;
  errors: number;
  open: boolean;
  onToggle: () => void;
}

/** A card's header: ▼ / ▶, the tooth, what it holds so far, and "n lỗi" or "Đủ thông tin". */
export function LaboSpecCardHead({ title, caption, prior, summary, errors, open, onToggle }: Props) {
  const chip = errors > 0 ? "pd-lts-chip pd-lts-chip--error" : "pd-lts-chip pd-lts-chip--done";
  return (
    <div className="pd-lts-head">
      <button
        type="button"
        className="pd-lts-caret"
        aria-expanded={open}
        aria-label={t(open ? "Labo:Spec:Collapse" : "Labo:Spec:Expand", title)}
        onClick={onToggle}
      >
        {open ? "▼" : "▶"}
      </button>
      <span className="pd-lts-name">
        <span className={prior ? "pd-lts-title pd-lts-title--prior" : "pd-lts-title"}>{title}</span>
        {prior && <span className="pd-lts-prior" title={t("Labo:Spec:Prior")} aria-label={t("Labo:Spec:Prior")} />}
        {caption && <span className="pd-lts-caption">{caption}</span>}
      </span>
      <span className="pd-lts-summary" title={summary}>
        {summary}
      </span>
      <span className={chip}>{errors > 0 ? t("Labo:Spec:ErrorCount", errors) : t("Labo:Spec:Done")}</span>
    </div>
  );
}
