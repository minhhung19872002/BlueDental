import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Table } from "antd";
import type { Dayjs } from "dayjs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { CARE_TYPE, type CareRecordDto } from "../api/careApi";
import { MESSAGE_CHANNEL, type MessageChannel } from "../api/templateApi";
import type { CareDateMode, CareTabConfig } from "../careTabs";
import { sendPath } from "../templatePaths";
import { useCareBoard } from "../hooks/useCareBoard";
import { CareCounters } from "./CareCounters";
import { CareToolbar } from "./CareToolbar";
import { buildCareColumns } from "./careColumns";
import { CareBoardDialogs } from "./CareBoardDialogs";

const NARROW_SCREEN = "(max-width: 640px)";

interface CareBoardProps {
  branchId: string;
  tab: CareTabConfig;
  mode: CareDateMode;
  date: Dayjs;
  /** The Ngày/Tuần/Tháng control, shown left of the counters on the head row. */
  dateSlot?: ReactNode;
  /** The care-type tabs, shown left of the toolbar on the tabs row. */
  tabsSlot?: ReactNode;
  /** Permission gates — hide export when false/absent, hide create when false/absent. */
  canExport?: boolean;
  canCreate?: boolean;
  /** Sau điều trị's Đã liên hệ / Chưa liên hệ dropdown is read-only without it. */
  canUpdate?: boolean;
  /** "Gửi tin nhắn › Xem": the row SMS / Zalo buttons lead to that screen. */
  canSend?: boolean;
}

/** Head row, care-type tabs + toolbar row, table and dialogs of one care tab. */
export function CareBoard({
  branchId, tab, mode, date, dateSlot, tabsSlot, canExport, canCreate, canUpdate, canSend,
}: CareBoardProps) {
  const board = useCareBoard({ branchId, tab, mode, date });
  const navigate = useNavigate();
  /* A tab whose columns fit a desktop still does not fit a phone: without a
     horizontal scroller the headers squeeze into each other. */
  const narrow = useMediaQuery(NARROW_SCREEN);

  const sendTo = (channel: MessageChannel) => (record: CareRecordDto) =>
    navigate(withBranch(sendPath({ channel, patientId: record.patientId, careRecordId: record.id }), branchId));

  const columns = buildCareColumns(tab, branchId, {
    onCall: board.handleCall,
    onSms: canSend ? sendTo(MESSAGE_CHANNEL.Sms) : undefined,
    onZalo: canSend ? sendTo(MESSAGE_CHANNEL.Zalo) : undefined,
    onCare: (record: CareRecordDto) => board.openDialog("result", record),
    onNote: board.handleNote,
    onContactStatus: board.handleContactStatus,
  }, { pendingId: board.contactPendingId, canUpdate: Boolean(canUpdate) });

  return (
    <>
      <div className="cskh-headrow">
        {dateSlot}
        <CareCounters
          model={tab.statusModel}
          byAppointment={tab.type === CARE_TYPE.AppointmentReminder || tab.type === CARE_TYPE.MissedAppointment}
          stats={board.stats.data}
          active={board.counter}
          onChange={board.handleCounterChange}
        />
      </div>

      <div className="cskh-tabsrow">
        {tabsSlot}

        <CareToolbar
          tab={tab}
          search={board.search}
          doctorId={board.doctorId}
          careStaffId={board.careStaffId}
          onSearchChange={board.setSearch}
          onDoctorChange={board.setDoctorId}
          onCareStaffChange={board.setCareStaffId}
          actions={{
            exporting: board.exporting,
            onExport: canExport ? board.handleExport : undefined,
            onCreate: canCreate ? () => board.openDialog("create") : undefined,
          }}
        />
      </div>

      <div className="cskh-table-card">
        <Table<CareRecordDto>
          rowKey="id"
          className="cskh-table"
          columns={columns}
          dataSource={board.list.data?.items ?? []}
          loading={board.list.isLoading}
          locale={{ emptyText: t("Common:NoData") }}
          scroll={tab.wideTable || narrow ? { x: "max-content" } : undefined}
          pagination={board.pagination.buildConfig(board.list.data?.totalCount)}
        />
      </div>

      <CareBoardDialogs
        tab={tab}
        dialog={board.dialog}
        selected={board.selected}
        onClose={board.closeDialog}
      />
    </>
  );
}
