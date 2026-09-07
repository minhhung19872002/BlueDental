import { ChevronRight, ClipboardList, Zap } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { PlanServiceRow } from "./planTypes";

type Variant = "active" | "recent";

interface CardProps {
  variant: Variant;
  title: string;
  icon: React.ReactNode;
  rows: PlanServiceRow[];
  onOpen: (row: PlanServiceRow) => void;
}

/**
 * The line under the service name: the slip's date while it is in treatment,
 * the latest stage note once it has stages (notes come in stage order).
 */
function itemMeta(variant: Variant, { plan, service }: PlanServiceRow): string {
  if (variant === "active") return formatDate(plan.creationTime);
  return service.stageNotes.at(-1) ?? "";
}

function SummaryCard({ variant, title, icon, rows, onOpen }: CardProps) {
  return (
    <section className={`tp-card tp-card--${variant}`} aria-label={title}>
      <header className="tp-card-head">
        <span className="tp-card-icon">{icon}</span>
        <span className="tp-card-title">{title}</span>
        {variant === "active" && <span className="tp-card-count">{rows.length}</span>}
      </header>
      <div className="tp-card-body">
        {rows.map((row) => (
          <button
            key={row.service.id}
            type="button"
            className={`tp-card-item tp-card-item--${variant}`}
            onClick={() => onOpen(row)}
          >
            <div className="tp-card-item-text">
              <strong>{row.service.serviceName}</strong>
              <span className="tp-card-item-meta">
                <b className="tp-card-code">{row.plan.code}</b>
                <span>{itemMeta(variant, row)}</span>
              </span>
            </div>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

interface Props {
  active: PlanServiceRow[];
  recent: PlanServiceRow[];
  /** An item leads to its slip's screen. */
  onOpen: (row: PlanServiceRow) => void;
}

/** The two summary widgets above the slip table. */
export function PlanSummaryCards({ active, recent, onOpen }: Props) {
  return (
    <div className="tp-cards">
      <SummaryCard
        variant="active"
        title={t("Dịch vụ đang điều trị")}
        icon={<ClipboardList size={18} aria-hidden="true" />}
        rows={active}
        onOpen={onOpen}
      />
      <SummaryCard
        variant="recent"
        title={t("Dịch vụ có công đoạn gần nhất")}
        icon={<Zap size={18} aria-hidden="true" />}
        rows={recent}
        onOpen={onOpen}
      />
    </div>
  );
}
