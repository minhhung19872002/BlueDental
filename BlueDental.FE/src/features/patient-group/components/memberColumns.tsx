import { Link } from "react-router-dom";
import { Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { relationLabel } from "@/utils/patientRelation";
import { GROUP_KIND, GROUP_ROLE, type GroupKind, type PatientGroupMemberDto } from "../types";

const MALE = 1;
const FEMALE = 2;

/** A Tiểu sử bệnh entry worth a red flag — allergies, first of all. */
const isAlert = (name: string) => /dị ứng|allerg/i.test(name);

const ageOf = (dateOfBirth: string | null) =>
  dateOfBirth ? new Date().getFullYear() - new Date(dateOfBirth).getFullYear() : null;

const genderLabel = (gender: number) =>
  gender === MALE ? t("PatientGroup:Gender:Male") : gender === FEMALE ? t("PatientGroup:Gender:Female") : "—";

/** The group dialog's member table: what a dentist looks up first, each name opening the record. */
export function memberColumns(kind: GroupKind): ColumnsType<PatientGroupMemberDto> {
  return [
    {
      title: t("PatientGroup:Col:Member"),
      key: "member",
      fixed: "left",
      width: 200,
      render: (_, m) => (
        <span className="pg-member">
          <Link to={`/patient/${m.patientId}`}>{m.fullName}</Link>
          <small>{m.patientCode}</small>
        </span>
      ),
    },
    {
      title: t("PatientGroup:Col:Role"),
      key: "role",
      width: 140,
      render: (_, m) =>
        m.role === GROUP_ROLE.Head ? (
          <Tag color="gold">{t(kind === GROUP_KIND.Family ? "PatientGroup:Role:HeadFamily" : "PatientGroup:Role:HeadOther")}</Tag>
        ) : m.relationToHead ? (
          relationLabel(m.relationToHead, m.gender)
        ) : (
          t("PatientGroup:Role:Member")
        ),
    },
    {
      title: t("PatientGroup:Col:AgeGender"),
      key: "age",
      width: 120,
      render: (_, m) => {
        const age = ageOf(m.dateOfBirth);
        return `${age !== null ? t("PatientRelation:Age", age) : "—"} · ${genderLabel(m.gender)}`;
      },
    },
    {
      title: t("PatientGroup:Col:History"),
      key: "history",
      width: 260,
      render: (_, m) =>
        m.diseaseHistory.length === 0 ? (
          <span className="pg-muted">{t("PatientGroup:NoHistory")}</span>
        ) : (
          <span className="pg-tags">
            {m.diseaseHistory.map((name) => (
              <Tag key={name} color={isAlert(name) ? "red" : "default"}>
                {name}
              </Tag>
            ))}
          </span>
        ),
    },
    {
      title: t("PatientGroup:Col:LastVisit"),
      dataIndex: "lastVisitAt",
      width: 120,
      render: (v: string | null) => (v ? formatDate(v) : "—"),
    },
    {
      title: t("PatientGroup:Col:NextAppointment"),
      dataIndex: "nextAppointmentAt",
      width: 130,
      render: (v: string | null) => (v ? formatDate(v) : "—"),
    },
    {
      title: t("PatientGroup:Col:Debt"),
      dataIndex: "totalDebt",
      width: 130,
      align: "right",
      render: (v: number) => (v > 0 ? <span className="pg-debt">{formatMoneyUnit(v)}</span> : formatMoneyUnit(0)),
    },
  ];
}
