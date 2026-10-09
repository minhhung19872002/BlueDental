import { Button, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { GROUP_KIND, type PatientGroupDto } from "../types";

export interface GroupRowActions {
  onView: (group: PatientGroupDto) => void;
  onEdit?: (group: PatientGroupDto) => void;
  onDelete?: (group: PatientGroupDto) => void;
}

/** The Hồ sơ nhóm list; the sticky Thao tác column opens, edits or deletes a group. */
export function groupColumns({ onView, onEdit, onDelete }: GroupRowActions): ColumnsType<PatientGroupDto> {
  return [
    { title: t("PatientGroup:Field:Name"), dataIndex: "name", fixed: "left", width: 220, render: (v: string) => <b>{v}</b> },
    {
      title: t("PatientGroup:Field:Kind"),
      dataIndex: "kind",
      width: 120,
      render: (kind: number) => (
        <Tag color={kind === GROUP_KIND.Family ? "green" : "blue"}>
          {t(kind === GROUP_KIND.Family ? "PatientGroup:Kind:Family" : "PatientGroup:Kind:Other")}
        </Tag>
      ),
    },
    { title: t("PatientGroup:Col:Head"), dataIndex: "headName", width: 180, render: (v: string | null) => v ?? "—" },
    {
      title: t("PatientGroup:Field:Members"),
      key: "members",
      width: 320,
      ellipsis: true,
      render: (_, g) => (
        <span title={g.memberNames.join(", ")}>
          <b>{g.memberCount}</b> · {g.memberNames.join(", ")}
        </span>
      ),
    },
    {
      title: t("PatientGroup:Field:SharedMedicalNote"),
      dataIndex: "sharedMedicalNote",
      width: 260,
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
    { title: t("PatientGroup:Col:Created"), dataIndex: "creationTime", width: 120, render: (v: string) => formatDate(v) },
    {
      title: t("Common:Actions"),
      key: "actions",
      fixed: "right",
      width: 150,
      align: "center",
      render: (_, g) => (
        <span className="pg-row-actions">
          <Button size="small" icon={<EyeOutlined />} aria-label={t("PatientGroup:ViewGroup", g.name)} onClick={() => onView(g)}>
            {t("PatientGroup:View")}
          </Button>
          {onEdit ? (
            <Tooltip title={t("Common:Edit")}>
              <Button type="text" size="small" icon={<EditOutlined />} aria-label={t("Common:Edit")} onClick={() => onEdit(g)} />
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip title={t("Common:Delete")}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t("Common:Delete")} onClick={() => onDelete(g)} />
            </Tooltip>
          ) : null}
        </span>
      ),
    },
  ];
}
