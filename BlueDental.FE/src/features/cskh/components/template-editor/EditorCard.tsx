import type { ReactNode } from "react";

interface EditorCardProps {
  /** The round number before the title: 1 Chọn loại mẫu, 2 Soạn nội dung. */
  step?: number;
  title?: ReactNode;
  /** Far end of the title row: a hint or the channel badge. */
  extra?: ReactNode;
  tone?: "plain" | "accent";
  className?: string;
  children: ReactNode;
}

/** One white block of the editor; the channel step sits on the soft purple ground. */
export function EditorCard({ step, title, extra, tone = "plain", className, children }: EditorCardProps) {
  return (
    <section className={["tpe-card", tone === "accent" && "tpe-card--accent", className].filter(Boolean).join(" ")}>
      {title && (
        <div className="tpe-card-head">
          <h2 className="tpe-card-title">
            {step !== undefined && <span className="tpe-step">{step}</span>}
            {title}
          </h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}
