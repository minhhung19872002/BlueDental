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
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { brand } from "@/theme/index";
import { KpiCard } from "../components/KpiCard";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { DoctorsOnDutyCard } from "../components/DoctorsOnDutyCard";
import { LowStockCard } from "../components/LowStockCard";
import { CareStatsCard } from "../components/CareStatsCard";
import { PatientInsightCard } from "../components/PatientInsightCard";
import { OngoingReceptionsCard } from "../components/OngoingReceptionsCard";
import { AppointmentEditorModal } from "@/features/appointments";
import { t } from "@/lib/i18n";

export function DashboardPage() {
  const navigate = useNavigate();
  const [newApptOpen, setNewApptOpen] = useState(false);
  const appointmentAbility = useAbility("appointment");
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
      {/* The design pairs the title with an outline export and a solid
          create action. Both go somewhere real: the report screen owns the
          exports, and the appointment editor is the same one the calendar
          opens. */}
      <PageHeader
        title={t("Dashboard:PageTitle")}
        subtitle={dayjs().format("dddd, DD/MM/YYYY")}
        actions={
          <>
            <Button onClick={() => navigate("/report")}>{t("Dashboard:ExportReport")}</Button>
            {appointmentAbility.canCreate && (
              <Button type="primary" onClick={() => setNewApptOpen(true)}>
                + {t("Dashboard:CreateAppointment")}
              </Button>
            )}
          </>
        }
      />

      <div className="kpi-grid">
        <KpiCard
          label={t("Dashboard:KpiRevenue")}
          value={`${formatVND(stat?.totalActualReceived ?? 0)} ₫`}
          sub={t("Dashboard:KpiRevenueSubtitle")}
          icon={<BarChartOutlined />}
          color={brand.blue}
          loading={statLoading}
        />
        <KpiCard
          label={t("Dashboard:KpiVisits")}
          value={newPatients}
          sub={t("Dashboard:KpiVisitsSubtitle")}
          icon={<TeamOutlined />}
          color={brand.gold}
          loading={statLoading}
        />
        <KpiCard
          label={t("Dashboard:KpiAppointments")}
          value={appts?.totalCount ?? 0}
          sub={t("Dashboard:KpiAppointmentsSubtitle", awaiting)}
          icon={<CalendarOutlined />}
          color={brand.goldDeep}
          loading={apptLoading}
        />
        <KpiCard
          label={t("Dashboard:KpiDebt")}
          value={`${formatVND(stat?.totalOutstandingDebt ?? 0)} ₫`}
          sub={t("Dashboard:KpiDebtSubtitle")}
          icon={<WalletOutlined />}
          color={brand.red}
          loading={statLoading}
        />
      </div>

      <div className="dash-split">
        <RevenueBarChart />
        <DoctorsOnDutyCard />
      </div>

      <div className="dash-trio">
        <CareStatsCard />
        <PatientInsightCard />
        <LowStockCard />
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
