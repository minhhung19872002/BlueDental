import { useEffect, useRef, useState, type RefObject } from "react";
import { Spin } from "antd";
import type { UseQueryResult } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LaboWorkflowDialog } from "@/features/labo/components/workflow/LaboWorkflowDialog";
import { useLaboWorkflowUrl } from "@/features/labo/components/workflow/useLaboWorkflowUrl";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { describeApiError } from "@/lib/apiError";
import type { PlanWarrantyOverviewDto, WarrantyCardRowDto, WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { ActivatedWarrantyCard } from "./ActivatedWarrantyCard";
import { ServiceWarrantyDialog } from "./ServiceWarrantyDialog";
import { WarrantyCardViewer } from "./WarrantyCardViewer";
import { WarrantyHistoryCard, type HistoryView } from "./WarrantyHistoryCard";
import { WarrantyStatusCard } from "./WarrantyStatusCard";
import { serviceTitle, type CardView, type RowFilter } from "./planWarrantyView";
import type { StatusActions } from "./warrantyStatusColumns";
import "@/features/labo/components/warranty/labo-warranty.css";
import "./plan-warranty.css";

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
  overview: UseQueryResult<PlanWarrantyOverviewDto>;
}

type BodyProps = Omit<Props, "overview"> & { overview: PlanWarrantyOverviewDto };

function scrollTo(ref: RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Tab "Bảo hành" of the slip (P3110, REQ-B1…B7): status per service, the
 * activated cards, and the warranty history. The page reads the overview
 * itself, so the tab's count shows on every tab.
 */
export function PlanWarrantyTab({ overview, ...props }: Props) {
  if (overview.isLoading) {
    return (
      <div className="pwt-center">
        <Spin size="large" />
      </div>
    );
  }
  if (!overview.data) return <EmptyState title={describeApiError(overview.error).message} />;
  return <PlanWarrantyBody {...props} overview={overview.data} />;
}

function PlanWarrantyBody({ patient, plan, branchId, overview }: BodyProps) {
  const [searchParams] = useSearchParams();
  const focusLineId = searchParams.get("line");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [cardView, setCardView] = useState<CardView>({ kind: "all", lineId: null, sort: "expiry" });
  const [historyView, setHistoryView] = useState<HistoryView>({ filter: "all", cardCode: null });
  const [activating, setActivating] = useState<WarrantyServiceRowDto | null>(null);
  const [viewing, setViewing] = useState<WarrantyCardRowDto | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const labo = useLaboWorkflowUrl();
  const canActivate = useAbility("treatmentStage").canUpdate;
  const canLabo = useAbility("treatmentLabo").canUpdate;

  // A `line=` link (Tiếp tục bảo hành, Bảo hành chip) lands on its row.
  useEffect(() => {
    if (focusLineId) statusRef.current?.querySelector(".pwt-row--focus")?.scrollIntoView({ block: "center" });
  }, [focusLineId]);

  const actions: StatusActions = {
    canActivate,
    canLabo,
    onDental: setActivating,
    onLabo: (row) => row.pendingLaboOrderId && labo.openOrder(row.pendingLaboOrderId, "warranty"),
    onCards: (row) => {
      setCardView((view) => ({ ...view, kind: "all", lineId: row.lineId }));
      scrollTo(cardsRef);
    },
  };

  const handleHistory = (code: string) => {
    setHistoryView({ filter: "all", cardCode: code });
    scrollTo(historyRef);
  };

  const filteredLine = overview.rows.find((row) => row.lineId === cardView.lineId);
  const laboPatient = { id: patient.id, code: patient.patientCode, name: patient.fullName };

  return (
    <div className="pwt-tab">
      <div ref={statusRef}>
        <WarrantyStatusCard
          rows={overview.rows}
          filter={rowFilter}
          onFilterChange={setRowFilter}
          highlightLineId={focusLineId}
          actions={actions}
        />
      </div>
      <ActivatedWarrantyCard
        ref={cardsRef}
        cards={overview.cards}
        today={overview.today}
        view={cardView}
        lineLabel={filteredLine ? serviceTitle(filteredLine) : null}
        onViewChange={setCardView}
        onHistory={handleHistory}
        onView={setViewing}
      />
      <WarrantyHistoryCard ref={historyRef} overview={overview} view={historyView} onViewChange={setHistoryView} />
      <ServiceWarrantyDialog row={activating} planId={plan.id} onClose={() => setActivating(null)} />
      <LaboWorkflowDialog
        target={labo.target}
        branchId={branchId}
        patient={laboPatient}
        onClose={labo.close}
        onStepChange={labo.setStep}
      />
      <WarrantyCardViewer
        card={viewing}
        overview={overview}
        branchId={branchId}
        patient={laboPatient}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
