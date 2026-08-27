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
  onCall: (patient: CareGroupingPatientDto) => void;
  onMessage: (patient: CareGroupingPatientDto) => void;
  onCare: (patient: CareGroupingPatientDto) => void;
}

/** 12 columns of the Phân nhóm CSKH patient table. */
export function buildGroupColumns(
  branchId: string,
  handlers: GroupRowHandlers,
): ColumnsType<CareGroupingPatientDto> {
  return [
    {
      title: t("Ngày tạo hồ sơ"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: t("Họ và tên"),
      key: "patient",
      width: 220,
      render: (_, p) => (
        <div>
          <Link className="cskh-patient-link" to={`/patient/${p.id}?branchId=${branchId}`}>
            [{p.code}] - {p.name}
          </Link>
          {p.dateOfBirth && (
            <div className="cskh-patient-sub">
              {t("Ngày sinh")}: {formatDate(p.dateOfBirth)}
            </div>
          )}
        </div>
      ),
    },
    { title: t("Số điện thoại"), dataIndex: "phone", key: "phone", width: 130, render: formatDash },
    {
      title: t("Trạng thái"),
      key: "status",
      width: 130,
      render: (_, p) => (
        <span className={["cskh-badge", TREATMENT_BADGE_CLASS[p.treatmentStatus]].filter(Boolean).join(" ")}>
          {treatmentStatusLabels()[p.treatmentStatus]}
        </span>
      ),
    },
    {
      title: t("Dịch vụ"),
      key: "services",
      width: 200,
      render: (_, p) => (p.serviceNames.length ? p.serviceNames.join(", ") : "—"),
    },
    {
      title: t("Bác sĩ"),
      key: "staff",
      width: 170,
      render: (_, p) => (p.staffNames.length ? p.staffNames.join(", ") : "—"),
    },
    { title: t("Số tiền"), key: "totalAmount", width: 120, align: "right", render: (_, p) => formatVND(p.totalAmount) },
    { title: t("Thực thu"), key: "totalRevenue", width: 120, align: "right", render: (_, p) => formatVND(p.totalRevenue) },
    { title: t("Công nợ"), key: "totalDebt", width: 120, align: "right", render: (_, p) => formatVND(p.totalDebt) },
    {
      title: t("Lịch hẹn gần nhất"),
      key: "nextAppointment",
      width: 150,
      render: (_, p) => (p.nextAppointmentAt ? formatDateTime(p.nextAppointmentAt) : t("Chưa có lịch")),
    },
    {
      title: t("Lần khám cuối"),
      key: "lastVisit",
      width: 120,
      render: (_, p) => (p.lastVisitAt ? formatDate(p.lastVisitAt) : "—"),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: actionsColumnWidth(3),
      fixed: "right",
      render: (_, p) => (
        <CareRowActions
          onCall={() => handlers.onCall(p)}
          onMessage={() => handlers.onMessage(p)}
          onCare={() => handlers.onCare(p)}
        />
      ),
    },
  ];
}
