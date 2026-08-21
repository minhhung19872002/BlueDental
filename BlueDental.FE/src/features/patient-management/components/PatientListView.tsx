import { useState } from "react";
import { Table, Input, Button, Tag, Space, Avatar, type TableColumnsType } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { usePatientList } from "../api/patientQueries";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate } from "@/utils/format";
import type { PatientListItem, Gender } from "../types/patient";
import { brand } from "@/theme/index";

const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

interface Props {
  onAdd?: () => void;
  onRowClick?: (patient: PatientListItem) => void;
}

export function PatientListView({ onAdd, onRowClick }: Props) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword);
  const pagination = useTablePagination(20);

  const { data, isLoading } = usePatientList({
    keyword: debouncedKeyword || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const columns: TableColumnsType<PatientListItem> = [
    {
      title: "Bệnh nhân",
      key: "name",
      render: (_, record) => (
        <Space>
          <Avatar
            size={32}
            style={{ backgroundColor: brand.blue, fontSize: 12, fontWeight: 700 }}
          >
            {record.fullName
              .split(" ")
              .map((w) => w[0])
              .slice(-2)
              .join("")
              .toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{record.fullName}</div>
            <div style={{ fontSize: 11.5, color: brand.muted }}>{record.code}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "Giới tính",
      dataIndex: "gender",
      key: "gender",
      width: 90,
      render: (gender: Gender) => GENDER_LABELS[gender] ?? gender,
    },
    {
      title: "Ngày sinh",
      dataIndex: "dateOfBirth",
      key: "dateOfBirth",
      width: 120,
      render: formatDate,
    },
    {
      title: "Điện thoại",
      dataIndex: "phone",
      key: "phone",
      width: 130,
    },
    {
      title: "Khám gần nhất",
      dataIndex: "lastVisitAt",
      key: "lastVisitAt",
      width: 130,
      render: (v: string | null) => (v ? formatDate(v) : <Tag color="default">Chưa có</Tag>),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Bệnh nhân</h1>
          <p className="page-header-subtitle">
            Quản lý hồ sơ bệnh nhân của phòng khám
          </p>
        </div>
        <div className="page-header-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAdd}
          >
            Thêm bệnh nhân
          </Button>
        </div>
      </div>

      <div className="page-card">
        <div className="filter-toolbar" style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên, mã hoặc số điện thoại..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ maxWidth: 320 }}
            allowClear
          />
        </div>

        <Table<PatientListItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isLoading}
          pagination={pagination.buildConfig(
            data?.totalCount,
            (total) => `${total} bệnh nhân`,
          )}
          onRow={(record) => ({
            onClick: () => onRowClick?.(record),
            style: { cursor: "pointer" },
          })}
          scroll={{ x: 700 }}
        />
      </div>
    </div>
  );
}
