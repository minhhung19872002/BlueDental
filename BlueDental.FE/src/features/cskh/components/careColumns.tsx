import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDash, formatDate, formatDateTime } from "@/utils/format";
import {
  careAppointmentStatusLabels,
  careStatusLabels,
  type CareRecordDto,
} from "../api/careApi";
import type { CareTabConfig, CareTabKey } from "../careTabs";
import { PatientCell } from "./PatientCell";
import { CareNoteCell } from "./CareNoteCell";
import { CareRowActions } from "./CareRowActions";

export interface CareRowHandlers {
  onCall: (record: CareRecordDto) => void;
  onMessage: (record: CareRecordDto) => void;
  onSend: (record: CareRecordDto) => void;
  onCare: (record: CareRecordDto) => void;
  onNote: (record: CareRecordDto, note: string) => void;
}

type CareColumn = ColumnsType<CareRecordDto>[number];

/** The columns every tab composes from; built fresh so t() stays live. */
interface SharedColumns {
  patient: CareColumn;
  phone: CareColumn;
  doctor: CareColumn;
  careStaff: CareColumn;
  upcoming: CareColumn;
  status: CareColumn;
  note: CareColumn;
  actions: CareColumn;
}

/** 28px round buttons with a 2px gap, inside the cell's 16px paddings. */
export function actionsColumnWidth(buttonCount: number): number {
  return 32 + buttonCount * 28 + (buttonCount - 1) * 2;
}

const careDateColumn = (): CareColumn => ({
  title: t("CSKH:Col:CareDate"),
  key: "careDate",
  width: 130,
  render: (_, record) => (record.dueAt ? formatDate(record.dueAt) : "—"),
});

const appointmentColumn = (): CareColumn => ({
  title: t("CSKH:Col:Appointment"),
  key: "appointment",
  width: 150,
  render: (_, record) => (record.dueAt ? formatDateTime(record.dueAt) : "—"),
});

const appointmentContentColumn = (): CareColumn => ({
  title: t("CSKH:Col:AppointmentContent"),
  dataIndex: "appointmentContent",
  key: "appointmentContent",
  width: 200,
  render: formatDash,
});

const appointmentStatusColumn = (): CareColumn => ({
  title: t("CSKH:Col:AppointmentStatus"),
  key: "appointmentStatus",
  width: 150,
  render: (_, record) =>
    record.appointmentStatus
      ? careAppointmentStatusLabels()[record.appointmentStatus]
      : "—",
});

const careScheduleColumn = (): CareColumn => ({
  title: t("CSKH:Col:CareAppointment"),
  key: "careSchedule",
  width: 150,
  render: (_, record) =>
    record.scheduledStart ? formatDateTime(record.scheduledStart) : "—",
});

const periodicColumns = (c: SharedColumns): ColumnsType<CareRecordDto> => [
  careScheduleColumn(),
  c.patient, c.phone, c.doctor, c.careStaff, c.upcoming, c.status, c.note, c.actions,
];

/** Per-tab column sets of the care board (docs/clone/pages/cskh-grouping.md). */
const COLUMNS_BY_TAB: Record<CareTabKey, (c: SharedColumns) => ColumnsType<CareRecordDto>> = {
  "after-treatment": (c) => [
    careDateColumn(),
    c.patient, c.phone, c.doctor, c.upcoming, c.status, c.note, c.actions,
  ],
  birthday: (c) => [c.patient, c.phone, c.status, c.note, c.actions],
  "remind-appointment": (c) => [
    appointmentColumn(),
    c.patient, c.phone, c.doctor, c.careStaff,
    appointmentContentColumn(),
    appointmentStatusColumn(),
    { ...c.status, title: t("CSKH:Col:CareStatus") },
    c.note, c.actions,
  ],
  "no-service": (c) => [
    careDateColumn(),
    c.patient, c.phone, c.doctor, c.careStaff, c.upcoming, c.status, c.note, c.actions,
  ],
  periodic: periodicColumns,
  special: periodicColumns,
};

export function buildCareColumns(
  tab: CareTabConfig,
  branchId: string,
  handlers: CareRowHandlers,
): ColumnsType<CareRecordDto> {
  const shared: SharedColumns = {
    patient: {
      title: t("CSKH:Col:FullName"),
      key: "patient",
      width: 220,
      render: (_, record) => (
        <PatientCell
          patientId={record.patientId}
          code={record.patientCode}
          name={record.patientName}
          gender={record.patientGender}
          dateOfBirth={record.patientDateOfBirth}
          branchId={branchId}
        />
      ),
    },
    phone: {
      title: t("CSKH:Col:PhoneNumber"),
      dataIndex: "patientPhone",
      key: "phone",
      width: 130,
      render: formatDash,
    },
    doctor: {
      title: t("CSKH:Col:DoctorTreat"),
      dataIndex: "assignedStaffName",
      key: "doctor",
      width: 160,
      render: formatDash,
    },
    careStaff: {
      title: t("CSKH:Col:CareStaff"),
      dataIndex: "careStaffName",
      key: "careStaff",
      width: 160,
      render: formatDash,
    },
    upcoming: {
      title: t("CSKH:Col:NextAppointment"),
      key: "upcoming",
      width: 150,
      render: (_, record) =>
        record.nextAppointmentAt
          ? formatDateTime(record.nextAppointmentAt)
          : t("Common:NoSchedule"),
    },
    status: {
      title: t("CSKH:Col:Status"),
      key: "status",
      width: 130,
      render: (_, record) => (
        <span className="cskh-badge">{careStatusLabels()[record.status]}</span>
      ),
    },
    note: {
      title: t("CSKH:Col:Note"),
      key: "note",
      width: 200,
      render: (_, record) => (
        <CareNoteCell
          value={record.description}
          onSave={(text) => handlers.onNote(record, text)}
        />
      ),
    },
    actions: {
      title: t("CSKH:Col:Actions"),
      key: "actions",
      width: actionsColumnWidth(2 + Number(tab.showSend) + Number(Boolean(tab.fileHeart))),
      fixed: "right",
      render: (_, record) => (
        <CareRowActions
          onCall={() => handlers.onCall(record)}
          onMessage={() => handlers.onMessage(record)}
          onSend={tab.showSend ? () => handlers.onSend(record) : undefined}
          onCare={tab.fileHeart ? () => handlers.onCare(record) : undefined}
        />
      ),
    },
  };

  return COLUMNS_BY_TAB[tab.key](shared);
}
