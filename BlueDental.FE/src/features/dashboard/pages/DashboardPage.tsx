import { useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { Button } from "antd";
import {
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { usePaymentStat } from "@/features/report/api/clinicReportApi";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatVND } from "@/utils/format";
import { brand } from "@/theme/index";
import { KpiCard } from "../components/KpiCard";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { DoctorsOnDutyCard } from "../components/DoctorsOnDutyCard";
import { LowStockCard } from "../components/LowStockCard";
import { OngoingReceptionsCard } from "../components/OngoingReceptionsCard";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { t } from "@/lib/i18n";

export function DashboardPage() {
  const navigate = useNavigate();
  const [newApptOpen, setNewApptOpen] = useState(false);
  const today = dayjs().format("YYYY-MM-DD");
  const branchId = useCurrentBranchId();

  const { data: stat, isLoading: statLoading } = usePaymentStat({
    clinicBranchId: branchId,
    fromDate: today,
    toDate: today,
  });
  const { data: appts, isLoading: apptLoading } = useAppointmentList({
    date: today,
    maxResultCount: 200,
  });

  const items = appts?.items ?? [];
  const awaiting = items.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed",
  ).length;
  const newPatients = stat?.patientVisits ?? 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("Tổng quan hôm nay")}</h1>
          <p className="page-header-subtitle">
            {dayjs().format("dddd, DD/MM/YYYY")}
          </p>
        </div>
        {/* The design pairs the title with an outline export and a solid
            create action. Both go somewhere real: the report screen owns the
            exports, and the appointment editor is the same one the calendar
            opens. */}
        <div className="page-header-actions">
          <Button onClick={() => navigate("/report")}>{t("Xuất báo cáo")}</Button>
          <Button type="primary" onClick={() => setNewApptOpen(true)}>
            + {t("Tạo lịch hẹn")}
          </Button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label={t("Doanh số hôm nay")}
          value={`${formatVND(stat?.totalActualReceived ?? 0)} ₫`}
          sub={t("Thực thu trong ngày")}
          icon={<BarChartOutlined />}
          color={brand.blue}
          loading={statLoading}
        />
        <KpiCard
          label={t("Lượt khách")}
          value={newPatients}
          sub={t("Lượt khám ghi nhận hôm nay")}
          icon={<TeamOutlined />}
          color={brand.gold}
          loading={statLoading}
        />
        <KpiCard
          label={t("Lịch hẹn")}
          value={appts?.totalCount ?? 0}
          sub={t("{0} chờ đến", awaiting)}
          icon={<CalendarOutlined />}
          color={brand.goldDeep}
          loading={apptLoading}
        />
        <KpiCard
          label={t("Công nợ tồn")}
          value={`${formatVND(stat?.totalOutstandingDebt ?? 0)} ₫`}
          sub={t("Chưa thu trong ngày")}
          icon={<WalletOutlined />}
          color={brand.red}
          loading={statLoading}
        />
      </div>

      <div className="dash-split">
        <RevenueBarChart />
        <div className="dash-side">
          <DoctorsOnDutyCard />
          <LowStockCard />
        </div>
      </div>

      <OngoingReceptionsCard />

      <AppointmentEditorModal
        open={newApptOpen}
        initialDate={today}
        onClose={() => setNewApptOpen(false)}
        onSuccess={() => setNewApptOpen(false)}
      />
    </div>
  );
}
