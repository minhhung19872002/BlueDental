import type { ReactNode } from "react";
import { Table } from "antd";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { CareRecordDto } from "../api/careApi";
import type { CareDateMode, CareTabConfig } from "../careTabs";
import { useCareBoard } from "../hooks/useCareBoard";
import { CareCounters } from "./CareCounters";
import { CareToolbar } from "./CareToolbar";
import { buildCareColumns } from "./careColumns";
import { CareBoardDialogs } from "./CareBoardDialogs";

interface CareBoardProps {
  branchId: string;
  tab: CareTabConfig;
  mode: CareDateMode;
  date: Dayjs;
  /** The Ngày/Tuần/Tháng control, shown left of the counters on the head row. */
  dateSlot?: ReactNode;
  /** The care-type tabs, shown left of the toolbar on the tabs row. */
  tabsSlot?: ReactNode;
}

/** Head row, care-type tabs + toolbar row, table and dialogs of one care tab. */
export function CareBoard({ branchId, tab, mode, date, dateSlot, tabsSlot }: CareBoardProps) {
  const board = useCareBoard({ branchId, tab, mode, date });

  const columns = buildCareColumns(tab, branchId, {
    onCall: board.handleCall,
    onMessage: (record: CareRecordDto) => board.openDialog("message", record),
    onSend: (record: CareRecordDto) => board.openDialog("send", record),
    onCare: (record: CareRecordDto) => board.openDialog("result", record),
    onNote: board.handleNote,
  });

  return (
    <>
      <div className="cskh-headrow">
        {dateSlot}
        <CareCounters
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
          exporting={board.exporting}
          onSearchChange={board.setSearch}
          onDoctorChange={board.setDoctorId}
          onCareStaffChange={board.setCareStaffId}
          onExport={board.handleExport}
          onCreate={() => board.openDialog("create")}
        />
      </div>

      <div className="cskh-table-card">
        <Table<CareRecordDto>
          rowKey="id"
          className="cskh-table"
          columns={columns}
          dataSource={board.list.data?.items ?? []}
          loading={board.list.isLoading}
          locale={{ emptyText: t("Không có dữ liệu") }}
          scroll={tab.wideTable ? { x: "max-content" } : undefined}
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
