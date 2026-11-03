import type { ReactNode } from "react";

interface Props {
  step: number;
  title: string;
  /** "50 ảnh · 2 ngày chụp" under the title. */
  summary: string;
  /** "Tải ảnh" and "Chụp ảnh", for whoever may upload. */
  children?: ReactNode;
}

/** The tinted head of a stage column: numbered badge, stage name, summary, upload. */
export function PatientImageStageHeader({ step, title, summary, children }: Props) {
  return (
    <header className="pi-stage-head">
      <span className="pi-stage-step" aria-hidden="true">
        {step}
      </span>
      <span className="pi-stage-heading">
        <h3 className="pi-stage-title">{title}</h3>
        <span className="pi-stage-summary">{summary}</span>
      </span>
      {children}
    </header>
  );
}
