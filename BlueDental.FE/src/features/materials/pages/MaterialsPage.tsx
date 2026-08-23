import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Popconfirm, Table, Tag, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  SUPPLY_STATUS_CONFIG,
  useDeleteSupply,
  useSupplies,
  useSupplyStats,
  type SupplyDto,
  type SupplyStatus,
} from "../api/suppliesApi";
import { SupplyModal } from "../components/SupplyModal";
import { ReceiveStockModal } from "../components/ReceiveStockModal";
import {
  CATALOG_GROUP,
  useCreateTaxonomyGroupOption,
  useTaxonomyGroupOptions,
} from "@/hooks/useCatalogOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";

// ── Types ──────────────────────────────────────────────────────────────────

type MaterialsSubRoute = "clinic" | "allocation" | "department";

// ── Constants ──────────────────────────────────────────────────────────────

const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
  { key: "clinic", label: "Vật tư phòng khám" },
  { key: "allocation", label: "Phân bổ vật tư" },
  { key: "department", label: "Phòng ban" },
];

// ── Sub-views ──────────────────────────────────────────────────────────────

function ClinicMaterialsView() {
  const branchId = useCurrentBranchId();

  const [keyword, setKeyword] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupplyDto | null>(null);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState<SupplyDto | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // The reference drives the left panel from the `supplies` taxonomy group.
  const { data: groupData, isFetching: groupsFetching } = useTaxonomyGroupOptions(
    CATALOG_GROUP.Supplies,
  );
  const groups = useMemo(() => groupData ?? [], [groupData]);
  const createGroup = useCreateTaxonomyGroupOption();

  const listParams = {
    branchId,
    taxonomyId: selectedGroupId ?? undefined,
    filter: keyword.trim() || undefined,
    maxResultCount: 100,
  };
  const { data: supplyPage, isLoading } = useSupplies(listParams);
  const { data: stats } = useSupplyStats({ branchId });
  const deleteSupply = useDeleteSupply();

  // A group deleted elsewhere must not strand the table on an empty filter.
  useEffect(() => {
    if (groupsFetching) return;
    if (selectedGroupId && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, groupsFetching, selectedGroupId]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    try {
      const created = await createGroup.mutateAsync({
        group: CATALOG_GROUP.Supplies,
        name,
      });
      setSelectedGroupId(created.id);
      setGroupModalOpen(false);
      setNewGroupName("");
      message.success("Đã thêm nhóm vật tư");
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: ColumnsType<SupplyDto> = [
    { title: "Tên vật liệu", dataIndex: "name", key: "name", width: 200 },
    {
      title: "Nhóm phân loại",
      dataIndex: "taxonomyName",
      key: "taxonomyName",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Nhập kho",
      dataIndex: "stockedAt",
      key: "stockedAt",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: "Hạn sử dụng",
      dataIndex: "expiryDate",
      key: "expiryDate",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: "Cảnh báo hết hạn",
      dataIndex: "expiryWarningDays",
      key: "expiryWarningDays",
      width: 140,
      render: (days: number) => `${days} ngày`,
    },
    {
      title: "Tồn kho",
      key: "stock",
      width: 120,
      align: "right",
      render: (_, row) => `${row.quantityOnHand}${row.unit ? ` ${row.unit}` : ""}`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: SupplyStatus) => {
        const config = SUPPLY_STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "supplier",
      key: "supplier",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Xuất xứ",
      dataIndex: "origin",
      key: "origin",
      width: 120,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Giá nhập",
      dataIndex: "unitCost",
      key: "unitCost",
      width: 130,
      align: "right",
      render: (value: number | null) => (value == null ? "—" : `${formatVND(value)} đ`),
    },
    {
      title: "Giá bán",
      dataIndex: "salePrice",
      key: "salePrice",
      width: 130,
      align: "right",
      render: (value: number | null) => (value == null ? "—" : `${formatVND(value)} đ`),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 240,
      render: (_, row) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" onClick={() => setReceiveFor(row)}>
            Nhập kho
          </Button>
          <Button size="small" onClick={() => { setEditing(row); setSupplyModalOpen(true); }}>
            Chỉnh sửa
          </Button>
          <Popconfirm
            title="Xoá vật tư này?"
            okText="Xoá"
            cancelText="Huỷ"
            onConfirm={async () => {
              try {
                await deleteSupply.mutateAsync(row.id);
                message.success("Đã xoá vật tư");
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button size="small" danger>Xoá</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: material groups */}
      <div
        className="reception-card"
        style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Nhóm vật tư
            <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>
              {groups.length} nhóm
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
            Chọn nhóm để xem vật tư
          </div>
          <Input
            placeholder="Tìm nhóm vật tư..."
            size="small"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Button type="dashed" block size="small" onClick={() => setGroupModalOpen(true)}>
            Thêm Mới
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setSelectedGroupId(null)}
          style={{
            width: "100%", textAlign: "left", border: "none", cursor: "pointer",
            padding: "8px 10px", borderRadius: 6, marginTop: 8,
            background: selectedGroupId === null ? "#EBF3FE" : "transparent",
            color: selectedGroupId === null ? "#1E70E6" : "#1B2A41",
            fontWeight: selectedGroupId === null ? 600 : 400,
          }}
        >
          Tất cả nhóm
        </button>

        {filteredGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedGroupId(group.id)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between",
              border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 6,
              background: selectedGroupId === group.id ? "#EBF3FE" : "transparent",
              color: selectedGroupId === group.id ? "#1E70E6" : "#1B2A41",
              fontWeight: selectedGroupId === group.id ? 600 : 400,
              textAlign: "left",
            }}
          >
            <span>{group.name}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>{group.itemCount}</span>
          </button>
        ))}

        {groups.length === 0 && !groupsFetching && (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
            Chưa có nhóm vật tư
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card" style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Tổng vật tư", value: stats?.total ?? 0 },
            { label: "Còn hàng", value: stats?.available ?? 0 },
            { label: "Sắp hết", value: stats?.lowStock ?? 0 },
            { label: "Hết hàng", value: stats?.outOfStock ?? 0 },
            { label: "Sắp hết hạn", value: stats?.expiringSoon ?? 0 },
            { label: "Hết hạn", value: stats?.expired ?? 0 },
          ].map((tile) => (
            <div key={tile.label}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1B2A41" }}>{tile.value}</div>
              <div style={{ fontSize: 12, color: "#5A6B82" }}>{tile.label}</div>
            </div>
          ))}
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1B2A41" }}>
              {formatVND(stats?.stockValue ?? 0)} đ
            </div>
            <div style={{ fontSize: 12, color: "#5A6B82" }}>Giá trị tồn kho</div>
          </div>
        </div>

        <div className="reception-card reception-card--toolbar">
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="primary"
                onClick={() => { setEditing(null); setSupplyModalOpen(true); }}
              >
                Thêm vật tư
              </Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm kiếm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table<SupplyDto>
            columns={columns}
            dataSource={supplyPage?.items ?? []}
            loading={isLoading}
            rowKey="id"
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total}`,
            }}
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        </div>
      </div>

      <SupplyModal
        open={supplyModalOpen}
        supply={editing}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        defaultGroupId={selectedGroupId ?? undefined}
        onClose={() => { setSupplyModalOpen(false); setEditing(null); }}
      />

      <ReceiveStockModal
        open={receiveFor !== null}
        supply={receiveFor}
        onClose={() => setReceiveFor(null)}
      />

      <Modal
        open={groupModalOpen}
        title="Thêm nhóm vật tư"
        okText="Thêm"
        cancelText="Huỷ"
        confirmLoading={createGroup.isPending}
        onOk={handleCreateGroup}
        onCancel={() => { setGroupModalOpen(false); setNewGroupName(""); }}
      >
        <Input
          placeholder="Tên nhóm"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onPressEnter={handleCreateGroup}
        />
      </Modal>
    </div>
  );
}

function AllocationView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phân bổ", dataIndex: "allocatedQty", key: "allocatedQty" },
    { title: "SL confirm còn lại", dataIndex: "confirmedRemaining", key: "confirmedRemaining" },
    { title: "Phòng ban", dataIndex: "department", key: "department" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm phiếu phân bổ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button>Lịch sử kiểm kho</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total) => `Hiển thị 0 trên ${total}`,
          }}
          locale={{ emptyText: "Chưa có phiếu phân bổ" }}
          size="middle"
        />
      </div>
    </>
  );
}

function DepartmentView() {
  const [keyword, setKeyword] = useState("");

  const rightColumns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phát", dataIndex: "distributedQty", key: "distributedQty" },
    { title: "SL còn lại (đã duyệt)", dataIndex: "approvedRemaining", key: "approvedRemaining" },
    { title: "Kiểm kho", dataIndex: "inventoryCheck", key: "inventoryCheck" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: departments */}
      <div
        className="reception-card"
        style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Phòng ban
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>
            0 phòng ban
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
          Chọn phòng ban để xem vật tư đã phát và kiểm kho
        </div>
        <Input
          placeholder="Tìm phòng ban..."
          size="small"
          style={{ marginBottom: 8 }}
        />
        <Button type="dashed" block size="small">
          Tạo phòng ban
        </Button>
        <div
          style={{
            color: "#8c8c8c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          Chưa có phòng ban
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm vật tư..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button>Gộp số lượng vật tư</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={[]}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total) => `Hiển thị 0 trên ${total}`,
            }}
            locale={{ emptyText: "Chọn phòng ban để xem vật tư đã phân bổ" }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

  const renderContent = () => {
    switch (activeTab) {
      case "clinic":
        return <ClinicMaterialsView />;
      case "allocation":
        return <AllocationView />;
      case "department":
        return <DepartmentView />;
      default:
        return null;
    }
  };

  return (
    <div className="reception-page">
      {/* Horizontal sub-nav */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {SUB_ROUTES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #1677ff"
                    : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
