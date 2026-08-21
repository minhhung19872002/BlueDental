import React, { useState } from "react";
import { message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionTable } from "../components/ReceptionTable";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
} from "../api/receptionQueries";
import { useUpdateReceptionStatus } from "../api/receptionMutations";
import type { ReceptionStatus, ReceptionFilter } from "../types/reception";

type ViewMode = "day" | "week" | "month";

export const ReceptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReceptionStatus>("All");
  const [keyword, setKeyword] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

  const filter: ReceptionFilter = {
    status: activeTab,
    keyword,
    doctorId: selectedDoctorId,
    date: currentDate.format("YYYY-MM-DD"),
  };

  const { data: listData, isLoading: listLoading } = useReceptionList(filter);
  const { data: metrics } = useReceptionMetrics();
  const { data: doctors = [] } = useReceptionDoctors();
  const updateStatusMutation = useUpdateReceptionStatus();

  const handleStatusChange = (id: string, newStatus: ReceptionStatus) => {
    updateStatusMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          message.success("Cập nhật trạng thái tiếp nhận thành công!");
        },
        onError: (err) => {
          message.error(err.message || "Cập nhật trạng thái thất bại");
        },
      },
    );
  };

  const items = listData?.items ?? [];

  return (
    <div className="reception-page">
      <div className="reception-card">
        {/* Row 1: Toolbar — time tabs + date nav + search + create */}
        <ReceptionToolbar
          keyword={keyword}
          viewMode={viewMode}
          currentDate={currentDate}
          onSearchChange={setKeyword}
          onDoctorSelect={setSelectedDoctorId}
          onCreateClick={() => setDrawerOpen(true)}
          onViewModeChange={setViewMode}
          onDateChange={setCurrentDate}
        />

        {/* Row 2: Status tabs + doctor filter + counter cards */}
        <ReceptionStatusTabs
          activeTab={activeTab}
          metrics={metrics}
          selectedDoctorId={selectedDoctorId}
          doctors={doctors}
          onChange={setActiveTab}
          onDoctorSelect={setSelectedDoctorId}
        />

        {/* Content: table or empty state */}
        <div className="reception-content">
          {items.length === 0 && !listLoading ? (
            <ReceptionEmptyState />
          ) : (
            <ReceptionTable
              items={items}
              loading={listLoading}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      <ReceptionNewDrawer
        open={drawerOpen}
        doctors={doctors}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default ReceptionPage;
