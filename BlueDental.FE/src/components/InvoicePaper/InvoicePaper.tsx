import type { ReactNode } from "react";
import "./invoice-paper.css";

/** How much of a shared line a blank takes, as on the BA's paper form. */
export type PaperWidth = "name" | "year" | "phone" | "id" | "weight" | "height";

export function paperFieldClass(width?: PaperWidth, strong?: boolean): string {
  return ["inv-paper__field", width && `inv-paper__field--${width}`, strong && "inv-paper__field--strong"]
    .filter(Boolean)
    .join(" ");
}

interface InvoicePaperProps {
  title: string;
  className?: string;
  children: ReactNode;
}

/**
 * THÔNG TIN XUẤT HÓA ĐƠN as the BA's paper sheet: Times, a centred title and
 * "Label: ……" blanks. Filled in on the QR page and the staff dialog, read back
 * and printed on Chi tiết.
 */
export function InvoicePaper({ title, className, children }: InvoicePaperProps) {
  return (
    <section className={["inv-paper", className].filter(Boolean).join(" ")}>
      <h2 className="inv-paper__title">{title}</h2>
      {children}
    </section>
  );
}

/** One printed line; its blanks share the width. */
export function PaperRow({ children }: { children: ReactNode }) {
  return <div className="inv-paper__row">{children}</div>;
}

/** The bold, centred line above the company blanks. */
export function PaperNote({ children }: { children: ReactNode }) {
  return <p className="inv-paper__note">{children}</p>;
}

interface PaperTextProps {
  label: ReactNode;
  /** Empty: the dotted line stays blank for the customer's pen. */
  value?: ReactNode;
  width?: PaperWidth;
  strong?: boolean;
}

/** "Label: ……… value ………" read back. */
export function PaperText({ label, value, width, strong }: PaperTextProps) {
  return (
    <span className={paperFieldClass(width, strong)}>
      <span className="inv-paper__label">{label}:</span>
      <span className="inv-paper__fill">{value}</span>
    </span>
  );
}

/** "Label: (hint) ……" over two dotted lines, the text running on under the label. */
export function PaperLinedText({ label, value }: { label: ReactNode; value?: ReactNode }) {
  return (
    <p className="inv-paper__lined">
      <span className="inv-paper__label">{label}</span> {value}
    </p>
  );
}

/** ☐ / ☑ read back; neither box is ticked while the answer is unknown. */
export function PaperBox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inv-paper__choice" role="checkbox" aria-checked={checked} aria-readonly="true">
      <span className={checked ? "inv-paper__box inv-paper__box--checked" : "inv-paper__box"} aria-hidden="true" />
      {label}
    </span>
  );
}

/** "Question: ☐ Có ☐ Không" — the boxes come from PaperBox or PaperYesNo. */
export function PaperChoiceRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="inv-paper__row inv-paper__row--choices">
      <strong className="inv-paper__label">{label}:</strong>
      {children}
    </div>
  );
}
