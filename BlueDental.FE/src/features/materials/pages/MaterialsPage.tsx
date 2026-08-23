import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Popconfirm, Table, Tag, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  supplyStatusConfig,
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
import { t } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────

type MaterialsSubRoute = "clinic" | "allocation" | "department";

// ── Constants ──────────────────────────────────────────────────────────────

const subRoutes = (): { key: MaterialsSubRoute; label: string }[] => [
  { key: "clinic", label: t("Vật tư phòng khám") },
  { key: "allocation", label: t("Phân bổ vật tư") },
  { key: "department", label: t("Phòng ban") },
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
      message.success(t("Đã thêm nhóm vật tư"));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: ColumnsType<SupplyDto> = [
    { title: t("Tên vật liệu"), dataIndex: "name", key: "name", width: 200 },
    {
      title: t("Nhóm phân loại"),
      dataIndex: "taxonomyName",
      key: "taxonomyName",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Nhập kho"),
      dataIndex: "stockedAt",
      key: "stockedAt",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Hạn sử dụng"),
      dataIndex: "expiryDate",
      key: "expiryDate",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Cảnh báo hết hạn"),
      dataIndex: "expiryWarningDays",
      key: "expiryWarningDays",
      width: 140,
      render: (days: number) => t("{0} ngày", days),
    },
    {
      title: t("Tồn kho"),
      key: "stock",
      width: 120,
      align: "right",
      render: (_, row) => `${row.quantityOnHand}${row.unit ? ` ${row.unit}` : ""}`,
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: SupplyStatus) => {
        const config = supplyStatusConfig()[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t("Nhà cung cấp"),
      dataIndex: "supplier",
      key: "supplier",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Xuất xứ"),
      dataIndex: "origin",
      key: "origin",
      width: 120,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Giá nhập"),
      dataIndex: "unitCost",
      key: "unitCost",
      width: 130,
      align: "right",
      render: (value: number | null) => (value == null ? "—" : t("{0} đ", formatVND(value))),
    },
    {
      title: t("Giá bán"),
      dataIndex: "salePrice",
      key: "salePrice",
      width: 130,
      align: "right",
      render: (value: number | null) => (value == null ? "—" : t("{0} đ", formatVND(value))),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 240,
      render: (_, row) => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" onClick={() => setReceiveFor(row)}>
            {t("Nhập kho")}
          </Button>
          <Button size="small" onClick={() => { setEditing(row); setSupplyModalOpen(true); }}>
            {t("Chỉnh sửa")}
          </Button>
          <Popconfirm
            title={t("Xoá vật tư này?")}
            okText={t("Xoá")}
            cancelText={t("Huỷ")}
            onConfirm={async () => {
              try {
                await deleteSupply.mutateAsync(row.id);
                message.success(t("Đã xoá vật tư"));
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button size="small" danger>{t("Xoá")}</Button>
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
            {t("Nhóm vật tư")}
            <span style={{ fontWeight: 400, color: "#7d8a9c", marginLeft: 6 }}>
              {groups.length} {t("nhóm")}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#7d8a9c", marginBottom: 10 }}>
            {t("Chọn nhóm để xem vật tư")}
          </div>
          <Input
            placeholder={t("Tìm nhóm vật tư...")}
            size="small"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Button type="dashed" block size="small" onClick={() => setGroupModalOpen(true)}>
            {t("Thêm Mới")}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setSelectedGroupId(null)}
          style={{
            width: "100%", textAlign: "left", border: "none", cursor: "pointer",
            padding: "8px 10px", borderRadius: 6, marginTop: 8,
            background: selectedGroupId === null ? "#eaf0fa" : "transparent",
            color: selectedGroupId === null ? "#1c3566" : "#101c2c",
            fontWeight: selectedGroupId === null ? 600 : 400,
          }}
        >
          {t("Tất cả nhóm")}
        </button>

        {filteredGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedGroupId(group.id)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between",
              border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 6,
              background: selectedGroupId === group.id ? "#eaf0fa" : "transparent",
              color: selectedGroupId === group.id ? "#1c3566" : "#101c2c",
              fontWeight: selectedGroupId === group.id ? 600 : 400,
              textAlign: "left",
            }}
          >
            <span>{group.name}</span>
            <span style={{ fontSize: 12, color: "#98a4b4" }}>{group.itemCount}</span>
          </button>
        ))}

        {groups.length === 0 && !groupsFetching && (
          <div style={{ color: "#7d8a9c", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
            {t("Chưa có nhóm vật tư")}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card" style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: t("Tổng vật tư"), value: stats?.total ?? 0 },
            { label: t("Còn hàng"), value: stats?.available ?? 0 },
            { label: t("Sắp hết"), value: stats?.lowStock ?? 0 },
            { label: t("Hết hàng"), value: stats?.outOfStock ?? 0 },
            { label: t("Sắp hết hạn"), value: stats?.expiringSoon ?? 0 },
            { label: t("Hết hạn"), value: stats?.expired ?? 0 },
          ].map((tile) => (
            <div key={tile.label}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#101c2c" }}>{tile.value}</div>
              <div style={{ fontSize: 12, color: "#6f7c90" }}>{tile.label}</div>
            </div>
          ))}
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#101c2c" }}>
              {formatVND(stats?.stockValue ?? 0)} {t("đ")}
            </div>
            <div style={{ fontSize: 12, color: "#6f7c90" }}>{t("Giá trị tồn kho")}</div>
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
                {t("Thêm vật tư")}
              </Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm kiếm...")}
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
              showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2}", range[0], range[1], total),
            }}
            locale={{ emptyText: t("Không có dữ liệu") }}
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
        title={t("Thêm nhóm vật tư")}
        okText={t("Thêm")}
        cancelText={t("Huỷ")}
        confirmLoading={createGroup.isPending}
        onOk={handleCreateGroup}
        onCancel={() => { setGroupModalOpen(false); setNewGroupName(""); }}
      >
        <Input
          placeholder={t("Tên nhóm")}
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
    { title: t("Thời gian phân bổ"), dataIndex: "allocationTime", key: "allocationTime" },
    { title: t("Mã phân bổ"), dataIndex: "allocationCode", key: "allocationCode" },
    { title: t("Vật tư"), dataIndex: "material", key: "material" },
    { title: t("SL được phân bổ"), dataIndex: "allocatedQty", key: "allocatedQty" },
    { title: t("SL confirm còn lại"), dataIndex: "confirmedRemaining", key: "confirmedRemaining" },
    { title: t("Phòng ban"), dataIndex: "department", key: "department" },
    { title: t("Người thực hiện"), dataIndex: "performer", key: "performer" },
    { title: t("Ghi chú"), dataIndex: "note", key: "note" },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          {t("Chi tiết")}
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
            placeholder={t("Tìm phiếu phân bổ...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button>{t("Lịch sử kiểm kho")}</Button>
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
            showTotal: (total) => t("Hiển thị 0 trên {0}", total),
          }}
          locale={{ emptyText: t("Chưa có phiếu phân bổ") }}
          size="middle"
        />
      </div>
    </>
  );
}

