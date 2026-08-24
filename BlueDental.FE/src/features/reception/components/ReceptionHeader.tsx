import React, { useState } from "react";
import {
  UserPlus,
  Users,
  Calendar,
  CheckCircle,
} from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ReceptionMetrics } from "../types/reception";
import { t } from "@/lib/i18n";

interface ReceptionHeaderProps {
  metrics?: ReceptionMetrics;
  loading?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, iconBg, iconColor, label, value, loading }) => (
  <div
    className="rounded-2xl border border-[#E2E8F0] bg-white p-4"
    style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.04)" }}
  >
    <div className="flex items-center gap-4">
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ width: 46, height: 46, background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-semibold text-[#64748B]">{label}</div>
        <div className="text-2xl font-extrabold text-[#0F172A]">
          {loading ? "…" : value}
        </div>
      </div>
    </div>
  </div>
);

export const ReceptionHeader: React.FC<ReceptionHeaderProps> = ({
  metrics,
  loading = false,
}) => {
  const [viewMode, setViewMode] = useState<DateNavigatorMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top Title & Date Control Row */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#64748B] uppercase">
            {t("TỔNG QUAN")}
          </p>
          <h2 className="text-[26px] font-extrabold text-[#0F172A] m-0">
            {t("Tiếp nhận khách hàng")}
          </h2>
        </div>

        <div
          className="flex items-center flex-wrap gap-3 bg-white px-4 py-2 rounded-xl border border-[#E2E8F0]"
          style={{ boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}
        >
          <SegmentedControl
            options={[
              { key: "day" as DateNavigatorMode, label: t("Ngày") },
              { key: "week" as DateNavigatorMode, label: t("Tuần") },
              { key: "month" as DateNavigatorMode, label: t("Tháng") },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <DateNavigator
            value={currentDate}
            mode={viewMode}
            onChange={setCurrentDate}
          />
        </div>
      </div>

      {/* 4 Stat Counter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<UserPlus size={22} />}
          iconBg="rgba(38,113,216,0.1)"
          iconColor="#2671D8"
          label={t("Khách mới")}
          value={metrics?.newPatientsCount ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<Users size={22} />}
          iconBg="rgba(16,185,129,0.1)"
          iconColor="#10B981"
          label={t("Khách cũ phát sinh")}
          value={metrics?.oldPatientsCount ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<Calendar size={22} />}
          iconBg="rgba(245,158,11,0.1)"
          iconColor="#F59E0B"
          label={t("Đã hẹn")}
          value={metrics?.scheduledCount ?? 0}
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle size={22} />}
          iconBg="rgba(99,102,241,0.1)"
          iconColor="#6366F1"
          label={t("Khách đến")}
          value={metrics?.arrivedCount ?? 0}
          loading={loading}
        />
      </div>
    </div>
  );
};
