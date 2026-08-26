import type { ReactNode } from "react";
import { ConsultantSummaryReport } from "./ConsultantSummaryReport";
import { InvoiceReport } from "./InvoiceReport";
import { SalesAccessReport } from "./SalesAccessReport";
import { ServiceCompletionReport } from "./ServiceCompletionReport";
import { UnderConstructionReport } from "./UnderConstructionReport";
import { UntreatedDiagnosisReport } from "./UntreatedDiagnosisReport";
import { WorkLogReport } from "./WorkLogReport";

/**
 * Which screen a report sub-tab draws.
 *
 * Keyed by sub-tab, because the same report appears under more than one
 * division — Truy cập belongs to both Khối điều trị and Khối tài chính, and
 * they show the identical screen.
 */
const SCREENS: Record<string, () => ReactNode> = {
  report: () => <WorkLogReport />,
  untreated: () => <UntreatedDiagnosisReport />,
  prescription: () => <UnderConstructionReport />,
  "customer-report": () => <ConsultantSummaryReport />,
  invoice: () => <InvoiceReport />,
  "service-complete": () => <ServiceCompletionReport />,
  // The middle tab row's own report.
  access: () => <SalesAccessReport />,
};

export function reportScreenFor(key: string): ReactNode | null {
  const screen = SCREENS[key];
  return screen ? screen() : null;
}
