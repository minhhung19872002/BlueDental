import React, { useState } from "react";
import { message, Spin } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionCard } from "../components/ReceptionCard";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
} from "../api/receptionQueries";
import { useUpdateReceptionStatus } from "../api/receptionMutations";
import type {
  ReceptionStatus,
  ReceptionFilter,
  AppointmentOutcome,
} from "../types/reception";

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

  const handleOutcomeChange = (_id: string, _outcome: AppointmentOutcome) => {
    // TODO: wire up mutation
  };

  const handleDoctorChange = (_id: string, _doctorId: string) => {
    // TODO: wire up mutation
  };

  const handleCancel = (id: string) => {
    handleStatusChange(id, "All");
  };

  const items = listData?.items ?? [];

  return (
    <div className="reception-page">
      {/* Card 1: toolbar */}
      <div className="reception-card reception-card--toolbar">
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
      </div>

      {/* Card 2: status tabs + counters */}
      <div className="reception-card reception-card--tabs">
        <ReceptionStatusTabs
          activeTab={activeTab}
          metrics={metrics}
          selectedDoctorId={selectedDoctorId}
          doctors={doctors}
          onChange={setActiveTab}
          onDoctorSelect={setSelectedDoctorId}
        />
      </div>

      {/* Card 3: content */}
      <div className="reception-card reception-card--content">
        {listLoading ? (
          <div className="reception-loading">
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <ReceptionEmptyState />
        ) : (
          <div className="reception-card-grid">
            {items.map((item) => (
              <ReceptionCard
                key={item.id}
                item={item}
                doctors={doctors}
                onOutcomeChange={handleOutcomeChange}
                onDoctorChange={handleDoctorChange}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
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
