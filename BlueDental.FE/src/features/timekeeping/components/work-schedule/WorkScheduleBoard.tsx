import { useCallback, useMemo, useState, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Spin } from "antd";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { t } from "@/lib/i18n";
import { WORK_SCHEDULE_SHIFT } from "../../api/workScheduleApi";
import { useSaveWorkSchedule, useWorkScheduleBoard } from "../../api/workScheduleQueries";
import { useScheduleDraft } from "../../hooks/useScheduleDraft";
import { useScheduleFilters } from "../../hooks/useScheduleFilters";
import { useSchedulePaint, type PaintBlock } from "../../hooks/useSchedulePaint";
import type { ScheduleGroupVm, ScheduleView } from "../../types/workSchedule";
import { monthDays, type BrushShift } from "../../utils/workScheduleShift";
import type { GridContext } from "./ScheduleGroupRows";
import { PersonScheduleView } from "./PersonScheduleView";
import { SaveScheduleDialog } from "./SaveScheduleDialog";
import { ScheduleToolbar, type MonthStep } from "./ScheduleToolbar";
import { ShiftBrushBar } from "./ShiftBrushBar";
import { TeamScheduleGrid } from "./TeamScheduleGrid";
import "./work-schedule.css";

interface Props {
  /** The calendar's date — the board opens on its month. */
  initialDate: Dayjs;
}

const NO_GROUPS: ScheduleGroupVm[] = [];

const BLOCK_MESSAGE: Record<PaintBlock, string> = {
  locked: "Timekeeping:Board:LockedDay",
  forbidden: "Timekeeping:Board:NoPermission",
};

const handleBlocked = (reason: PaintBlock) =>
  toast.warning(t(BLOCK_MESSAGE[reason]), { id: `ws-block-${reason}` });

/**
 * Lịch làm việc (BA P0911, F-90): register S / C / SC per person per day for
 * tomorrow onwards, by team or person, then save every change in one go.
 */
export function WorkScheduleBoard({ initialDate }: Props) {
  const [period, setPeriod] = useState(() => ({ year: initialDate.year(), month: initialDate.month() + 1 }));
  const [view, setView] = useState<ScheduleView>("team");
  const [brush, setBrush] = useState<BrushShift>(WORK_SCHEDULE_SHIFT.FullDay);
  const [personId, setPersonId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const board = useWorkScheduleBoard(period.year, period.month);
  const save = useSaveWorkSchedule();
  const draft = useScheduleDraft();
  const paint = useSchedulePaint(draft, brush, handleBlocked);
  const groups = board.data?.groups ?? NO_GROUPS;
  const filters = useScheduleFilters(groups);

  const today = board.data?.today ?? dayjs().format("YYYY-MM-DD");
  const days = useMemo(() => monthDays(period.year, period.month, today), [period, today]);

  const handleMonthStep = useCallback((step: MonthStep) => {
    setPeriod((prev) => {
      const base = step === "today" ? dayjs() : dayjs(new Date(prev.year, prev.month - 1, 1)).add(step, "month");
      return { year: base.year(), month: base.month() + 1 };
    });
  }, []);

  const handleOpenPerson = useCallback((staffId: string) => {
    setPersonId(staffId);
    setView("person");
  }, []);

  const handleReset = useCallback(() => {
    draft.reset();
    toast.info(t("Timekeeping:Board:ResetDone"));
  }, [draft]);

  const handleConfirm = useCallback(() => {
    const items = draft.changes.map((c) => ({ staffId: c.staffId, workDate: c.date, shift: c.to }));
    save.mutate(items, {
      onSuccess: () => {
        toast.success(t("Timekeeping:Board:Saved", items.length));
        draft.reset();
        setConfirmOpen(false);
      },
    });
  }, [draft, save]);

  const ctx: GridContext = { days, month: period.month, draft, paint, onOpenPerson: handleOpenPerson };
  const shown = filters.visibleGroups;
  const people = shown.flatMap((g) => g.members);
  const person = people.find((m) => m.staffId === personId) ?? people[0] ?? null;

  let body: ReactNode;
  if (board.isLoading) body = <div className="ws-loading"><Spin /></div>;
  else if (board.isError) body = <EmptyState title={t("Timekeeping:Board:LoadFailed")} actionLabel={t("Timekeeping:Board:Retry")} onAction={() => void board.refetch()} />;
  else if (view === "team") body = <TeamScheduleGrid groups={shown} ctx={ctx} />;
  else body = <PersonScheduleView groups={shown} person={person} onSelect={setPersonId} brush={brush} ctx={ctx} />;

  return (
    <section className="ws-board">
      <ScheduleToolbar
        view={view}
        onViewChange={setView}
        year={period.year}
        month={period.month}
        onMonthStep={handleMonthStep}
        groups={groups}
        filters={filters}
      />
      <ShiftBrushBar
        brush={brush}
        onBrushChange={setBrush}
        pendingCount={draft.changes.length}
        onReset={handleReset}
        onSave={() => setConfirmOpen(true)}
      />
      {body}
      <SaveScheduleDialog
        open={confirmOpen}
        changes={draft.changes}
        saving={save.isPending}
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}
