import { useMemo, useState } from "react";
import { Button, Input, Modal, Spin } from "antd";
import {
  SearchOutlined,
  LeftOutlined,
  UndoOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import dayjs, { type Dayjs } from "dayjs";

import { FloatingLabel } from "@/components/FloatingLabel";
import { WorkScheduleTable } from "./WorkScheduleTable";
import { useTimeKeepingList, useBulkRegister } from "../api/timekeepingQueries";
import { useOwnDayOffDraft } from "../hooks/useOwnDayOffDraft";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useBranchFilter } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" /><path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

interface Props {
  currentDate: Dayjs;
  onBack: () => void;
}

export function WorkScheduleBuilder({ currentDate, onBack }: Props) {
  const branchFilter = useBranchFilter();
  const workScheduleAbility = useAbility("workSchedule");
  const [builderMonth, setBuilderMonth] = useState(() => currentDate.startOf("month"));
  const [keyword, setKeyword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const bulkRegister = useBulkRegister();

  const fromDate = builderMonth.startOf("month").format("YYYY-MM-DD");
  const toDate = builderMonth.endOf("month").format("YYYY-MM-DD");

  const { data: tkData, isLoading: tkLoading } = useTimeKeepingList({
    clinicBranchId: branchFilter,
    fromDate,
    toDate,
    maxResultCount: 500,
  });

  const { data: staffPage, isLoading: staffLoading } = useStaffList({
    maxResultCount: 200,
    isActive: true,
    branchId: branchFilter,
  });

  const today = dayjs().format("YYYY-MM-DD");

  const staffCreationDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffPage?.items ?? []) {
      if (s.creationTime) map.set(s.id, dayjs(s.creationTime).format("YYYY-MM-DD"));
    }
    return map;
  }, [staffPage]);

  const staffRows = useMemo(() => {
    const items = staffPage?.items ?? [];
    const needle = keyword.trim().toLowerCase();
    const filtered = needle
      ? items.filter((s) => (s.fullName || s.userName || "").toLowerCase().includes(needle))
      : items;
    return filtered.map((s) => ({
      id: s.id,
      name: s.fullName || s.userName,
      position: s.roleNames?.[0] ?? t("Common:Staff"),
    }));
  }, [staffPage, keyword]);

  const draft = useOwnDayOffDraft({
    records: tkData?.items,
    staffCreationDates,
    today,
    currentUserId,
    canUpdate: workScheduleAbility.canUpdate,
  });

  const handleMonthPrev = () => {
    setBuilderMonth((m) => m.subtract(1, "month"));
    draft.reset();
  };

  const handleMonthNext = () => {
    setBuilderMonth((m) => m.add(1, "month"));
    draft.reset();
  };

  const handleConfirmSave = async () => {
    try {
      await bulkRegister.mutateAsync({ items: draft.items });
      toast.success(t("Timekeeping:ScheduleSavedCells", draft.items.length));
      draft.reset();
    } catch (error) {
      notifyError(extractApiError(error));
    }
    setConfirmOpen(false);
  };

  const loading = tkLoading || staffLoading;

  return (
    <div className="wsb-wrap">
      <div className="wsb-toolbar">
        <div className="wsb-toolbar-left">
          <Button icon={<LeftOutlined />} onClick={onBack}>
            {t("Timekeeping:GoBack")}
          </Button>

          <div className="wsb-toolbar-search">
            <FloatingLabel label={t("Timekeeping:SearchStaff")} floated={Boolean(keyword)}>
              <Input
                prefix={<SearchOutlined style={{ color: "#99a0bd" }} />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
                maxLength={100}
              />
            </FloatingLabel>
          </div>

          <div className="wsb-month-nav">
            <button
              type="button"
              className="wsb-month-nav-btn"
              onClick={handleMonthPrev}
              aria-label={t("Timekeeping:PrevMonth")}
            >
              <ChevronLeftIcon />
            </button>
            <span className="wsb-month-nav-label">
              {t("Common:Month")} {builderMonth.month() + 1}
            </span>
            <button
              type="button"
              className="wsb-month-nav-btn"
              onClick={handleMonthNext}
              aria-label={t("Timekeeping:NextMonth")}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        <div className="wsb-toolbar-actions">
          <Button
            icon={<UndoOutlined />}
            disabled={!draft.hasChanges || bulkRegister.isPending}
            onClick={draft.reset}
          >
            {t("Timekeeping:Reset")}
          </Button>
          {workScheduleAbility.canUpdate && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!draft.hasChanges}
              loading={bulkRegister.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t("Timekeeping:SaveChanges")}
            </Button>
          )}
        </div>
      </div>

      <div className="wsb-legend-bar">
        <div className="wsb-legend-items">
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#0e9f6e" }} />
            {t("Timekeeping:Work")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#cf3c41" }} />
            {t("Timekeeping:DayOff")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#d98b0f" }} />
            {t("Timekeeping:UnannounceAbsentLong")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-half">
              <SunIcon />
              <MoonIcon />
            </span>
            {t("Timekeeping:HalfDayLong")}
          </span>
        </div>
      </div>

      <div className="wsb-help">
        <strong style={{ color: "#0e9f6e" }}>{t("Timekeeping:Work")}</strong>
        {" / "}
        <strong style={{ color: "#7c5ce0" }}>{t("Timekeeping:HalfDay")}</strong>
        {" "}
        {t("Timekeeping:WorkLegendHint")}
      </div>

      <div className="wsb-table-area">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
            <Spin />
          </div>
        ) : (
          <WorkScheduleTable
            month={builderMonth}
            staff={staffRows}
            getCellKind={draft.getCellKind}
            isCellEditable={draft.isCellEditable}
            onCellClick={draft.toggleCell}
          />
        )}
      </div>

      <Modal
        open={confirmOpen}
        title={t("Timekeeping:SaveScheduleTitle")}
        width={450}
        onCancel={() => setConfirmOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfirmOpen(false)}>
            {t("Common:Cancel")}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={bulkRegister.isPending}
            onClick={handleConfirmSave}
          >
            {t("Timekeeping:ConfirmSave")}
          </Button>,
        ]}
      >
        <p>{t("Timekeeping:ConfirmSaveAll")}</p>
        <p>
          <strong>{t("Common:Month")} {builderMonth.month() + 1} / {builderMonth.year()}</strong>?
        </p>
      </Modal>
    </div>
  );
}