function DepartmentView() {
  const [keyword, setKeyword] = useState("");

  const rightColumns = [
    { title: t("Thời gian phân bổ"), dataIndex: "allocationTime", key: "allocationTime" },
    { title: t("Mã phân bổ"), dataIndex: "allocationCode", key: "allocationCode" },
    { title: t("Vật tư"), dataIndex: "material", key: "material" },
    { title: t("SL được phát"), dataIndex: "distributedQty", key: "distributedQty" },
    { title: t("SL còn lại (đã duyệt)"), dataIndex: "approvedRemaining", key: "approvedRemaining" },
    { title: t("Kiểm kho"), dataIndex: "inventoryCheck", key: "inventoryCheck" },
    { title: t("Người thực hiện"), dataIndex: "performer", key: "performer" },
    { title: t("Ghi chú"), dataIndex: "note", key: "note" },
    {
      title: t("Thao tác"),
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          {t("Chi tiết")}
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
          {t("Phòng ban")}
          <span style={{ fontWeight: 400, color: "#7d8a9c", marginLeft: 6 }}>
            {t("0 phòng ban")}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#7d8a9c", marginBottom: 10 }}>
          {t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}
        </div>
        <Input
          placeholder={t("Tìm phòng ban...")}
          size="small"
          style={{ marginBottom: 8 }}
        />
        <Button type="dashed" block size="small">
          {t("Tạo phòng ban")}
        </Button>
        <div
          style={{
            color: "#7d8a9c",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          {t("Chưa có phòng ban")}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm vật tư...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button>{t("Gộp số lượng vật tư")}</Button>
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
              showTotal: (total) => t("Hiển thị 0 trên {0}", total),
            }}
            locale={{ emptyText: t("Chọn phòng ban để xem vật tư đã phân bổ") }}
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
          {subRoutes().map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #1c3566"
                    : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1c3566" : "#6f7c90",
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
