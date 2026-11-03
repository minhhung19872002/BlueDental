import type { ReactNode } from "react";
import { StepTrack, type StepTrackItem } from "@/components/StepTrack";
import { t } from "@/lib/i18n";

/** The clinic logo; the branch iPad has no signed-in user to read one from. */
export const STATION_LOGO = "/logo.png";

interface Props {
  clinicName: string;
  /** The four-step bar; none on the welcome screen. */
  steps?: readonly StepTrackItem[];
  children: ReactNode;
}

/** The iPad frame: logo and branch name only (BA) — no counter, no "Báo sai". */
export function StationShell({ clinicName, steps, children }: Props) {
  return (
    <main className="sst-page">
      <header className="sst-head">
        <img className="sst-head-logo" src={STATION_LOGO} alt="" />
        <span className="sst-head-name">{clinicName}</span>
      </header>
      {steps && (
        <section className="sst-steps">
          <StepTrack items={steps} label={t("SigningStation:Step:Label")} />
        </section>
      )}
      <div className="sst-body">{children}</div>
    </main>
  );
}

/** A screen of one message: welcome, not paired, thanks. */
export function StationMessage({ icon, title, text, children }: {
  icon: ReactNode;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="sst-message">
      <span className="sst-message-icon">{icon}</span>
      <h1 className="sst-message-title">{title}</h1>
      {text && <p className="sst-message-text">{text}</p>}
      {children}
    </div>
  );
}
