import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { formatDash, formatDate, formatDateTime, formatVND } from "@/utils/format";
import {
  CARE_TREATMENT_STATUS,
  treatmentStatusLabels,
  type CareGroupingPatientDto,
  type CareTreatmentStatus,
} from "../api/careApi";
import { actionsColumnWidth } from "./careColumns";
import { CareRowActions } from "./CareRowActions";

/** Reference tints Đang điều trị blue and Hoàn tất green; Chưa phát sinh stays grey. */
const TREATMENT_BADGE_CLASS: Record<CareTreatmentStatus, string | undefined> = {
  [CARE_TREATMENT_STATUS.Created]: undefined,
  [CARE_TREATMENT_STATUS.InProgress]: "cskh-badge--blue",
  [CARE_TREATMENT_STATUS.Done]: "cskh-badge--green",
};

export interface GroupRowHandlers {
  onCall: ((patient: CareGroupingPatientDto) => void) | undefined;
  onMessage: ((patient: CareGroupingPatientDto) => void) | undefined;
  onCare: ((patient: CareGroupingPatientDto) => void) | undefined;
}

/** 12 columns of the Phân nhóm CSKH patient table. */
export function buildGroupColumns(
  branchId: string,
  handlers: GroupRowHandlers,
): ColumnsType<CareGroupingPatientDto> {
  return [
    {
      title: t("CSKH:GroupCol:CreatedAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: t("CSKH:GroupCol:FullName"),
      key: "patient",
      width: 220,
      render: (_, p) => (
        <div>
          <Link className="cskh-patient-link" to={`/patient/${p.id}?branchId=${branchId}`}>
            [{p.code}] - {p.name}
          </Link>
          {p.dateOfBirth && (
            <div className="cskh-patient-sub">
              {t("CSKH:GroupCol:Birthday")}: {formatDate(p.dateOfBirth)}
            </div>
          )}
        </div>
      ),
    },
    { title: t("CSKH:GroupCol:PhoneNumber"), dataIndex: "phone", key: "phone", width: 130, render: formatDash },
    {
      title: t("CSKH:GroupCol:Status"),
      key: "status",
      width: 130,
      render: (_, p) => (
        <span className={["cskh-badge", TREATMENT_BADGE_CLASS[p.treatmentStatus]].filter(Boolean).join(" ")}>
          {treatmentStatusLabels()[p.treatmentStatus]}
        </span>
      ),
    },
    {
      title: t("CSKH:GroupCol:Service"),
      key: "services",
      width: 200,
      render: (_, p) => (p.serviceNames.length ? p.serviceNames.join(", ") : "—"),
    },
    {
      title: t("CSKH:GroupCol:Doctor"),
      key: "staff",
      width: 170,
      render: (_, p) => (p.staffNames.length ? p.staffNames.join(", ") : "—"),
    },
    { title: t("CSKH:GroupCol:Amount"), key: "totalAmount", width: 120, align: "right", render: (_, p) => formatVND(p.totalAmount) },
    { title: t("CSKH:GroupCol:Revenue"), key: "totalRevenue", width: 120, align: "right", render: (_, p) => formatVND(p.totalRevenue) },
    { title: t("CSKH:GroupCol:Debt"), key: "totalDebt", width: 120, align: "right", render: (_, p) => formatVND(p.totalDebt) },
    {
      title: t("CSKH:GroupCol:NextAppointment"),
      key: "nextAppointment",
      width: 150,
      render: (_, p) => (p.nextAppointmentAt ? formatDateTime(p.nextAppointmentAt) : t("Common:NoSchedule")),
    },
    {
      title: t("CSKH:GroupCol:LastVisit"),
      key: "lastVisit",
      width: 120,
      render: (_, p) => (p.lastVisitAt ? formatDate(p.lastVisitAt) : "—"),
    },
    {
      title: t("CSKH:GroupCol:Actions"),
      key: "actions",
      width: actionsColumnWidth(3),
      fixed: "right",
      render: (_, p) => (
        <CareRowActions
          onCall={handlers.onCall ? () => handlers.onCall!(p) : undefined}
          onMessage={handlers.onMessage ? () => handlers.onMessage!(p) : undefined}
          onCare={handlers.onCare ? () => handlers.onCare!(p) : undefined}
        />
      ),
    },
  ];
}
