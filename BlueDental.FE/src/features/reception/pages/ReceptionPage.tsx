import React, { useState } from "react";
import { Button, message, Spin } from "antd";
import { DownloadOutlined, FormOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionGrid } from "../components/ReceptionGrid";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
} from "../api/receptionQueries";
import { useUpdateReceptionStatus, useUpdateReceptionOutcome, useUpdateReceptionDoctor } from "../api/receptionMutations";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { exportToExcel } from "@/utils/exportExcel";
import { formatClock, formatVND } from "@/utils/format";
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
    viewMode,
  };

  const { data: listData, isLoading: listLoading } = useReceptionList(filter);
  // The counters read the same window as the list, minus the status tab.
  const { data: metrics } = useReceptionMetrics({ date: filter.date, viewMode });
  const { data: doctors = [] } = useReceptionDoctors();
  const updateStatusMutation = useUpdateReceptionStatus();
  const updateOutcomeMutation = useUpdateReceptionOutcome();
  const updateDoctorMutation = useUpdateReceptionDoctor();

  const handleStatusChange = (id: string, newStatus: ReceptionStatus) => {
    updateStatusMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          message.success(t("Cập nhật trạng thái tiếp nhận thành công!"));
        },
        onError: (err) => {
          message.error(err.message || t("Cập nhật trạng thái thất bại"));
        },
      },
    );
  };

  const handleOutcomeChange = (id: string, outcome: AppointmentOutcome) => {
    updateOutcomeMutation.mutate({ id, outcome });
  };

  const handleDoctorChange = (id: string, doctorId: string) => {
    updateDoctorMutation.mutate({ id, doctorId });
  };

  const handleCancel = (id: string) => {
    handleStatusChange(id, "All");
  };

  const items = listData?.items ?? [];

  // The design's "Xuất file" writes the rows currently on screen, so the
  // export follows whatever tab, date, doctor and search are in effect.
  const handleExport = () => {
    exportToExcel(
      items,
      [
        {
          header: t("Giờ"),
          key: "arrivalTime",
          format: (v) => (typeof v === "string" ? formatClock(v) : ""),
        },
        { header: t("Khách hàng"), key: "patientName" },
        { header: t("Số điện thoại"), key: "patientPhone" },
        {
          header: t("Dịch vụ"),
          key: "services",
          format: (v) => (Array.isArray(v) ? v.join(", ") : ""),
        },
        { header: t("Bác sĩ"), key: "doctorName" },
        { header: t("Trạng thái"), key: "status" },
        {
          header: t("Còn phải thu"),
          key: "totalDue",
          format: (v) => formatVND(Number(v ?? 0)),
        },
      ],
      `tiep-nhan-${currentDate.format("YYYY-MM-DD")}`,
    );
  };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Tiếp nhận")}
        subtitle={t("Luồng khách trong ngày {0}", currentDate.format("DD/MM/YYYY"))}
        actions={
          <>
            <Button
              icon={<DownloadOutlined />}
              disabled={items.length === 0}
              onClick={handleExport}
            >
              {t("Xuất file")}
            </Button>
            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={() => setDrawerOpen(true)}
            >
              {t("Tạo tiếp nhận")}
            </Button>
          </>
        }
      />

      {/* Card 1: toolbar */}
      <div className="reception-card reception-card--toolbar">
        <ReceptionToolbar
          keyword={keyword}
          viewMode={viewMode}
          currentDate={currentDate}
          onSearchChange={setKeyword}
          onDoctorSelect={setSelectedDoctorId}
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

      {/* Card 3: the list, as the design draws its lists */}
      <div className="reception-card-grid-wrapper">
        {listLoading ? (
          <div className="reception-loading">
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <ReceptionEmptyState />
        ) : (
          <ReceptionGrid
            items={items}
            doctors={doctors}
            onOutcomeChange={handleOutcomeChange}
            onDoctorChange={handleDoctorChange}
            onCancel={handleCancel}
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
