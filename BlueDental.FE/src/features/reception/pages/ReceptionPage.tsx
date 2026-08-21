import React, { useState } from "react";
import { message } from "antd";
import { ReceptionHeader } from "../components/ReceptionHeader";
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

export const ReceptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReceptionStatus>("All");
  const [keyword, setKeyword] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filter: ReceptionFilter = {
    status: activeTab,
    keyword,
    doctorId: selectedDoctorId,
  };

  const { data: listData, isLoading: listLoading } = useReceptionList(filter);
  const { data: metrics, isLoading: metricsLoading } = useReceptionMetrics();
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
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <ReceptionHeader metrics={metrics} loading={metricsLoading} />

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 4px 24px rgba(15, 23, 42, 0.04)",
          border: "1px solid #E2E8F0",
        }}
      >
        <ReceptionToolbar
          keyword={keyword}
          selectedDoctorId={selectedDoctorId}
          doctors={doctors}
          onSearchChange={setKeyword}
          onDoctorSelect={setSelectedDoctorId}
          onCreateClick={() => setDrawerOpen(true)}
        />

        <ReceptionStatusTabs
          activeTab={activeTab}
          metrics={metrics}
          onChange={setActiveTab}
        />

        {items.length === 0 && !listLoading ? (
          <ReceptionEmptyState onCreateClick={() => setDrawerOpen(true)} />
        ) : (
          <ReceptionTable
            items={items}
            loading={listLoading}
            onStatusChange={handleStatusChange}
          />
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
